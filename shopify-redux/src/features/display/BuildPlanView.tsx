import React from 'react';
import {
  Box,
  Button,
  Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ReplayIcon from '@mui/icons-material/Replay';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import { BuildStep } from '../../app/utility/interfaces';
import {
  borderSubtle,
  bgHighlight,
  bgHighlightHover,
  glowMedium,
  monoFontFamily,
  panelContainerSx,
  panelHeaderSx,
} from '../../theme';

interface BuildPlanViewProps {
  steps: BuildStep[];
  onApprove: () => void;
  onRegenerate: () => void;
  disabled?: boolean;
}

function stepIcon(feature: string): string {
  const lower = feature.toLowerCase();
  if (lower.includes('base') || lower.includes('body')) return '\u25FC';
  if (lower.includes('hole') || lower.includes('bore')) return '\u25CE';
  if (lower.includes('fillet') || lower.includes('round')) return '\u25E0';
  if (lower.includes('chamfer')) return '\u25C7';
  if (lower.includes('cut') || lower.includes('slot') || lower.includes('pocket')) return '\u2702';
  if (lower.includes('shell')) return '\u25A1';
  if (lower.includes('extrude') || lower.includes('boss')) return '\u25B2';
  return '\u2022';
}

const BuildPlanView: React.FC<BuildPlanViewProps> = ({ steps, onApprove, onRegenerate, disabled }) => {
  return (
    <Box sx={{ ...panelContainerSx, boxShadow: `0 0 16px ${glowMedium}` }}>
      {/* Header */}
      <Box sx={panelHeaderSx}>
        <AccountTreeIcon sx={{ fontSize: 18, color: 'primary.main' }} />
        <Typography variant="subtitle2" fontWeight={600} sx={{ color: 'primary.main', flex: 1 }}>
          Build Plan
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', fontFamily: monoFontFamily }}
        >
          {steps.length} steps
        </Typography>
      </Box>

      {/* Step list */}
      <Box sx={{ py: 0.5 }}>
        {steps.map((step) => (
          <Box
            key={step.step}
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1.5,
              px: 2,
              py: 1,
              transition: 'background-color 0.15s ease',
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
                color: 'primary.main',
                minWidth: 24,
                textAlign: 'right',
                fontWeight: 700,
                mt: 0.25,
              }}
            >
              {step.step}
            </Typography>

            {/* Icon */}
            <Typography sx={{ fontSize: 14, minWidth: 18, textAlign: 'center', mt: 0.25 }}>
              {stepIcon(step.feature)}
            </Typography>

            {/* Feature name + description */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="body2"
                sx={{
                  fontFamily: monoFontFamily,
                  fontSize: '0.8rem',
                  color: 'primary.main',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {step.feature}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.4 }}
              >
                {step.description}
              </Typography>
              {step.depends_on.length > 0 && (
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    fontFamily: monoFontFamily,
                    fontSize: '0.65rem',
                    opacity: 0.6,
                  }}
                >
                  depends on: {step.depends_on.join(', ')}
                </Typography>
              )}
            </Box>
          </Box>
        ))}
      </Box>

      {/* Action buttons */}
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          justifyContent: 'flex-end',
          px: 2,
          py: 1.5,
          borderTop: `1px solid ${borderSubtle}`,
          backgroundColor: bgHighlight,
        }}
      >
        <Button
          size="small"
          variant="outlined"
          startIcon={<ReplayIcon sx={{ fontSize: 14 }} />}
          onClick={onRegenerate}
          disabled={disabled}
        >
          Regenerate Plan
        </Button>
        <Button
          size="small"
          variant="contained"
          color="primary"
          startIcon={<CheckCircleOutlineIcon sx={{ fontSize: 16 }} />}
          onClick={onApprove}
          disabled={disabled}
          sx={{ boxShadow: `0 0 12px ${glowMedium}` }}
        >
          Approve Plan
        </Button>
      </Box>
    </Box>
  );
};

export default BuildPlanView;
