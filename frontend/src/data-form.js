// src/data-form.js
import { useState } from 'react';
import {
  Box,
  TextField,
  Button,
} from '@mui/material';
import axios from 'axios';

const endpointMapping = {
  'Notion': 'notion',
  'Airtable': 'airtable',
  'HubSpot': 'hubspot',
};

export const DataForm = ({ integrationType, credentials }) => {
  const [loadedData, setLoadedData] = useState(null);
  const endpoint = endpointMapping[integrationType];

  const handleLoad = async () => {
    if (!integrationType) {
      alert('No integration type selected.');
      return;
    }
    if (!credentials) {
      alert('No credentials available — connect the integration first.');
      return;
    }

    try {
      // If backend expects JSON, send JSON. If it expects form-data, change accordingly.
      // Using JSON here because your load endpoints (examples earlier) used axios.post with objects.
      const payload = {
        credentials: credentials,
      };
      const response = await axios.post(`http://localhost:8001/integrations/${endpoint}/load`, payload);
      const data = response.data;
      console.log('Loaded data for', integrationType, data);
      setLoadedData(data);
    } catch (e) {
      console.error('Error loading data:', e);
      alert(e?.response?.data?.detail || e.message || 'Error loading data');
    }
  };

  return (
    <Box display='flex' justifyContent='center' alignItems='center' flexDirection='column' width='100%'>
      <Box display='flex' flexDirection='column' width='100%'>
        <TextField
          label="Loaded Data"
          value={loadedData ? JSON.stringify(loadedData, null, 2) : ''}
          sx={{mt: 2}}
          InputLabelProps={{ shrink: true }}
          multiline
          minRows={10}
          disabled
        />
        <Button
          onClick={handleLoad}
          sx={{mt: 2}}
          variant='contained'
        >
          Load Data
        </Button>
        <Button
          onClick={() => setLoadedData(null)}
          sx={{mt: 1}}
          variant='contained'
        >
          Clear Data
        </Button>
      </Box>
    </Box>
  );
};
