
import { useState, useEffect } from 'react';
import { Box, Button, CircularProgress } from '@mui/material';
import axios from 'axios';

export const AirtableIntegration = ({ user, org, integrationParams, setIntegrationParams }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  const handleConnectClick = async () => {
    try {
      setIsConnecting(true);
      const formData = new FormData();
      formData.append('user_id', user);
      formData.append('org_id', org);
      const response = await axios.post(`http://localhost:8001/integrations/airtable/authorize`, formData);
      const authURL = response?.data;

      const newWindow = window.open(authURL, 'Airtable Authorization', 'width=600, height=600');

      const pollTimer = window.setInterval(() => {
        if (newWindow?.closed !== false) {
          window.clearInterval(pollTimer);
          handleWindowClosed();
        }
      }, 200);
    } catch (e) {
      setIsConnecting(false);
      alert(e?.response?.data?.detail);
    }
  };

  const handleWindowClosed = async () => {
    try {
      const formData = new FormData();
      formData.append('user_id', user);
      formData.append('org_id', org);
      const response = await axios.post(`http://localhost:8001/integrations/airtable/credentials`, formData);
      const credentials = response.data;
      if (credentials) {
        setIsConnecting(false);
        setIsConnected(true);
        setIntegrationParams(prev => ({
          ...prev,
          credentials: credentials,
          type: 'Airtable',
        }));

        fetchAirtableItems();
      }
      setIsConnecting(false);
    } catch (e) {
      setIsConnecting(false);
      alert(e?.response?.data?.detail);
    }
  };

  const fetchAirtableItems = async () => {
    try {
      setIsLoadingItems(true);
      const res = await axios.post(`http://localhost:8001/integrations/airtable/load`, {
        user_id: user,
        org_id: org,
      });
      setIntegrationParams(prev => ({ ...prev, items: res.data }));
    } catch (err) {
      console.error('Error fetching Airtable items:', err);
    } finally {
      setIsLoadingItems(false);
    }
  };

  useEffect(() => {
  // keep local isConnected in sync with integrationParams
  setIsConnected(!!integrationParams?.credentials);

  // if credentials exist and items are not loaded, fetch them
  if (integrationParams?.credentials && !integrationParams?.items) {
    fetchAirtableItems();
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
            ? 'Airtable Connected'
            : isConnecting
            ? <CircularProgress size={20} />
            : 'Connect to Airtable'}
        </Button>

        {isLoadingItems && <CircularProgress size={20} sx={{ mt: 2 }} />}

        {/* Render items */}
        {integrationParams?.items?.map(item => (
          <Box key={item.id} sx={{ mt: 1, border: '1px solid #ccc', p: 1, width: '100%' }}>
            {item.name} ({item.type})
          </Box>
        ))}
      </Box>
    </Box>
  );
};
