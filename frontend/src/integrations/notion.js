// src/integrations/notion.js
import { useState, useEffect } from 'react';
import { Box, Button, CircularProgress } from '@mui/material';
import axios from 'axios';

export const NotionIntegration = ({ user, org, integrationParams, setIntegrationParams }) => {
  const [isConnected, setIsConnected] = useState(!!integrationParams?.credentials);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  const handleConnectClick = async () => {
    try {
      setIsConnecting(true);
      const formData = new FormData();
      formData.append('user_id', user);
      formData.append('org_id', org);

      const response = await axios.post(`http://localhost:8001/integrations/notion/authorize`, formData);
      const authURL = response?.data?.auth_url ?? response?.data;

      if (!authURL) {
        throw new Error('No authorization URL returned from server.');
      }

      const newWindow = window.open(authURL, 'Notion Authorization', 'width=600,height=600');

      const pollTimer = window.setInterval(() => {
        if (!newWindow || newWindow.closed) {
          window.clearInterval(pollTimer);
          handleWindowClosed();
        }
      }, 200);
    } catch (e) {
      console.error('Notion authorize error:', e);
      setIsConnecting(false);
      alert(e?.response?.data?.detail || e.message || 'Authorization failed');
    }
  };

  const handleWindowClosed = async () => {
    try {
      const formData = new FormData();
      formData.append('user_id', user);
      formData.append('org_id', org);
      const response = await axios.post(`http://localhost:8001/integrations/notion/credentials`, formData);
      const credentials = response.data;
      console.log('Notion credentials fetched:', credentials);

      if (credentials) {
        setIntegrationParams(prev => ({
          ...prev,
          credentials,
          type: 'Notion',
        }));

        fetchNotionItems(credentials);
      }
    } catch (e) {
      console.error('Error getting Notion credentials:', e);
      alert(e?.response?.data?.detail || e.message || 'Failed to get credentials');
    } finally {
      setIsConnecting(false);
    }
  };

  const fetchNotionItems = async (credentialsParam) => {
    try {
      setIsLoadingItems(true);
      const payload = {
        user_id: user,
        org_id: org,
        credentials: credentialsParam ?? integrationParams?.credentials,
      };
      const res = await axios.post(`http://localhost:8001/integrations/notion/load`, payload);
      console.log('Notion items loaded:', res.data);
      setIntegrationParams(prev => ({ ...prev, items: res.data }));
    } catch (err) {
      console.error('Error fetching Notion items:', err);
      alert('Error fetching Notion items');
    } finally {
      setIsLoadingItems(false);
    }
  };

  useEffect(() => {
    setIsConnected(!!integrationParams?.credentials);
    if (integrationParams?.credentials && !integrationParams?.items) {
      fetchNotionItems();
    }
  }, [integrationParams]);

  return (
    <Box sx={{ mt: 2 }}>
      <div>Parameters</div>
      <Box display="flex" flexDirection="column" alignItems="center" sx={{ mt: 2 }}>
        <Button
          variant="contained"
          onClick={isConnected ? () => {} : handleConnectClick}
          color={isConnected ? 'success' : 'primary'}
          disabled={isConnecting}
          style={{
            pointerEvents: isConnected ? 'none' : 'auto',
            cursor: isConnected ? 'default' : 'pointer',
            opacity: isConnected ? 1 : undefined,
          }}
        >
          {isConnected
            ? 'Notion Connected'
            : isConnecting
            ? <CircularProgress size={20} />
            : 'Connect to Notion'}
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
