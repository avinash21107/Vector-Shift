
import json
import secrets
import base64
import asyncio
from fastapi import Request, HTTPException
from fastapi.responses import HTMLResponse
import httpx
import requests

from backend.integrations.integration_item import IntegrationItem
from backend.redis_client import add_key_value_redis, get_value_redis, delete_key_redis

CLIENT_ID = 'YOUR_HUBSPOT_CLIENT_ID'
CLIENT_SECRET = 'YOUR_HUBSPOT_CLIENT_SECRET'
REDIRECT_URI = 'http://localhost:8000/integrations/hubspot/oauth2callback'
AUTH_URL = f'https://app.hubspot.com/oauth/authorize?client_id={CLIENT_ID}&redirect_uri={REDIRECT_URI}&scope=contacts%20content'

async def authorize_hubspot(user_id, org_id):
    state_data = {
        'state': secrets.token_urlsafe(32),
        'user_id': user_id,
        'org_id': org_id
    }
    encoded_state = base64.urlsafe_b64encode(json.dumps(state_data).encode()).decode()
    await add_key_value_redis(f'hubspot_state:{org_id}:{user_id}', json.dumps(state_data), expire=600)
    return {"auth_url": f'{AUTH_URL}&state={encoded_state}&response_type=code'}

async def oauth2callback_hubspot(request: Request):
    if request.query_params.get('error'):
        raise HTTPException(status_code=400, detail=request.query_params.get('error'))

    code = request.query_params.get('code')
    encoded_state = request.query_params.get('state')
    if not encoded_state:
        raise HTTPException(status_code=400, detail='Missing state')
    state_data = json.loads(base64.urlsafe_b64decode(encoded_state).decode())

    user_id = state_data.get('user_id')
    org_id = state_data.get('org_id')
    saved_state = await get_value_redis(f'hubspot_state:{org_id}:{user_id}')

    if not saved_state or json.loads(saved_state).get('state') != state_data.get('state'):
        raise HTTPException(status_code=400, detail='State does not match.')

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            'https://api.hubapi.com/oauth/v1/token',
            data={
                'grant_type': 'authorization_code',
                'client_id': CLIENT_ID,
                'client_secret': CLIENT_SECRET,
                'redirect_uri': REDIRECT_URI,
                'code': code
            },
            headers={'Content-Type': 'application/x-www-form-urlencoded'}
        )
        resp.raise_for_status()
    credentials = resp.json()
    await add_key_value_redis(f'hubspot_credentials:{org_id}:{user_id}', json.dumps(credentials), expire=600)
    await delete_key_redis(f'hubspot_state:{org_id}:{user_id}')

    return HTMLResponse('<html><script>window.close();</script></html>')

async def get_hubspot_credentials(user_id, org_id):
    credentials = await get_value_redis(f'hubspot_credentials:{org_id}:{user_id}')
    if not credentials:
        raise HTTPException(status_code=400, detail='No credentials found.')
    credentials = json.loads(credentials)
    await delete_key_redis(f'hubspot_credentials:{org_id}:{user_id}')
    return credentials

def create_integration_item_metadata_object_from_hubspot(obj) -> IntegrationItem:
    props = obj.get('properties', {}) or {}
    name = (props.get('firstname') or '') + ' ' + (props.get('lastname') or '')
    name = name.strip() or props.get('email') or f"contact-{obj.get('id')}"
    item = IntegrationItem(
        id=obj.get('id'),
        name=name,
        type='contact',
    )
    return item

async def get_items_hubspot(credentials):
    if isinstance(credentials, str):
        credentials = json.loads(credentials)
    access_token = credentials.get('access_token')
    if not access_token:
        raise HTTPException(status_code=400, detail='No access token in credentials')

    headers = {'Authorization': f'Bearer {access_token}'}
    url = 'https://api.hubapi.com/crm/v3/objects/contacts?limit=50&properties=firstname,lastname,email'

    resp = requests.get(url, headers=headers)
    items = []
    if resp.status_code == 200:
        for obj in resp.json().get('results', []):
            item = create_integration_item_metadata_object_from_hubspot(obj)
            items.append(item)
    else:
        raise HTTPException(status_code=resp.status_code, detail=f'HubSpot API error: {resp.text}')

    return items
