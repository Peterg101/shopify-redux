import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Box, Typography, Button } from '@mui/material'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import logger from '../../app/utility/logger'

interface Props {
  children: ReactNode
  fallbackMessage?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            py: 8,
            gap: 2,
            textAlign: 'center',
          }}
        >
          <ErrorOutlineIcon sx={{ fontSize: 64, color: 'error.main', opacity: 0.7 }} />
          <Typography variant="h6" color="text.secondary">
            {this.props.fallbackMessage ?? 'Something went wrong.'}
          </Typography>
          <Button variant="outlined" onClick={this.handleRetry}>
            Try Again
          </Button>
        </Box>
      )
    }

    return this.props.children
  }
}
