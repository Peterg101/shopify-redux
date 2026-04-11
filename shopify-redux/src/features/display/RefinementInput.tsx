import React, { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  Alert,
  Box,
  Collapse,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Popper,
  Select,
  Tooltip,
  Typography,
  Button,
  TextField,
  CircularProgress,
} from '@mui/material';
import { AutoFixHigh, Tune, Undo, Redo, ExpandMore, ExpandLess } from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../../app/store';
import { CadGenerationSettings, ChatMessage } from '../../app/utility/interfaces';
import ChatBubble from './cadChat/ChatBubble';
import { setCadGenerationSettings } from '../../services/cadSlice';
import { borderSubtle, borderHover, bgHighlight, bgHighlightHover, glowSubtle, glowMedium } from '../../theme';
import { keyframes } from '@mui/material/styles';
import { useFile } from '../../services/fileProvider';
import { connectProgressStream } from '../../services/progressStream';
import { setCadPending, setCadLoading, setCadOperationType } from '../../services/cadSlice';
import { authApi } from '../../services/authApi';
import { generateUuid } from '../../app/utility/collectionUtils';
import logger from '../../app/utility/logger';

const pulseIcon = keyframes`
  0%, 100% { filter: drop-shadow(0 0 4px rgba(0, 229, 255, 0.3)); }
  50% { filter: drop-shadow(0 0 10px rgba(0, 229, 255, 0.7)); }
`;

const GENERATION_URL = process.env.REACT_APP_GENERATION_URL || 'http://localhost:1234';

export interface RefinementInputHandle {
  insertTag: (text: string) => void;
}

