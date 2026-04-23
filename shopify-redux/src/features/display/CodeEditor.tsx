import React from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { PlayArrow, Code } from '@mui/icons-material';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';
import {
  borderSubtle,
  bgHighlight,
  monoFontFamily,
  panelContainerSx,
  panelHeaderSx,
} from '../../theme';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  isRunning: boolean;
  error: string | null;
  readOnlyLines?: number;
  newCodeStartLine?: number;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  onRun,
  isRunning,
  error,
}) => {
  return (
    <Box sx={{ ...panelContainerSx, mt: 2 }}>
      {/* Header */}
      <Box sx={{ ...panelHeaderSx, justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Code sx={{ color: 'primary.main', fontSize: 20 }} />
          <Typography variant="subtitle1" fontWeight={600}>
            CadQuery Editor
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="small"
          onClick={onRun}
          disabled={isRunning}
          startIcon={
            isRunning ? (
              <CircularProgress size={14} sx={{ color: 'inherit' }} />
            ) : (
              <PlayArrow />
            )
          }
          sx={{ minWidth: 110 }}
        >
          {isRunning ? 'Running...' : 'Run Code'}
        </Button>
      </Box>

      {/* Editor */}
      <Box
        sx={{
          '& .cm-editor': {
            fontSize: '0.85rem',
            fontFamily: monoFontFamily,
            backgroundColor: '#0A0E14',
          },
          '& .cm-editor.cm-focused': {
            outline: 'none',
          },
          '& .cm-gutters': {
            backgroundColor: '#0D1117',
            borderRight: `1px solid ${borderSubtle}`,
          },
          '& .cm-activeLineGutter, & .cm-activeLine': {
            backgroundColor: `${bgHighlight} !important`,
          },
        }}
      >
        <CodeMirror
          value={value}
          onChange={onChange}
          extensions={[python()]}
          theme={oneDark}
          height="300px"
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
            autocompletion: false,
          }}
        />
      </Box>

      {/* Error display */}
      {error && (
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderTop: `1px solid ${borderSubtle}`,
            backgroundColor: 'rgba(255, 82, 82, 0.08)',
          }}
        >
          <Typography
            variant="body2"
            sx={{
              color: 'error.main',
              fontFamily: monoFontFamily,
              fontSize: '0.8rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {error}
          </Typography>
        </Box>
      )}
    </Box>
  );
};
