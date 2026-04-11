import React, { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Divider,
  TextField,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import {
  panelContainerSx,
  panelHeaderSx,
  panelBodySx,
  borderSubtle,
  glowMedium,
} from '../../../theme';

interface SpecConfirmationProps {
  spec: Record<string, any>;
  onApprove: (spec: Record<string, any>) => void;
  onEdit: () => void;
}

const SpecConfirmation: React.FC<SpecConfirmationProps> = ({ spec, onApprove, onEdit }) => {
  const [editableSpec, setEditableSpec] = useState(spec);
  const [isEditing, setIsEditing] = useState(false);

  const dims = editableSpec.dimensions;
  const features = editableSpec.features || [];

  const updateDimension = (key: string, value: string) => {
    const num = parseFloat(value);
    setEditableSpec((prev: Record<string, any>) => ({
      ...prev,
      dimensions: { ...prev.dimensions, [key]: isNaN(num) ? value : num },
    }));
  };

  return (
    <Box sx={{ ...panelContainerSx, boxShadow: `0 0 16px ${glowMedium}` }}>
      {/* Header */}
      <Box sx={panelHeaderSx}>
        <CheckCircleIcon sx={{ fontSize: 18, color: 'primary.main' }} />
        <Typography variant="subtitle2" fontWeight={600} sx={{ color: 'primary.main', flex: 1 }}>
          Design Specification
        </Typography>
        {!isEditing && (
          <Button
            size="small"
            startIcon={<EditIcon sx={{ fontSize: 14 }} />}
            onClick={() => setIsEditing(true)}
            sx={{ fontSize: '0.75rem', minWidth: 0, p: 0.5 }}
          >
            Edit
          </Button>
        )}
      </Box>

      {/* Body */}
      <Box sx={panelBodySx}>
        {/* Description */}
        <Typography variant="body2" fontWeight={600} gutterBottom>
          {editableSpec.description}
        </Typography>
        {editableSpec.purpose && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            {editableSpec.purpose}
          </Typography>
        )}

        {/* Dimensions */}
        {dims && (
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              Dimensions ({dims.units || 'mm'})
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 0.5, alignItems: 'center' }}>
              {['length', 'width', 'height'].map((key) => (
                <React.Fragment key={key}>
                  {isEditing ? (
                    <TextField
                      size="small"
                      label={key}
                      type="number"
                      value={dims[key] ?? ''}
                      onChange={(e) => updateDimension(key, e.target.value)}
                      sx={{ width: 80, '& .MuiInputBase-input': { py: 0.5, fontSize: '0.8rem' } }}
                    />
                  ) : (
                    <Chip
                      label={`${key}: ${dims[key] ?? '?'}`}
                      size="small"
                      variant="outlined"
                      sx={{ borderColor: borderSubtle, fontSize: '0.75rem' }}
                    />
                  )}
                </React.Fragment>
              ))}
            </Box>
          </Box>
        )}

        {/* Wall thickness */}
        {editableSpec.wall_thickness && (
          <Box sx={{ mb: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Wall: {editableSpec.wall_thickness}mm
            </Typography>
          </Box>
        )}

        {/* Features */}
        {features.length > 0 && (
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              Features
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              {features.map((f: any, i: number) => (
                <Typography key={i} variant="caption" sx={{ display: 'block', ml: 1, lineHeight: 1.8 }}>
                  {f.description || f.type}
                  {f.count ? ` x${f.count}` : ''}
                  {f.diameter ? ` (${f.diameter}mm)` : ''}
                  {f.position ? ` - ${f.position}` : ''}
                </Typography>
              ))}
            </Box>
          </Box>
        )}

        {/* Process + Material */}
        <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
          {editableSpec.process && (
            <Chip
              label={editableSpec.process.toUpperCase()}
              size="small"
              color="primary"
              sx={{ fontSize: '0.7rem' }}
            />
          )}
          {editableSpec.material && (
            <Chip
              label={editableSpec.material}
              size="small"
              variant="outlined"
              sx={{ borderColor: borderSubtle, fontSize: '0.7rem' }}
            />
          )}
          {editableSpec.tolerances && (
            <Chip
              label={editableSpec.tolerances}
              size="small"
              variant="outlined"
              sx={{ borderColor: borderSubtle, fontSize: '0.7rem' }}
            />
          )}
        </Box>

        {/* Notes */}
        {editableSpec.notes && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            {editableSpec.notes}
          </Typography>
        )}

        <Divider sx={{ my: 1.5 }} />

        {/* Action buttons */}
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => { setIsEditing(false); onEdit(); }}
          >
            Continue Chat
          </Button>
          <Button
            size="small"
            variant="contained"
            color="primary"
            startIcon={<PrecisionManufacturingIcon sx={{ fontSize: 16 }} />}
            onClick={() => onApprove(editableSpec)}
            sx={{ boxShadow: `0 0 12px ${glowMedium}` }}
          >
            Approve & Generate
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default SpecConfirmation;
