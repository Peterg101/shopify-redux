import { Box, Container } from '@mui/material';
import { FileViewer } from './fileViewer';
import { ToolBar } from './toolBar';
import { ConfigurationPanel } from './ConfigurationPanel';
import { useSelector } from 'react-redux';
import { RootState } from '../../app/store';
import { useTheme } from '@mui/material/styles';
import { DRAWER_WIDTH } from '../userInterface/uiComponents';

export const MainOptions = () => {
  const userInterfaceState = useSelector((state: RootState) => state.userInterfaceState);
  const theme = useTheme();
  const dataState = useSelector((state: RootState) => state.dataState);
  const { fulfillMode } = userInterfaceState;

  const collapsedWidth = `calc(${theme.spacing(8)} + 1px)`;
  const has3DModel = dataState.fileDisplay && ['obj', 'stl', 'glb', 'fbx'].includes(dataState.selectedFileType.toLowerCase());

  return (
    <Box
      sx={{
        marginLeft: userInterfaceState.leftDrawerOpen ? `${DRAWER_WIDTH}px` : collapsedWidth,
        transition: theme.transitions.create(['margin'], {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.enteringScreen,
        }),
      }}
    >
      <Container maxWidth="lg" sx={{ mt: 12, mb: 4 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '75vh' }}>
          {has3DModel && <ToolBar />}
          <FileViewer />
        </Box>
        {has3DModel && !fulfillMode && <ConfigurationPanel />}
      </Container>
    </Box>
  );
};
