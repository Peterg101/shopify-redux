import React, { useState, useRef } from 'react';
import { Box, IconButton, TextField, Tooltip } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import BrushIcon from '@mui/icons-material/Brush';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import CloseIcon from '@mui/icons-material/Close';
import { borderSubtle, glowMedium } from '../../../theme';

interface ChatInputProps {
  onSend: (content: string, images: string[]) => void;
  onRefine?: (content: string, images: string[]) => void;
  disabled: boolean;
  placeholder?: string;
  onToggleSketch: () => void;
  sketchOpen: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  onRefine,
  disabled,
  placeholder = 'Describe what you want to build...',
  onToggleSketch,
  sketchOpen,
}) => {
  const [value, setValue] = useState('');
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed && pendingImages.length === 0) return;
    onSend(trimmed || '(attached image)', pendingImages);
    setValue('');
    setPendingImages([]);
  };

  const handleRefineClick = () => {
    if (!onRefine) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    onRefine(trimmed, pendingImages);
    setValue('');
    setPendingImages([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !disabled) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setPendingImages((prev) => [...prev, dataUrl]);
      };
      reader.readAsDataURL(file);
    });

    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Box>
      {/* Pending image previews */}
      {pendingImages.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, px: 1, pt: 1, flexWrap: 'wrap' }}>
          {pendingImages.map((img, i) => (
            <Box key={i} sx={{ position: 'relative' }}>
              <Box
                component="img"
                src={img}
                alt={`Upload ${i + 1}`}
                sx={{
                  width: 60,
                  height: 60,
                  objectFit: 'cover',
                  borderRadius: 1,
                  border: `1px solid ${borderSubtle}`,
                }}
              />
              <IconButton
                size="small"
                onClick={() => removeImage(i)}
                sx={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  width: 18,
                  height: 18,
                  bgcolor: 'error.main',
                  '&:hover': { bgcolor: 'error.dark' },
                }}
              >
                <CloseIcon sx={{ fontSize: 12, color: 'white' }} />
              </IconButton>
            </Box>
          ))}
        </Box>
      )}

      {/* Input row */}
      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-end', p: 1 }}>
        {/* Toolbar buttons */}
        <Tooltip title={sketchOpen ? 'Close sketch' : 'Open sketch pad'}>
          <IconButton
            size="small"
            onClick={onToggleSketch}
            sx={{
              color: sketchOpen ? 'primary.main' : 'text.secondary',
              p: 0.75,
            }}
          >
            <BrushIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>

        <Tooltip title="Upload photo">
          <IconButton
            size="small"
            onClick={() => fileInputRef.current?.click()}
            sx={{ color: 'text.secondary', p: 0.75 }}
          >
            <CameraAltIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={handlePhotoSelect}
        />

        {/* Text input */}
        <TextField
          fullWidth
          size="small"
          multiline
          minRows={1}
          maxRows={3}
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          sx={{
            '& .MuiOutlinedInput-root': {
              '&.Mui-focused fieldset': {
                borderColor: 'primary.main',
                boxShadow: `0 0 8px ${glowMedium}`,
              },
            },
          }}
        />

        {/* Send (chat) button */}
        <Tooltip title={onRefine ? 'Chat about the model' : 'Send'}>
          <IconButton
            onClick={handleSend}
            disabled={disabled || (!value.trim() && pendingImages.length === 0)}
            sx={{
              color: 'primary.main',
              p: 0.75,
              '&:hover': { boxShadow: `0 0 8px ${glowMedium}` },
              '&.Mui-disabled': { color: 'text.disabled' },
            }}
          >
            <SendIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>

        {/* Refine button — only in refinement mode */}
        {onRefine && (
          <Tooltip title="Apply change to model">
            <IconButton
              onClick={handleRefineClick}
              disabled={disabled || !value.trim()}
              sx={{
                color: 'secondary.main',
                p: 0.75,
                '&:hover': { boxShadow: `0 0 8px rgba(118, 255, 3, 0.3)` },
                '&.Mui-disabled': { color: 'text.disabled' },
              }}
            >
              <AutoFixHighIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
};

export default ChatInput;
