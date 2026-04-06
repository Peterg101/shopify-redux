import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  CircularProgress,
} from '@mui/material';
import { AutoFixHigh } from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../../app/store';
import { borderSubtle, borderHover, bgHighlight, bgHighlightHover, glowSubtle, glowMedium } from '../../theme';
import { keyframes } from '@mui/material/styles';
import { useFile } from '../../services/fileProvider';
import { connectProgressStream } from '../../services/progressStream';
import { setCadPending, setCadLoading } from '../../services/cadSlice';
import { authApi } from '../../services/authApi';
import { generateUuid } from '../../app/utility/collectionUtils';
import logger from '../../app/utility/logger';

const pulseIcon = keyframes`
  0%, 100% { filter: drop-shadow(0 0 4px rgba(0, 229, 255, 0.3)); }
  50% { filter: drop-shadow(0 0 10px rgba(0, 229, 255, 0.7)); }
`;

const GENERATION_URL = process.env.REACT_APP_GENERATION_URL || 'http://localhost:1234';

export const RefinementInput: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { setActualFile } = useFile();

  const dataState = useSelector((state: RootState) => state.dataState);
  const userInformation = useSelector(
    (state: RootState) => state.userInterfaceState.userInformation
  );
  const cadPending = useSelector((state: RootState) => state.cadState.cadPending);
  const cadLoading = useSelector((state: RootState) => state.cadState.cadLoading);

  const taskId = dataState.taskId;
  const isComplete = dataState.stepMetadata?.processingStatus === 'complete';

  const [instruction, setInstruction] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isDisabled = cadPending || cadLoading || submitting;

  const handleRefine = async () => {
    const trimmed = instruction.trim();
    if (!trimmed || !taskId || !userInformation?.user?.user_id) return;

    setSubmitting(true);
    const portId = generateUuid();

    try {
      dispatch(setCadPending({ cadPending: true }));
      dispatch(setCadLoading({ cadLoading: true }));

      const resp = await fetch(`${GENERATION_URL}/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          task_id: taskId,
          port_id: portId,
          user_id: userInformation.user.user_id,
          instruction: trimmed,
        }),
      });

      if (!resp.ok) {
        throw new Error(`Refinement failed: ${resp.statusText}`);
      }

      dispatch(authApi.util.invalidateTags([{ type: 'sessionData' }]));
      connectProgressStream(portId, 'cad', dispatch, setActualFile);
      setInstruction('');
    } catch (err: any) {
      logger.error('Error starting refinement:', err);
      dispatch(setCadLoading({ cadLoading: false }));
      dispatch(setCadPending({ cadPending: false }));
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isDisabled && instruction.trim()) {
      e.preventDefault();
      handleRefine();
    }
  };

  // Only show when a CAD task is loaded and complete
  if (!taskId || !isComplete) {
    return null;
  }

  return (
    <Box
      sx={{
        mt: 2,
        border: `1px solid ${borderHover}`,
        borderRadius: 3,
        overflow: 'hidden',
        backdropFilter: 'blur(8px)',
        boxShadow: `0 0 16px ${glowMedium}, inset 0 0 16px ${glowSubtle}`,
        transition: 'box-shadow 0.3s ease, border-color 0.3s ease',
        '&:hover': {
          borderColor: 'primary.main',
          boxShadow: `0 0 24px ${borderHover}, inset 0 0 20px ${glowSubtle}`,
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1.5,
          borderBottom: `1px solid ${borderHover}`,
          background: `linear-gradient(135deg, ${bgHighlightHover} 0%, ${bgHighlight} 100%)`,
        }}
      >
        <AutoFixHigh sx={{
          color: 'primary.main',
          fontSize: 22,
          animation: `${pulseIcon} 3s ease-in-out infinite`,
        }} />
        <Typography variant="subtitle1" fontWeight={600} sx={{ color: 'primary.main' }}>
          Refine Model
        </Typography>
      </Box>

      {/* Body */}
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          <TextField
            fullWidth
            size="small"
            multiline
            minRows={1}
            maxRows={2}
            placeholder='Describe changes: "Add 4mm holes at each corner"'
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isDisabled}
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: borderSubtle,
                },
              },
            }}
          />
          <Button
            variant="contained"
            size="small"
            onClick={handleRefine}
            disabled={isDisabled || !instruction.trim()}
            sx={{
              minWidth: 90,
              height: 40,
              boxShadow: `0 0 12px ${glowSubtle}`,
            }}
          >
            {isDisabled ? (
              <CircularProgress size={18} color="inherit" />
            ) : (
              'Refine'
            )}
          </Button>
        </Box>

        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', mt: 1, display: 'block' }}
        >
          Build complex models step by step — each refinement modifies the existing geometry.
        </Typography>
      </Box>
    </Box>
  );
};
