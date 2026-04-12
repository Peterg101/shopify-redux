import React, { useRef, useCallback } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { Excalidraw, exportToBlob, THEME } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { bgDefault, glowMedium, borderSubtle } from '../../../theme';

interface ExcalidrawAPI {
  getSceneElements: () => any[];
  getAppState: () => any;
  getFiles: () => any;
}

interface SketchPanelProps {
  open: boolean;
  onClose: () => void;
  onAttach: (dataUrl: string) => void;
  /** Persisted scene elements so sketch survives close/reopen */
  initialElements?: any[];
  onElementsChange?: (elements: any[]) => void;
}

const SketchPanel: React.FC<SketchPanelProps> = ({
  open,
  onClose,
  onAttach,
  initialElements,
  onElementsChange,
}) => {
  const apiRef = useRef<ExcalidrawAPI | null>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleAttach = useCallback(async () => {
    const api = apiRef.current;
    if (!api) return;

    const elements = api.getSceneElements();
    if (elements.length === 0) return;

    // Save elements before closing
    if (onElementsChange) {
      onElementsChange([...elements]);
    }

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
  }, [onAttach, onElementsChange]);

  const handleClose = useCallback(() => {
    // Persist elements on close so work isn't lost
    const api = apiRef.current;
    if (api && onElementsChange) {
      onElementsChange([...api.getSceneElements()]);
    }
    onClose();
  }, [onClose, onElementsChange]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          py: 1.5,
          px: 2,
          borderBottom: `1px solid ${borderSubtle}`,
        }}
      >
        <Typography variant="subtitle1" fontWeight={600} sx={{ flex: 1, color: 'primary.main' }}>
          Sketch Pad
        </Typography>
        <IconButton size="small" onClick={handleClose} sx={{ color: 'text.secondary' }}>
          <CloseIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0, height: '70vh', position: 'relative' }}>
        <Excalidraw
          excalidrawAPI={(api: any) => { apiRef.current = api; }}
          theme={THEME.DARK}
          initialData={{
            elements: initialElements || [],
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
      </DialogContent>

      <DialogActions sx={{ px: 2, py: 1.5, borderTop: `1px solid ${borderSubtle}` }}>
        <Button
          size="small"
          startIcon={<DeleteOutlineIcon sx={{ fontSize: 16 }} />}
          onClick={handleClose}
          sx={{ color: 'text.secondary' }}
        >
          Discard
        </Button>
        <Button
          variant="contained"
          size="small"
          startIcon={<AttachFileIcon sx={{ fontSize: 16 }} />}
          onClick={handleAttach}
          sx={{ boxShadow: `0 0 12px ${glowMedium}` }}
        >
          Attach Sketch
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SketchPanel;
