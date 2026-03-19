import { useState, useCallback } from 'react'

interface SnackbarState {
  open: boolean
  message: string
  severity: 'success' | 'error' | 'warning' | 'info'
}

export const useSnackbar = () => {
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success',
  })

  const showSuccess = useCallback((message: string) => {
    setSnackbar({ open: true, message, severity: 'success' })
  }, [])

  const showError = useCallback((message: string) => {
    setSnackbar({ open: true, message, severity: 'error' })
  }, [])

  const close = useCallback(() => {
    setSnackbar((prev) => ({ ...prev, open: false }))
  }, [])

  return { snackbar, showSuccess, showError, close }
}
