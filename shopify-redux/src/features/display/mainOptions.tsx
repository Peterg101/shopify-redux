import { Box, Container, Grid, Paper } from '@mui/material';
import { FileViewer } from './fileViewer';
import { ToolBar } from './toolBar';
import { ConfigurationPanel } from './ConfigurationPanel';
import { useSelector } from 'react-redux';
import { RootState } from '../../app/store';
import { useTheme } from '@mui/material/styles';

export const MainOptions = () => {
  const userInterfaceState = useSelector((state: RootState) => state.userInterfaceState);
  const theme = useTheme();
  const drawerWidth = userInterfaceState.drawerWidth;
  const dataState = useSelector((state: RootState) => state.dataState);

  const collapsedWidth = `calc(${theme.spacing(8)} + 1px)`;

  return (
    <Box
      sx={{
        marginLeft: userInterfaceState.leftDrawerOpen ? `${drawerWidth}px` : collapsedWidth,
        transition: theme.transitions.create(['margin'], {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.enteringScreen,
        }),
      }}
    >
      <Container maxWidth="lg" sx={{ mt: 10, mb: 4 }}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', minHeight: '70vh' }}>
              {dataState.fileDisplay && <ToolBar />}
              <FileViewer />
            </Paper>
            {dataState.fileDisplay && !dataState.fulfillMode && <ConfigurationPanel />}
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};
