import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  CircularProgress,
} from '@mui/material'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  severity?: 'error' | 'warning' | 'info'
  isLoading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmDialog = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  severity = 'warning',
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  const colorMap = {
    error: '#FF5252',
    warning: '#FF9100',
    info: '#00E5FF',
  }
  const color = colorMap[severity]

  return (
    <Dialog open={open} onClose={!isLoading ? onCancel : undefined} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ color }}>{title}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onCancel} disabled={isLoading} sx={{ fontWeight: 600 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={onConfirm}
          disabled={isLoading}
          sx={{
            fontWeight: 600,
            minWidth: 100,
            backgroundColor: color,
            '&:hover': { backgroundColor: color, opacity: 0.9 },
          }}
        >
          {isLoading ? <CircularProgress size={20} sx={{ color: 'inherit' }} /> : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
