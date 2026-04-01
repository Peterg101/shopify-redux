import { Box, Container, Typography } from '@mui/material';
import { FileViewer } from './fileViewer';
import { ToolBar } from './toolBar';
import { ConfigurationPanel } from './ConfigurationPanel';
import { useSelector } from 'react-redux';
import { RootState } from '../../app/store';
import { useGetUserTasksQuery } from '../../services/authApi';
import { LeftDrawerTask } from '../userInterface/leftDrawerFragments';

export const MainOptions = () => {
  const dataState = useSelector((state: RootState) => state.dataState);
  const userInterfaceState = useSelector((state: RootState) => state.userInterfaceState);
  const { fulfillMode } = userInterfaceState;
  const { data: tasks = [] } = useGetUserTasksQuery();

  const has3DModel = dataState.fileDisplay && ['obj', 'stl', 'glb', 'fbx'].includes(dataState.selectedFileType.toLowerCase());

  return (
    <Box>
      <Container maxWidth="lg" sx={{ mt: 12, mb: 4 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '75vh' }}>
          {has3DModel && <ToolBar />}
          <FileViewer />
        </Box>
        {has3DModel && !fulfillMode && <ConfigurationPanel />}
        {tasks.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Recent Generations</Typography>
            {tasks.map(task => <LeftDrawerTask key={task.task_id} {...task} />)}
          </Box>
        )}
      </Container>
    </Box>
  );
};
