
import { useState, useEffect } from 'react';
import { Box, Button, CircularProgress } from '@mui/material';
import axios from 'axios';

export const HubSpotIntegration = ({ user, org, integrationParams, setIntegrationParams }) => {
  const [isConnected, setIsConnected] = useState(!!integrationParams?.credentials);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  const handleConnectClick = async () => {
    try {
      setIsConnecting(true);
      const formData = new FormData();
      formData.append('user_id', user);
      formData.append('org_id', org);


      const response = await axios.post(`http://localhost:8001/integrations/hubspot/authorize`, formData);
      const authURL = response?.data?.auth_url ?? response?.data;

      if (!authURL) {
        throw new Error('No authorization URL returned from server.');
      }

      const newWindow = window.open(authURL, 'HubSpot Authorization', 'width=600,height=600');

      const pollTimer = window.setInterval(() => {
        if (!newWindow || newWindow.closed) {
          window.clearInterval(pollTimer);
          handleWindowClosed();
        }
      }, 200);
    } catch (e) {
      console.error('HubSpot authorize error:', e);
      setIsConnecting(false);
      alert(e?.response?.data?.detail || e.message || 'Authorization failed');
    }
  };

  const handleWindowClosed = async () => {
    try {
      const formData = new FormData();
      formData.append('user_id', user);
      formData.append('org_id', org);
      const response = await axios.post(`http://localhost:8001/integrations/hubspot/credentials`, formData);
      const credentials = response.data;
      console.log('HubSpot credentials fetched:', credentials);

      if (credentials) {
        setIntegrationParams(prev => ({
          ...prev,
          credentials,
          type: 'HubSpot',
        }));
        // fetch items if needed
        fetchHubspotItems(credentials);
      }
    } catch (e) {
      console.error('Error getting HubSpot credentials:', e);
      alert(e?.response?.data?.detail || e.message || 'Failed to get credentials');
    } finally {
      setIsConnecting(false);
    }
  };

  const fetchHubspotItems = async (credentialsParam) => {
    try {
      setIsLoadingItems(true);
      const payload = {
        user_id: user,
        org_id: org,
        credentials: credentialsParam ?? integrationParams?.credentials,
      };
      const res = await axios.post(`http://localhost:8001/integrations/hubspot/load`, payload);
      console.log('HubSpot items loaded:', res.data);
      setIntegrationParams(prev => ({ ...prev, items: res.data }));
    } catch (err) {
      console.error('Error fetching HubSpot items:', err);
      alert('Error fetching HubSpot items');
    } finally {
      setIsLoadingItems(false);
    }
  };

  useEffect(() => {
    setIsConnected(!!integrationParams?.credentials);
    if (integrationParams?.credentials && !integrationParams?.items) {
      fetchHubspotItems();
    }
  }, [integrationParams]);

  return (
    <Box sx={{ mt: 2 }}>
      <div>HubSpot Integration</div>
      <Box display="flex" flexDirection="column" alignItems="center" sx={{ mt: 2 }}>
        <Button
          variant="contained"
          onClick={isConnected ? () => {} : handleConnectClick}
          color={isConnected ? 'success' : 'primary'}
          disabled={isConnecting}
        >
          {isConnected ? 'HubSpot Connected' : isConnecting ? <CircularProgress size={20} /> : 'Connect to HubSpot'}
        </Button>

        {isLoadingItems && <CircularProgress size={20} sx={{ mt: 2 }} />}

        {Array.isArray(integrationParams?.items) && integrationParams.items.map(item => (
          <Box key={item.id ?? item.name} sx={{ mt: 1, border: '1px solid #ccc', p: 1, width: '100%' }}>
            {item.name} {item.type ? `(${item.type})` : ''}
          </Box>
        ))}
      </Box>
    </Box>
  );
};
