import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  LinearProgress,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import ReplayIcon from '@mui/icons-material/Replay';
import CodeIcon from '@mui/icons-material/Code';
import UndoIcon from '@mui/icons-material/Undo';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../app/store';
import { BuildStep, StepExecutionResult, CadGenerationSettings } from '../../app/utility/interfaces';
import { setCadPending, setCadLoading, setCadOperationType } from '../../services/cadSlice';
import { setFileProperties, setAutoScaleOnLoad, setStepMetadata } from '../../services/dataSlice';
import { useFile } from '../../services/fileProvider';
import { authApi } from '../../services/authApi';
import { generateUuid } from '../../app/utility/collectionUtils';
import logger from '../../app/utility/logger';
import BuildPlanView from './BuildPlanView';
import {
  borderSubtle,
  bgHighlight,
  bgHighlightHover,
  glowSubtle,
  glowMedium,
  monoFontFamily,
  panelContainerSx,
  panelHeaderSx,
  statusColors,
} from '../../theme';

import {
  generateBuildPlan as apiFetchPlan,
  generateStep as apiFetchStep,
  executeCode as apiExecuteCode,
  saveStepScript as apiSaveStep,
  fetchPreviewUrl as apiFetchPreview,
} from '../../services/stepwiseApi';

const MEDIA_URL = process.env.REACT_APP_MEDIA_URL || 'http://localhost:1235';

interface StepwiseBuilderProps {
  taskId: string;
  userId: string;
  specText: string;
  settings: CadGenerationSettings;
  onComplete: () => void;
}

type BuildPhase = 'planning' | 'building' | 'complete';
type StepStatus = 'pending' | 'generating' | 'done' | 'error';

