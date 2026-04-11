import React, { useState } from 'react';
import {
  Box,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Switch,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AccountTree,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../../app/store';
import { CadFeature } from '../../app/utility/interfaces';
import { setCadPending, setCadLoading, setCadOperationType } from '../../services/cadSlice';
import { setStepMetadata } from '../../services/dataSlice';
import { useFile } from '../../services/fileProvider';
import { connectProgressStream } from '../../services/progressStream';
import { generateUuid } from '../../app/utility/collectionUtils';
import {
  borderSubtle,
  borderHover,
  bgHighlight,
  bgHighlightHover,
  glowSubtle,
  monoFontFamily,
  panelContainerSx,
  panelHeaderSx,
} from '../../theme';
import logger from '../../app/utility/logger';

const GENERATION_URL = process.env.REACT_APP_GENERATION_URL || 'http://localhost:1234';

function featureIcon(type: string): string {
  switch (type) {
    case 'box': return '◼';
    case 'cylinder': return '⊙';
    case 'sphere': return '○';
    case 'hole': case 'blind_hole': return '◎';
    case 'counterbore': case 'countersink': return '⊘';
    case 'fillet': return '◠';
    case 'fillet_failed': return '⚠';
    case 'chamfer': return '◇';
    case 'cut': return '✂';
    case 'shell': return '□';
    case 'slot': case 'pocket': case 'groove': return '▭';
    case 'boss': case 'extrusion': return '▲';
    default: return '•';
  }
}

function formatDim(feature: CadFeature): string {
  const d = feature.dimensions;
  if (!d) return '';
  if (d.diameter) return `⌀${d.diameter}`;
  if (d.radius) return `R${d.radius}`;
  if (d.length && d.width && d.height) return `${d.length}×${d.width}×${d.height}`;
  if (d.length && d.width) return `${d.length}×${d.width}`;
  if (d.thickness) return `t${d.thickness}`;
  return '';
}

/** Compute which tags would be cascaded if the given tags are suppressed. */
function resolveDependencies(features: CadFeature[], tagsToSuppress: Set<string>): Set<string> {
  const all = new Set(tagsToSuppress);
  let changed = true;
  while (changed) {
    changed = false;
    for (const f of features) {
      if (!all.has(f.tag) && f.depends_on?.some(d => all.has(d))) {
        all.add(f.tag);
        changed = true;
      }
    }
  }
  return all;
}

export const FeatureTree: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { setActualFile } = useFile();

  const dataState = useSelector((state: RootState) => state.dataState);
  const userInfo = useSelector((state: RootState) => state.userInterfaceState.userInformation);
  const cadPending = useSelector((state: RootState) => state.cadState.cadPending);
  const cadLoading = useSelector((state: RootState) => state.cadState.cadLoading);

  const taskId = dataState.taskId;
  const isComplete = dataState.stepMetadata?.processingStatus === 'complete';
  const features = dataState.stepMetadata?.features ?? [];
  const suppressedList = dataState.stepMetadata?.suppressed ?? [];

  const [expanded, setExpanded] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<{
    tag: string;
    cascaded: string[];
    suppress: boolean;
  } | null>(null);

  const isProcessing = cadPending || cadLoading;

  const handleToggle = (tag: string, currentlyActive: boolean) => {
    if (isProcessing || !taskId) return;

    const suppressedArr = dataState.stepMetadata?.suppressed ?? [];
    const suppressedSet = new Set(suppressedArr);

    if (currentlyActive) {
      // Suppressing — check for cascade
      const wouldSuppress = resolveDependencies(features, new Set([tag]));
      const cascaded = Array.from(wouldSuppress).filter(t => t !== tag && !suppressedSet.has(t));
      if (cascaded.length > 0) {
        setConfirmDialog({ tag, cascaded, suppress: true });
        return;
      }
      suppressedSet.add(tag);
      executeSuppression(suppressedSet);
    } else {
      // Unsuppressing
      suppressedSet.delete(tag);
      // Also unsuppress anything that was only suppressed because of this tag
      for (const f of features) {
        if (suppressedSet.has(f.tag) && f.depends_on?.includes(tag)) {
          const otherDeps = (f.depends_on ?? []).filter(d => d !== tag);
          if (otherDeps.every(d => !suppressedSet.has(d))) {
            suppressedSet.delete(f.tag);
          }
        }
      }
      executeSuppression(suppressedSet);
    }
  };

  const confirmCascade = () => {
    if (!confirmDialog) return;
    const suppressedArr = dataState.stepMetadata?.suppressed ?? [];
    const newSuppressed = new Set(suppressedArr);
    const all = resolveDependencies(features, new Set([confirmDialog.tag]));
    for (const t of Array.from(all)) newSuppressed.add(t);
    setConfirmDialog(null);
    executeSuppression(newSuppressed);
  };

  const executeSuppression = async (suppressedTags: Set<string>) => {
    if (!taskId || !userInfo?.user?.user_id) return;
    const portId = generateUuid();

    try {
      dispatch(setCadOperationType({ cadOperationType: 'suppress' }));
      dispatch(setCadPending({ cadPending: true }));
      dispatch(setCadLoading({ cadLoading: true }));

      const resp = await fetch(`${GENERATION_URL}/suppress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          task_id: taskId,
          port_id: portId,
          user_id: userInfo.user.user_id,
          suppressed_tags: Array.from(suppressedTags),
        }),
      });

      if (!resp.ok) throw new Error(`Suppress failed: ${resp.statusText}`);

      // Optimistically update suppressed list
      dispatch(setStepMetadata({ suppressed: Array.from(suppressedTags) }));
      connectProgressStream(portId, 'cad', dispatch, setActualFile);
    } catch (err: any) {
      logger.error('Suppression error:', err);
      dispatch(setCadLoading({ cadLoading: false }));
      dispatch(setCadPending({ cadPending: false }));
    }
  };

  if (!taskId || !isComplete) return null;
  if (features.length === 0) {
    return (
      <Box sx={{ ...panelContainerSx, mt: 2 }}>
        <Box sx={panelHeaderSx}>
          <AccountTree sx={{ color: 'primary.main', fontSize: 20 }} />
          <Typography variant="subtitle1" fontWeight={600}>Design History</Typography>
        </Box>
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No feature data available. Regenerate the model to enable the feature tree.
          </Typography>
        </Box>
      </Box>
    );
  }

  const sortedFeatures = [...features].sort((a, b) => (a.step ?? 0) - (b.step ?? 0));

  return (
    <>
      <Box sx={{ ...panelContainerSx, mt: 2 }}>
        {/* Header */}
        <Box
          sx={{
            ...panelHeaderSx,
            cursor: 'pointer',
            userSelect: 'none',
            '&:hover': { backgroundColor: bgHighlightHover },
          }}
          onClick={() => setExpanded(!expanded)}
        >
          <AccountTree sx={{ color: 'primary.main', fontSize: 20 }} />
          <Typography variant="subtitle1" fontWeight={600} sx={{ flex: 1 }}>
            Design History
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', mr: 1, fontFamily: monoFontFamily }}>
            {features.length} features
          </Typography>
          {expanded ? <ExpandLess sx={{ color: 'text.secondary' }} /> : <ExpandMore sx={{ color: 'text.secondary' }} />}
        </Box>

        {/* Feature list */}
        <Collapse in={expanded}>
          <Box sx={{ py: 0.5 }}>
            {sortedFeatures.map((f) => {
              const isSuppressed = suppressedList.includes(f.tag);
              const isBase = f.step === 1;
              const isFailed = f.type.endsWith('_failed');
              const dim = formatDim(f);

              return (
                <Box
                  key={f.tag}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 2,
                    py: 0.75,
                    opacity: isSuppressed ? 0.4 : 1,
                    transition: 'opacity 0.2s ease, background-color 0.15s ease',
                    '&:hover': {
                      backgroundColor: bgHighlight,
                    },
                  }}
                >
                  {/* Step number */}
                  <Typography
                    variant="caption"
                    sx={{
                      fontFamily: monoFontFamily,
                      color: 'text.secondary',
                      minWidth: 20,
                      textAlign: 'right',
                    }}
                  >
                    {f.step ?? '?'}
                  </Typography>

                  {/* Toggle switch */}
                  <Tooltip title={isBase ? 'Base body cannot be suppressed' : isSuppressed ? 'Enable feature' : 'Suppress feature'}>
                    <span>
                      <Switch
                        size="small"
                        checked={!isSuppressed}
                        disabled={isBase || isProcessing}
                        onChange={() => handleToggle(f.tag, !isSuppressed)}
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': {
                            color: 'primary.main',
                          },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                            backgroundColor: 'primary.main',
                          },
                        }}
                      />
                    </span>
                  </Tooltip>

                  {/* Feature icon */}
                  <Typography sx={{ fontSize: 14, minWidth: 18, textAlign: 'center' }}>
                    {featureIcon(f.type)}
                  </Typography>

                  {/* Tag name */}
                  <Typography
                    variant="body2"
                    sx={{
                      fontFamily: monoFontFamily,
                      fontSize: '0.8rem',
                      color: isFailed ? 'error.main' : isSuppressed ? 'text.disabled' : 'primary.main',
                      textDecoration: isSuppressed ? 'line-through' : 'none',
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {f.tag}
                  </Typography>

                  {/* Type + dimensions */}
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                      fontFamily: monoFontFamily,
                      fontSize: '0.7rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {f.type.replace('_failed', '')} {dim}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Collapse>
      </Box>

      {/* Cascade confirmation dialog */}
      <Dialog
        open={!!confirmDialog}
        onClose={() => setConfirmDialog(null)}
        PaperProps={{ sx: { borderRadius: 3, border: `1px solid ${borderSubtle}` } }}
      >
        <DialogTitle sx={{ fontSize: '1rem', fontWeight: 600 }}>
          Cascade Suppression
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Suppressing <strong>{confirmDialog?.tag}</strong> will also suppress these dependent features:
          </Typography>
          <Box sx={{ pl: 2 }}>
            {confirmDialog?.cascaded.map(t => (
              <Typography key={t} variant="body2" sx={{ fontFamily: monoFontFamily, color: 'warning.main', fontSize: '0.85rem' }}>
                • {t}
              </Typography>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog(null)} size="small">Cancel</Button>
          <Button onClick={confirmCascade} variant="contained" size="small">
            Suppress All
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
