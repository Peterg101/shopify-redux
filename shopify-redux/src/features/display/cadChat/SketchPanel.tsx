import React, { useRef, useCallback } from 'react';
import { Box, Button } from '@mui/material';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import { Excalidraw, exportToBlob, THEME } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { borderSubtle, bgDefault, glowMedium } from '../../../theme';

interface ExcalidrawAPI {
  getSceneElements: () => any[];
  getAppState: () => any;
  getFiles: () => any;
}

interface SketchPanelProps {
  onAttach: (dataUrl: string) => void;
}

const SketchPanel: React.FC<SketchPanelProps> = ({ onAttach }) => {
  const apiRef = useRef<ExcalidrawAPI | null>(null);

  const handleAttach = useCallback(async () => {
    const api = apiRef.current;
    if (!api) return;

    const elements = api.getSceneElements();
    if (elements.length === 0) return;

    const blob = await exportToBlob({
      elements,
      appState: { ...api.getAppState(), exportBackground: true },
      files: api.getFiles(),
    });

    const reader = new FileReader();
    reader.onload = () => {
      onAttach(reader.result as string);
    };
    reader.readAsDataURL(blob);
  }, [onAttach]);

  return (
    <Box
      sx={{
        width: '100%',
        height: 300,
        borderTop: `1px solid ${borderSubtle}`,
        borderBottom: `1px solid ${borderSubtle}`,
        position: 'relative',
      }}
    >
      <Excalidraw
        excalidrawAPI={(api: any) => { apiRef.current = api; }}
        theme={THEME.DARK}
        initialData={{
          appState: {
            viewBackgroundColor: bgDefault,
          },
        }}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            export: false,
            toggleTheme: false,
          },
        }}
      />

      {/* Attach button overlay */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 8,
          right: 8,
          zIndex: 10,
        }}
      >
        <Button
          variant="contained"
          size="small"
          startIcon={<AttachFileIcon sx={{ fontSize: 16 }} />}
          onClick={handleAttach}
          sx={{
            fontSize: '0.75rem',
            boxShadow: `0 0 12px ${glowMedium}`,
          }}
        >
          Attach Sketch
        </Button>
      </Box>
    </Box>
  );
};

export default SketchPanel;
