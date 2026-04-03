import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Collapse,
  Button,
  TextField,
  CircularProgress,
} from '@mui/material';
import {
  ExpandMore,
  ExpandLess,
  Tune,
  PlayArrow,
  RestartAlt,
} from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../../app/store';
import { borderSubtle, borderHover, bgHighlight, monoFontFamily, glowSubtle } from '../../theme';
import { useFile } from '../../services/fileProvider';
import { connectProgressStream } from '../../services/progressStream';
import { setCadLoading, setCadPending } from '../../services/cadSlice';
import { authApi } from '../../services/authApi';
import { generateUuid } from '../../app/utility/collectionUtils';
import logger from '../../app/utility/logger';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const GENERATION_URL = process.env.REACT_APP_GENERATION_URL || 'http://localhost:1234';

interface ParameterInfo {
  name: string;
  value: number;
  type: string;
}

interface ParametersResponse {
  parameters: ParameterInfo[];
  script_available: boolean;
}

/** Convert snake_case to Title Case (e.g. "wall_thickness" → "Wall Thickness") */
function humaniseLabel(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const ParameterEditor: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { setActualFile } = useFile();

  const dataState = useSelector((state: RootState) => state.dataState);
  const userInformation = useSelector(
    (state: RootState) => state.userInterfaceState.userInformation
  );
  const cadLoading = useSelector((state: RootState) => state.cadState.cadLoading);

  const taskId = dataState.taskId;
  const isComplete = dataState.stepMetadata?.processingStatus === 'complete';

  const [expanded, setExpanded] = useState(true);
  const [parameters, setParameters] = useState<ParameterInfo[] | null>(null);
  const [scriptAvailable, setScriptAvailable] = useState(false);
  const [changes, setChanges] = useState<Record<string, number>>({});
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  // Fetch parameters when taskId and completion status are ready
  const fetchParameters = useCallback(async () => {
    if (!taskId || !isComplete) return;

    try {
      const resp = await fetch(`${API_URL}/tasks/${taskId}/parameters`, {
        credentials: 'include',
      });
      if (!resp.ok) {
        if (resp.status === 404) {
          // No parameters available — not an error
          setParameters(null);
          return;
        }
        throw new Error(`Failed to fetch parameters: ${resp.status}`);
      }
      const data: ParametersResponse = await resp.json();
      if (data.parameters.length > 0) {
        setParameters(data.parameters);
        setScriptAvailable(data.script_available);
        setChanges({});
        setFetchError(null);
      }
    } catch (err: any) {
      logger.warn('Could not fetch parameters:', err);
      setFetchError(err.message);
    }
  }, [taskId, isComplete]);

  useEffect(() => {
    fetchParameters();
  }, [fetchParameters]);

  // Count of changed parameters
  const changedCount = Object.keys(changes).length;

  const handleValueChange = (name: string, newValue: number, originalValue: number) => {
    if (newValue === originalValue) {
      // Revert to original — remove from changes
      setChanges((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    } else {
      setChanges((prev) => ({ ...prev, [name]: newValue }));
    }
  };

  const handleReset = () => {
    setChanges({});
  };

  const handleRegenerate = async () => {
    if (!taskId || !userInformation?.user?.user_id || changedCount === 0) return;

    setRegenerating(true);
    const portId = generateUuid();

    try {
      dispatch(setCadPending({ cadPending: true }));
      dispatch(setCadLoading({ cadLoading: true }));

      const resp = await fetch(`${GENERATION_URL}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          task_id: taskId,
          port_id: portId,
          user_id: userInformation.user.user_id,
          parameter_changes: changes,
        }),
      });

      if (!resp.ok) {
        throw new Error(`Regeneration failed: ${resp.statusText}`);
      }

      dispatch(authApi.util.invalidateTags([{ type: 'sessionData' }]));
      connectProgressStream(portId, 'cad', dispatch, setActualFile);
    } catch (err: any) {
      logger.error('Error starting regeneration:', err);
      dispatch(setCadLoading({ cadLoading: false }));
      dispatch(setCadPending({ cadPending: false }));
    } finally {
      setRegenerating(false);
    }
  };

  // Don't render if conditions aren't met
  if (!taskId || !isComplete || !parameters || parameters.length === 0 || !scriptAvailable) {
    return null;
  }

  return (
    <Box
      sx={{
        mt: 2,
        border: `1px solid ${borderSubtle}`,
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.5,
          borderBottom: expanded ? `1px solid ${borderSubtle}` : 'none',
          backgroundColor: bgHighlight,
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setExpanded((prev) => !prev)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tune sx={{ color: 'primary.main', fontSize: 20 }} />
          <Typography variant="subtitle1" fontWeight={600}>
            Model Parameters
          </Typography>
          {changedCount > 0 && (
            <Typography
              variant="caption"
              sx={{ color: 'primary.main', fontFamily: monoFontFamily }}
            >
              ({changedCount} changed)
            </Typography>
          )}
        </Box>
        <IconButton size="small" sx={{ color: 'text.secondary' }}>
          {expanded ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ p: 2 }}>
          {/* Parameter rows */}
          {parameters.map((param) => {
            const isChanged = param.name in changes;
            const currentValue = isChanged ? changes[param.name] : param.value;

            return (
              <Box
                key={param.name}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  mb: 1.5,
                  '&:last-child': { mb: 0 },
                }}
              >
                {/* Label */}
                <Typography
                  variant="body2"
                  sx={{
                    minWidth: 140,
                    fontFamily: monoFontFamily,
                    fontSize: '0.8rem',
                    color: 'text.secondary',
                  }}
                >
                  {humaniseLabel(param.name)}
                </Typography>

                {/* Number input */}
                <TextField
                  type="number"
                  size="small"
                  value={currentValue}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) {
                      handleValueChange(param.name, val, param.value);
                    }
                  }}
                  disabled={regenerating || cadLoading}
                  inputProps={{
                    step: param.value < 1 ? 0.1 : param.value < 10 ? 0.5 : 1,
                    style: { fontFamily: monoFontFamily, fontSize: '0.8rem' },
                  }}
                  sx={{
                    width: 100,
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': {
                        borderColor: isChanged ? 'primary.main' : borderSubtle,
                        borderWidth: isChanged ? 2 : 1,
                      },
                      '&:hover fieldset': {
                        borderColor: borderHover,
                      },
                    },
                  }}
                />

                {/* Unit */}
                <Typography
                  variant="caption"
                  sx={{
                    fontFamily: monoFontFamily,
                    color: 'text.secondary',
                    minWidth: 24,
                  }}
                >
                  mm
                </Typography>

                {/* Changed indicator */}
                {isChanged && (
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                      fontStyle: 'italic',
                      fontSize: '0.7rem',
                    }}
                  >
                    (was {param.value})
                  </Typography>
                )}
              </Box>
            );
          })}

          {/* Footer: change count + buttons */}
          {changedCount > 0 && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mt: 2,
                pt: 1.5,
                borderTop: `1px solid ${borderSubtle}`,
              }}
            >
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', fontFamily: monoFontFamily }}
              >
                {changedCount} parameter{changedCount !== 1 ? 's' : ''} changed
              </Typography>

              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<RestartAlt />}
                  onClick={handleReset}
                  disabled={regenerating || cadLoading}
                  sx={{ fontSize: '0.75rem' }}
                >
                  Reset All
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  endIcon={
                    regenerating || cadLoading ? (
                      <CircularProgress size={14} color="inherit" />
                    ) : (
                      <PlayArrow />
                    )
                  }
                  onClick={handleRegenerate}
                  disabled={regenerating || cadLoading}
                  sx={{
                    fontSize: '0.75rem',
                    boxShadow: `0 0 12px ${glowSubtle}`,
                  }}
                >
                  {regenerating || cadLoading ? 'Regenerating...' : 'Regenerate'}
                </Button>
              </Box>
            </Box>
          )}

          {fetchError && (
            <Typography
              variant="caption"
              sx={{ color: 'error.main', mt: 1, display: 'block' }}
            >
              {fetchError}
            </Typography>
          )}
        </Box>
      </Collapse>
    </Box>
  );
};
