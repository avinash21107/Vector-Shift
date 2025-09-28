import sys
import logging
from fastapi import FastAPI, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from functools import wraps

from backend.integrations.airtable import (
    authorize_airtable, get_items_airtable, oauth2callback_airtable, get_airtable_credentials
)
from backend.integrations.notion import (
    authorize_notion, get_items_notion, oauth2callback_notion, get_notion_credentials
)
from backend.integrations.hubspot import (
    authorize_hubspot, get_items_hubspot, oauth2callback_hubspot, get_hubspot_credentials
)

# -------------------- Logging Setup --------------------
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("backend")

# -------------------- FastAPI App --------------------
app = FastAPI()

# -------------------- CORS --------------------
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://192.168.0.106:3000",
    "http://192.168.0.101:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------- Middleware for Logging --------------------
@app.middleware("http")
async def debug_request_logger(request: Request, call_next):
    logger.info(f"Incoming {request.method} {request.url}")
    try:
        if request.method in ["POST", "PUT", "PATCH"] and request.headers.get("content-type", "").startswith("application/json"):
            body = await request.json()
            logger.info(f"Request JSON body: {body}")
        response = await call_next(request)
        if response is None:
            logger.error(f"call_next returned None for {request.url}")
            from fastapi.responses import JSONResponse
            return JSONResponse({"error": "Internal Server Error: call_next returned None"}, status_code=500)
        logger.info(f"Response status: {response.status_code}")
        return response
    except Exception as e:
        logger.exception("Error during request")
        from fastapi.responses import JSONResponse
        return JSONResponse({"error": str(e)}, status_code=500)

# -------------------- Decorator for Endpoint Logging --------------------
def debug_endpoint(func):
    """Wrap endpoint in try-except with logging, preserving signature."""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except Exception as e:
            logger.exception(f"Error in endpoint {func.__name__}")
            from fastapi.responses import JSONResponse
            return JSONResponse({"error": str(e)}, status_code=500)
    return wrapper

# -------------------- Load Request Model --------------------
class LoadRequest(BaseModel):
    user_id: str
    org_id: str

# -------------------- Health Endpoints --------------------
@app.get("/")
@debug_endpoint
async def read_root():
    return {"Ping": "Pong"}

@app.get("/ping")
@debug_endpoint
async def ping():
    return {"msg": "pong"}

@app.get("/debug-error")
@debug_endpoint
async def debug_error():
    logger.info("Debug error endpoint hit")
    raise ValueError("This is a test error")

# -------------------- Airtable Endpoints --------------------
@app.post('/integrations/airtable/authorize')
@debug_endpoint
async def authorize_airtable_integration(user_id: str = Form(...), org_id: str = Form(...)):
    return await authorize_airtable(user_id, org_id)

@app.get('/integrations/airtable/oauth2callback')
@debug_endpoint
async def oauth2callback_airtable_integration(request: Request):
    return await oauth2callback_airtable(request)

@app.post('/integrations/airtable/credentials')
@debug_endpoint
async def get_airtable_credentials_integration(user_id: str = Form(...), org_id: str = Form(...)):
    return await get_airtable_credentials(user_id, org_id)

@app.post('/integrations/airtable/load')
@debug_endpoint
async def load_airtable_items(req: LoadRequest):
    credentials = await get_airtable_credentials(req.user_id, req.org_id)
    items = await get_items_airtable(credentials)
    return [item.dict() for item in items]

# -------------------- Notion Endpoints --------------------
@app.post('/integrations/notion/authorize')
@debug_endpoint
async def authorize_notion_integration(user_id: str = Form(...), org_id: str = Form(...)):
    return await authorize_notion(user_id, org_id)

@app.get('/integrations/notion/oauth2callback')
@debug_endpoint
async def oauth2callback_notion_integration(request: Request):
    return await oauth2callback_notion(request)

@app.post('/integrations/notion/credentials')
@debug_endpoint
async def get_notion_credentials_integration(user_id: str = Form(...), org_id: str = Form(...)):
    return await get_notion_credentials(user_id, org_id)

@app.post('/integrations/notion/load')
@debug_endpoint
async def load_notion_items(req: LoadRequest):
    credentials = await get_notion_credentials(req.user_id, req.org_id)
    items = await get_items_notion(credentials)
    return [item.dict() for item in items]

# -------------------- HubSpot Endpoints --------------------
@app.post('/integrations/hubspot/authorize')
@debug_endpoint
async def authorize_hubspot_integration(user_id: str = Form(...), org_id: str = Form(...)):
    return await authorize_hubspot(user_id, org_id)

@app.get('/integrations/hubspot/oauth2callback')
@debug_endpoint
async def oauth2callback_hubspot_integration(request: Request):
    return await oauth2callback_hubspot(request)

@app.post('/integrations/hubspot/credentials')
@debug_endpoint
async def get_hubspot_credentials_integration(user_id: str = Form(...), org_id: str = Form(...)):
    return await get_hubspot_credentials(user_id, org_id)

@app.post('/integrations/hubspot/get_hubspot_items')
@debug_endpoint
async def load_hubspot_items(req: LoadRequest):
    credentials = await get_hubspot_credentials(req.user_id, req.org_id)
    items = await get_items_hubspot(credentials)
    return [item.dict() for item in items]