const StepwiseBuilder: React.FC<StepwiseBuilderProps> = ({
  taskId,
  userId,
  specText,
  settings,
  onComplete,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { setActualFile } = useFile();
  const previousBlobUrlRef = useRef<string | null>(null);

  const [phase, setPhase] = useState<BuildPhase>('planning');
  const [buildPlan, setBuildPlan] = useState<BuildStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [fullScript, setFullScript] = useState('');
  const [stepScripts, setStepScripts] = useState<string[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorValue, setEditorValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewJobId, setPreviewJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>([]);
  const [planLoading, setPlanLoading] = useState(false);

  // ─── API helpers ──────────────────────────────────────────────

  const fetchBuildPlan = useCallback(async () => {
    setPlanLoading(true);
    setError(null);
    try {
      const data = await apiFetchPlan(taskId, userId, specText, settings.process || 'fdm', settings.material_hint || 'plastic');
      const steps: BuildStep[] = data.steps ?? [];
      setBuildPlan(steps);
      setStepStatuses(steps.map(() => 'pending' as StepStatus));
    } catch (err: any) {
      logger.error('Failed to generate build plan:', err);
      setError(err.message || 'Failed to generate build plan');
    } finally {
      setPlanLoading(false);
    }
  }, [taskId, userId, specText, settings]);

  const executeStep = useCallback(async (stepIndex: number, scriptOverride?: string): Promise<StepExecutionResult | null> => {
    setIsGenerating(true);
    setError(null);
    setStepStatuses((prev) => {
      const next = [...prev];
      next[stepIndex] = 'generating';
      return next;
    });

    try {
      const stepDesc = buildPlan[stepIndex]?.description || `Step ${stepIndex + 1}`;
      const result: StepExecutionResult = await apiFetchStep(
        taskId, userId, scriptOverride ?? fullScript, stepDesc, stepIndex + 1,
        settings.process || 'fdm', settings.timeout_seconds || 30,
      );

      if (result.success) {
        setStepStatuses((prev) => {
          const next = [...prev];
          next[stepIndex] = 'done';
          return next;
        });

        if (result.full_script) setFullScript(result.full_script);
        if (result.new_code) {
          setStepScripts((prev) => {
            const next = [...prev];
            next[stepIndex] = result.new_code!;
            return next;
          });
        }

        // Load preview model
        if (result.job_id) {
          setPreviewJobId(result.job_id);
          await loadPreview(result.job_id, `step_${stepIndex + 1}`);
        }
      } else {
        setStepStatuses((prev) => {
          const next = [...prev];
          next[stepIndex] = 'error';
          return next;
        });
        setError(result.error || 'Step execution failed');
      }

      return result;
    } catch (err: any) {
      logger.error(`Step ${stepIndex + 1} execution error:`, err);
      setStepStatuses((prev) => {
        const next = [...prev];
        next[stepIndex] = 'error';
        return next;
      });
      setError(err.message || 'Step execution failed');
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [taskId, userId, buildPlan, stepScripts, fullScript, settings]);

  const loadPreview = async (jobId: string, fileName: string) => {
    try {
      dispatch(setCadOperationType({ cadOperationType: 'stepwise' }));
      dispatch(setCadPending({ cadPending: true }));
      dispatch(setCadLoading({ cadLoading: true }));

      const previewResp = await fetch(`${MEDIA_URL}/step/${jobId}/preview_url`);
      if (!previewResp.ok) throw new Error(`Preview URL failed: ${previewResp.status}`);
      const { url: presignedUrl } = await previewResp.json();
      if (!presignedUrl) throw new Error('No presigned URL returned');

      const glbResp = await fetch(presignedUrl);
      if (!glbResp.ok) throw new Error(`GLB fetch failed: ${glbResp.status}`);
      const glbBlob = await glbResp.blob();
      if (glbBlob.size === 0) throw new Error('GLB blob is empty');

      const glbFile = new File([glbBlob], `${fileName}.glb`, { type: 'model/gltf-binary' });
      if (previousBlobUrlRef.current) URL.revokeObjectURL(previousBlobUrlRef.current);
      const blobUrl = URL.createObjectURL(glbBlob);
      previousBlobUrlRef.current = blobUrl;

      setActualFile(glbFile);
      dispatch(setAutoScaleOnLoad({ autoScaleOnLoad: true }));
      dispatch(setFileProperties({
        selectedFile: blobUrl,
        selectedFileType: 'glb',
        fileNameBoxValue: fileName,
        taskId,
      }));
      dispatch(setStepMetadata({ jobId, processingStatus: 'complete' }));
      dispatch(authApi.util.invalidateTags([{ type: 'sessionData' }]));
    } catch (err: any) {
      logger.error('Failed to load step preview:', err);
      setError(err.message || 'Failed to load preview');
    } finally {
      dispatch(setCadLoading({ cadLoading: false }));
      dispatch(setCadPending({ cadPending: false }));
      dispatch(setCadOperationType({ cadOperationType: null }));
    }
  };

  const executeFromEditor = async () => {
    try {
      setIsGenerating(true);
      setError(null);

      const result: StepExecutionResult = await apiExecuteCode(
        taskId, userId, editorValue, settings.timeout_seconds || 30,
      );

      if (result.success) {
        setFullScript(editorValue);
        if (result.job_id) {
          setPreviewJobId(result.job_id);
          await loadPreview(result.job_id, `edited_step_${currentStep + 1}`);
        }
      } else {
        setError(result.error || 'Script execution failed');
      }
    } catch (err: any) {
      logger.error('Editor script execution error:', err);
      setError(err.message || 'Script execution failed');
    } finally {
      setIsGenerating(false);
    }
  };

  // ─── Lifecycle ────────────────────────────────────────────────

  useEffect(() => {
    fetchBuildPlan();
  }, [fetchBuildPlan]);

  // ─── Handlers ─────────────────────────────────────────────────

  const handleApprovePlan = () => {
    if (buildPlan.length === 0) return;
    setPhase('building');
    setCurrentStep(0);
    // Kick off first step
    executeStep(0);
  };

  const handleRegeneratePlan = () => {
    setBuildPlan([]);
    setStepStatuses([]);
    setCurrentStep(0);
    setFullScript('');
    setStepScripts([]);
    setError(null);
    fetchBuildPlan();
  };

  const handleApproveStep = async () => {
    const nextStep = currentStep + 1;
    if (nextStep >= buildPlan.length) {
      // Save the final script before completing
      try {
        await apiSaveStep(taskId, fullScript, specText, 'Stepwise build complete');
      } catch (err: any) {
        logger.error('Failed to save final stepwise script:', err);
      }
      setPhase('complete');
      onComplete();
    } else {
      setCurrentStep(nextStep);
      setEditorOpen(false);
      setEditorValue('');
      executeStep(nextStep);
    }
  };

  const handleRegenerateStep = () => {
    setError(null);
    executeStep(currentStep);
  };

  const handleEditCode = () => {
    setEditorValue(fullScript);
    setEditorOpen(true);
  };

  const handleUndo = () => {
    if (currentStep <= 0) return;
    const prevStep = currentStep - 1;

    // Mark the current step (the one being reverted) as pending
    setStepStatuses((prev) => {
      const next = [...prev];
      next[currentStep] = 'pending';
      return next;
    });

    setCurrentStep(prevStep);
    setEditorOpen(false);
    setEditorValue('');

    // Trim scripts and reconstruct from current state via callback
    setStepScripts((prev) => {
      const trimmed = prev.slice(0, prevStep + 1);
      const prevScriptJoined = trimmed.join('\n');
      if (prevScriptJoined) {
        setFullScript(prevScriptJoined);
      }
      executeStep(prevStep, prevScriptJoined || undefined);
      return trimmed;
    });
  };

  // ─── Render helpers ───────────────────────────────────────────

  const statusIcon = (status: StepStatus) => {
    switch (status) {
      case 'done': return '\u2713';
      case 'generating': return '\u25B6';
      case 'error': return '\u2717';
      default: return '\u00B7';
    }
  };

  const statusColor = (status: StepStatus) => {
    switch (status) {
      case 'done': return statusColors.accepted;
      case 'generating': return 'primary.main';
      case 'error': return 'error.main';
      default: return 'text.secondary';
    }
  };

  // ─── Planning phase ───────────────────────────────────────────

  if (phase === 'planning') {
    if (planLoading) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
          <CircularProgress size={32} sx={{ color: 'primary.main' }} />
          <Typography variant="body2" color="text.secondary">
            Generating build plan...
          </Typography>
        </Box>
      );
    }

    if (buildPlan.length === 0 && error) {
      return (
        <Box sx={{ py: 2, px: 2 }}>
          <Typography variant="body2" color="error.main" gutterBottom>
            {error}
          </Typography>
          <Button size="small" variant="outlined" onClick={handleRegeneratePlan}>
            Retry
          </Button>
        </Box>
      );
    }

    if (buildPlan.length > 0) {
      return (
        <BuildPlanView
          steps={buildPlan}
          onApprove={handleApprovePlan}
          onRegenerate={handleRegeneratePlan}
          disabled={planLoading}
        />
      );
    }

    // Plan loaded but empty — no steps decomposed
    return (
      <Box sx={{ py: 2, px: 2 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Could not decompose this part into steps. Try Quick Generate instead.
        </Typography>
        <Button size="small" variant="outlined" onClick={handleRegeneratePlan}>
          Retry
        </Button>
      </Box>
    );
  }

  // ─── Complete phase ───────────────────────────────────────────

  if (phase === 'complete') {
    return (
      <Box sx={{ py: 3, px: 2, textAlign: 'center' }}>
        <CheckIcon sx={{ fontSize: 40, color: statusColors.accepted, mb: 1 }} />
        <Typography variant="body1" fontWeight={600}>
          Build complete
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          All {buildPlan.length} steps finished successfully.
        </Typography>
      </Box>
    );
  }

  // ─── Building phase ───────────────────────────────────────────

  const progress = buildPlan.length > 0 ? ((currentStep + (stepStatuses[currentStep] === 'done' ? 1 : 0)) / buildPlan.length) * 100 : 0;

  return (
    <Box sx={{ display: 'flex', gap: 2, minHeight: 300 }}>
      {/* ── Left sidebar: step list ── */}
      <Paper
        sx={{
          ...panelContainerSx,
          width: 260,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box sx={panelHeaderSx}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ flex: 1 }}>
            Build Steps
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', fontFamily: monoFontFamily }}
          >
            {stepStatuses.filter((s) => s === 'done').length}/{buildPlan.length}
          </Typography>
        </Box>

        <Box sx={{ flex: 1, overflowY: 'auto', py: 0.5 }}>
          {buildPlan.map((step, idx) => {
            const status = stepStatuses[idx] ?? 'pending';
            const isCurrent = idx === currentStep;

            return (
              <Box
                key={step.step}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 2,
                  py: 0.75,
                  backgroundColor: isCurrent ? bgHighlight : 'transparent',
                  borderLeft: isCurrent ? '2px solid' : '2px solid transparent',
                  borderLeftColor: isCurrent ? 'primary.main' : 'transparent',
                  opacity: status === 'pending' ? 0.5 : 1,
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    backgroundColor: bgHighlightHover,
                  },
                }}
              >
                {/* Status icon */}
                <Typography
                  sx={{
                    fontSize: 14,
                    minWidth: 18,
                    textAlign: 'center',
                    color: statusColor(status),
                    fontWeight: 700,
                  }}
                >
                  {statusIcon(status)}
                </Typography>

                {/* Step number */}
                <Typography
                  variant="caption"
                  sx={{
                    fontFamily: monoFontFamily,
                    color: 'text.secondary',
                    minWidth: 16,
                  }}
                >
                  {step.step}
                </Typography>

                {/* Feature name */}
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: monoFontFamily,
                    fontSize: '0.78rem',
                    color: isCurrent ? 'primary.main' : 'text.primary',
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {step.feature}
                </Typography>
              </Box>
            );
          })}
        </Box>

        {/* Progress bar */}
        <Box sx={{ px: 2, py: 1, borderTop: `1px solid ${borderSubtle}` }}>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 4,
              borderRadius: 2,
              backgroundColor: 'rgba(0,229,255,0.08)',
              '& .MuiLinearProgress-bar': {
                backgroundColor: 'primary.main',
                borderRadius: 2,
              },
            }}
          />
        </Box>
      </Paper>

      {/* ── Right main area ── */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {/* Current step info */}
        {buildPlan[currentStep] && (
          <Paper sx={{ ...panelContainerSx, p: 2 }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ color: 'primary.main' }}>
              Step {buildPlan[currentStep].step}: {buildPlan[currentStep].feature}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {buildPlan[currentStep].description}
            </Typography>
            {isGenerating && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <CircularProgress size={16} sx={{ color: 'primary.main' }} />
                <Typography variant="caption" color="text.secondary">
                  Generating step...
                </Typography>
              </Box>
            )}
          </Paper>
        )}

        {/* 3D preview area placeholder — the existing viewer in the page handles display
            via setActualFile / setFileProperties dispatched in loadPreview */}
        <Paper
          sx={{
            ...panelContainerSx,
            flex: 1,
            minHeight: 120,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {previewJobId ? (
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: monoFontFamily }}>
              Preview loaded (job: {previewJobId.slice(0, 8)}...)
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {isGenerating ? 'Generating preview...' : 'Preview will appear after step execution'}
            </Typography>
          )}
        </Paper>

        {/* Action buttons */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            size="small"
            variant="contained"
            color="primary"
            startIcon={<CheckIcon sx={{ fontSize: 14 }} />}
            onClick={handleApproveStep}
            disabled={isGenerating || stepStatuses[currentStep] !== 'done'}
            sx={{ boxShadow: `0 0 12px ${glowMedium}` }}
          >
            {buildPlan.length > 0 ? (currentStep >= buildPlan.length - 1 ? 'Finish' : 'Approve & Next') : 'No Steps'}
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<ReplayIcon sx={{ fontSize: 14 }} />}
            onClick={handleRegenerateStep}
            disabled={isGenerating}
          >
            Regenerate
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<CodeIcon sx={{ fontSize: 14 }} />}
            onClick={handleEditCode}
            disabled={isGenerating || !fullScript}
          >
            Edit Code
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<UndoIcon sx={{ fontSize: 14 }} />}
            onClick={handleUndo}
            disabled={isGenerating || currentStep <= 0}
          >
            Undo
          </Button>
        </Box>

        {/* Code editor */}
        {editorOpen && (
          <Paper sx={{ ...panelContainerSx, p: 0 }}>
            <Box sx={{ ...panelHeaderSx, py: 1 }}>
              <CodeIcon sx={{ fontSize: 16, color: 'primary.main' }} />
              <Typography variant="caption" fontWeight={600} sx={{ flex: 1 }}>
                Script Editor
              </Typography>
              <Button
                size="small"
                variant="contained"
                startIcon={<PlayArrowIcon sx={{ fontSize: 14 }} />}
                onClick={executeFromEditor}
                disabled={isGenerating}
                sx={{ fontSize: '0.7rem', py: 0.25, px: 1 }}
              >
                Run
              </Button>
            </Box>
            <TextField
              multiline
              minRows={8}
              maxRows={20}
              value={editorValue}
              onChange={(e) => setEditorValue(e.target.value)}
              fullWidth
              sx={{
                '& .MuiInputBase-root': {
                  fontFamily: monoFontFamily,
                  fontSize: '0.78rem',
                  borderRadius: 0,
                },
                '& .MuiOutlinedInput-notchedOutline': {
                  border: 'none',
                },
              }}
            />
          </Paper>
        )}

        {/* Error display */}
        {error && (
          <Paper
            sx={{
              ...panelContainerSx,
              p: 1.5,
              borderColor: 'error.main',
              backgroundColor: 'rgba(255,82,82,0.06)',
            }}
          >
            <Typography variant="caption" color="error.main">
              {error}
            </Typography>
          </Paper>
        )}
      </Box>
    </Box>
  );
};

export default StepwiseBuilder;
