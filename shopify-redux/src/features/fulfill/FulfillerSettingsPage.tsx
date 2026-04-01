import { Box, Container, Typography } from '@mui/material';
import { HeaderBar } from '../userInterface/headerBar';
import { FulfillerSettingsPanel } from './FulfillerSettingsPanel';

export const FulfillerSettingsPage = () => {
  return (
    <Box>
      <HeaderBar />
      <Container maxWidth="md" sx={{ pt: 12, pb: 6 }}>
        <Typography variant="h5" fontWeight={600} sx={{ mb: 3 }}>
          Fulfiller Settings
        </Typography>
        <FulfillerSettingsPanel />
      </Container>
    </Box>
  );
};
