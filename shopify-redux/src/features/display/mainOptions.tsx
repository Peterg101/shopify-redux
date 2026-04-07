import React, { useCallback, useRef } from 'react';
import { Box, Container } from '@mui/material';
import { FileViewer } from './fileViewer';
import { ToolBar } from './toolBar';
import { ConfigurationPanel } from './ConfigurationPanel';
import { ParameterEditor } from './ParameterEditor';
import { RefinementInput, RefinementInputHandle } from './RefinementInput';
import { FeatureTree } from './FeatureTree';
import { GenerationHistoryPanel } from './GenerationHistoryPanel';
import { useSelector } from 'react-redux';
import { RootState } from '../../app/store';

export const MainOptions = () => {
  const dataState = useSelector((state: RootState) => state.dataState);
  const userInterfaceState = useSelector((state: RootState) => state.userInterfaceState);
  const { fulfillMode } = userInterfaceState;
  const refinementRef = useRef<RefinementInputHandle>(null);

  const has3DModel = dataState.fileDisplay && ['obj', 'stl', 'glb', 'fbx'].includes(dataState.selectedFileType.toLowerCase());

  const handleTagClick = useCallback((text: string) => {
    refinementRef.current?.insertTag(text);
  }, []);

  return (
    <Box>
      <Container maxWidth="lg" sx={{ mt: 12, mb: 4 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '75vh' }}>
          {has3DModel && <ToolBar />}
          <FileViewer onTagClick={handleTagClick} />
        </Box>
        {has3DModel && !fulfillMode && <RefinementInput ref={refinementRef} />}
        {has3DModel && !fulfillMode && <FeatureTree />}
        {has3DModel && !fulfillMode && <ConfigurationPanel />}
        {has3DModel && !fulfillMode && <ParameterEditor />}
        <GenerationHistoryPanel />
      </Container>
    </Box>
  );
};