export const RefinementInput = forwardRef<RefinementInputHandle>((_props, ref) => {
  const dispatch = useDispatch<AppDispatch>();
  const { setActualFile } = useFile();

  const dataState = useSelector((state: RootState) => state.dataState);
  const userInformation = useSelector(
    (state: RootState) => state.userInterfaceState.userInformation
  );
  const cadPending = useSelector((state: RootState) => state.cadState.cadPending);
  const cadLoading = useSelector((state: RootState) => state.cadState.cadLoading);
  const cadStatusMessage = useSelector((state: RootState) => state.cadState.cadStatusMessage);
  const cadSettings = useSelector((state: RootState) => state.cadState.cadGenerationSettings);

  const taskId = dataState.taskId;
  const isComplete = dataState.stepMetadata?.processingStatus === 'complete';

  const chatMessages = useSelector((state: RootState) => state.cadChatState.messages);

  const [instruction, setInstruction] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [mentionState, setMentionState] = useState<{
    query: string;
    startIndex: number;
  } | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const textFieldRef = useRef<HTMLDivElement>(null);

  const features = dataState.stepMetadata?.features ?? [];
  const currentVersion = dataState.stepMetadata?.currentVersion ?? 0;
  const totalVersions = dataState.stepMetadata?.totalVersions ?? 0;

  const filteredFeatures = mentionState
    ? features.filter(f => f.tag.toLowerCase().includes(mentionState.query.toLowerCase()))
    : [];

  // Expose insertTag for FeatureOverlay clicks
  useImperativeHandle(ref, () => ({
    insertTag: (text: string) => {
      setInstruction((prev) => {
        const prefix = prev.trim() ? `${prev.trim()} ` : '';
        return `${prefix}${text}: `;
      });
    },
  }));

  const handleMentionSelect = (tag: string) => {
    if (!mentionState) return;
    const before = instruction.slice(0, mentionState.startIndex);
    const after = instruction.slice(mentionState.startIndex + 1 + mentionState.query.length);
    setInstruction(`${before}${tag}${after} `);
    setMentionState(null);
    setMentionIndex(0);
  };

  const handleInstructionChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = (e.target as HTMLInputElement).selectionStart ?? value.length;
    setInstruction(value);

    // Detect @ mention
    const textBeforeCursor = value.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');

    if (atIndex >= 0 && (atIndex === 0 || textBeforeCursor[atIndex - 1] === ' ')) {
      const query = textBeforeCursor.slice(atIndex + 1);
      if (!query.includes(' ') && !query.includes('\n')) {
        setMentionState({ query, startIndex: atIndex });
        setMentionIndex(0);
        return;
      }
    }
    setMentionState(null);
  };

  const isDisabled = cadPending || cadLoading || submitting;
  const canUndo = currentVersion > 1 && !isDisabled;
  const canRedo = currentVersion < totalVersions && !isDisabled;

  const handleRevert = async (version: number) => {
    if (!taskId || !userInformation?.user?.user_id || isDisabled) return;
    const portId = generateUuid();
    try {
      dispatch(setCadOperationType({ cadOperationType: 'revert' }));
      dispatch(setCadPending({ cadPending: true }));
      dispatch(setCadLoading({ cadLoading: true }));
      const resp = await fetch(`${GENERATION_URL}/revert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          task_id: taskId,
          port_id: portId,
          user_id: userInformation.user.user_id,
          version,
        }),
      });
      if (!resp.ok) throw new Error(`Revert failed: ${resp.statusText}`);
      connectProgressStream(portId, 'cad', dispatch, setActualFile);
    } catch (err: any) {
      logger.error('Revert error:', err);
      dispatch(setCadLoading({ cadLoading: false }));
      dispatch(setCadPending({ cadPending: false }));
    }
  };

  const handleRefine = async () => {
    const trimmed = instruction.trim();
    if (!trimmed || !taskId || !userInformation?.user?.user_id) return;

    setSubmitting(true);
    const portId = generateUuid();

    try {
      dispatch(setCadOperationType({ cadOperationType: 'refine' }));
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
          max_iterations: cadSettings.max_iterations,
          timeout_seconds: cadSettings.timeout_seconds,
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
    // Mention dropdown keyboard navigation
    if (mentionState && filteredFeatures.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(prev => Math.min(prev + 1, filteredFeatures.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(prev => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        handleMentionSelect(filteredFeatures[mentionIndex].tag);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionState(null);
        return;
      }
    }

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
        <Typography variant="subtitle1" fontWeight={600} sx={{ color: 'primary.main', flex: 1 }}>
          Refine Model
        </Typography>
        {totalVersions > 0 && (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title={canUndo ? 'Undo last change' : 'Nothing to undo'}>
              <span>
                <IconButton
                  size="small"
                  disabled={!canUndo}
                  onClick={() => handleRevert(currentVersion - 1)}
                  sx={{ color: canUndo ? 'primary.main' : 'text.disabled', p: 0.5 }}
                >
                  <Undo sx={{ fontSize: 18 }} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={canRedo ? 'Redo' : 'Nothing to redo'}>
              <span>
                <IconButton
                  size="small"
                  disabled={!canRedo}
                  onClick={() => handleRevert(currentVersion + 1)}
                  sx={{ color: canRedo ? 'primary.main' : 'text.disabled', p: 0.5 }}
                >
                  <Redo sx={{ fontSize: 18 }} />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        )}
      </Box>

      {/* Conversation history from pre-generation chat */}
      {chatMessages.length > 0 && (
        <>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              px: 2,
              py: 0.5,
              cursor: 'pointer',
              '&:hover': { backgroundColor: bgHighlight },
            }}
            onClick={() => setShowHistory(!showHistory)}
          >
            <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
              Design conversation ({chatMessages.length} messages)
            </Typography>
            {showHistory ? <ExpandLess sx={{ fontSize: 16, color: 'text.secondary' }} /> : <ExpandMore sx={{ fontSize: 16, color: 'text.secondary' }} />}
          </Box>
          <Collapse in={showHistory}>
            <Box sx={{ maxHeight: 250, overflowY: 'auto', px: 1, py: 1, borderBottom: `1px solid ${borderSubtle}` }}>
              {chatMessages.map((msg: ChatMessage) => (
                <ChatBubble key={msg.id} message={msg} onApprove={() => {}} onEdit={() => {}} />
              ))}
            </Box>
          </Collapse>
        </>
      )}

      {/* Body */}
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', position: 'relative' }}>
          <TextField
            ref={textFieldRef}
            fullWidth
            size="small"
            multiline
            minRows={1}
            maxRows={2}
            placeholder={features.length > 0
              ? 'Type @ to reference features — e.g. "Chamfer @mounting_hole"'
              : 'Describe changes: "Add 4mm holes at each corner"'
            }
            value={instruction}
            onChange={handleInstructionChange}
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
          {/* @ Mention dropdown */}
          <Popper
            open={!!mentionState && filteredFeatures.length > 0}
            anchorEl={textFieldRef.current}
            placement="bottom-start"
            style={{ zIndex: 1300 }}
          >
            <Paper
              sx={{
                maxHeight: 200,
                overflow: 'auto',
                border: `1px solid ${borderHover}`,
                backgroundColor: 'background.paper',
                backdropFilter: 'blur(8px)',
                mt: 0.5,
                minWidth: 240,
              }}
            >
              <List dense disablePadding>
                {filteredFeatures.map((f, i) => {
                  const dimStr = f.dimensions?.diameter
                    ? ` ⌀${f.dimensions.diameter}`
                    : f.dimensions?.radius
                      ? ` R${f.dimensions.radius}`
                      : '';
                  return (
                    <ListItemButton
                      key={f.tag}
                      selected={i === mentionIndex}
                      onClick={() => handleMentionSelect(f.tag)}
                      sx={{
                        py: 0.5,
                        '&.Mui-selected': {
                          backgroundColor: bgHighlightHover,
                        },
                        '&:hover': {
                          backgroundColor: bgHighlightHover,
                        },
                      }}
                    >
                      <ListItemText
                        primary={
                          <Typography variant="body2" sx={{ fontFamily: "'Roboto Mono', monospace", fontSize: '0.8rem', color: '#00E5FF' }}>
                            {f.tag}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                            {f.type}{dimStr}
                          </Typography>
                        }
                      />
                    </ListItemButton>
                  );
                })}
              </List>
            </Paper>
          </Popper>
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

        {/* Settings toggle + collapsible row */}
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, gap: 0.5 }}>
          <Tooltip title={showSettings ? 'Hide settings' : 'Refinement settings'}>
            <IconButton
              size="small"
              onClick={() => setShowSettings(!showSettings)}
              sx={{ color: showSettings ? 'primary.main' : 'text.secondary', p: 0.5 }}
            >
              <Tune sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Typography variant="caption" sx={{ color: 'text.secondary', flex: 1 }}>
            {features.length > 0
              ? 'Type @ to reference features \u00B7 Each refinement modifies existing geometry'
              : 'Each refinement modifies the existing geometry step by step.'}
          </Typography>
        </Box>

        <Collapse in={showSettings}>
          <Box sx={{ display: 'flex', gap: 2, mt: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="caption" color="text.secondary">Retries:</Typography>
              <Select
                size="small"
                value={cadSettings.max_iterations}
                onChange={(e) => dispatch(setCadGenerationSettings({ settings: { max_iterations: Number(e.target.value) } }))}
                sx={{ minWidth: 55, '& .MuiSelect-select': { py: 0.25, fontSize: '0.8rem' } }}
              >
                {[1, 2, 3, 4, 5].map((v) => (
                  <MenuItem key={v} value={v}>{v}</MenuItem>
                ))}
              </Select>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="caption" color="text.secondary">Timeout:</Typography>
              <Select
                size="small"
                value={cadSettings.timeout_seconds}
                onChange={(e) => dispatch(setCadGenerationSettings({ settings: { timeout_seconds: Number(e.target.value) } }))}
                sx={{ minWidth: 65, '& .MuiSelect-select': { py: 0.25, fontSize: '0.8rem' } }}
              >
                {[10, 20, 30, 45, 60].map((v) => (
                  <MenuItem key={v} value={v}>{v}s</MenuItem>
                ))}
              </Select>
            </Box>
          </Box>
        </Collapse>

        {/* Clarification message from LLM */}
        {cadStatusMessage && cadStatusMessage.startsWith('CLARIFICATION:') && (
          <Alert severity="info" sx={{ mt: 1.5, fontSize: '0.8rem' }}>
            {cadStatusMessage.replace('CLARIFICATION:', '').trim()}
          </Alert>
        )}
      </Box>
    </Box>
  );
});
