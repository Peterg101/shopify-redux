import { Box, Container } from '@mui/material';
import { FileViewer } from './fileViewer';
import { ToolBar } from './toolBar';
import { ConfigurationPanel } from './ConfigurationPanel';
import { GenerationHistoryPanel } from './GenerationHistoryPanel';
import { useSelector } from 'react-redux';
import { RootState } from '../../app/store';

export const MainOptions = () => {
  const dataState = useSelector((state: RootState) => state.dataState);
  const userInterfaceState = useSelector((state: RootState) => state.userInterfaceState);
  const { fulfillMode } = userInterfaceState;

  const has3DModel = dataState.fileDisplay && ['obj', 'stl', 'glb', 'fbx'].includes(dataState.selectedFileType.toLowerCase());

  return (
    <Box>
      <Container maxWidth="lg" sx={{ mt: 12, mb: 4 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '75vh' }}>
          {has3DModel && <ToolBar />}
          <FileViewer />
        </Box>
        {has3DModel && !fulfillMode && <ConfigurationPanel />}
        <GenerationHistoryPanel />
      </Container>
    </Box>
  );
};
