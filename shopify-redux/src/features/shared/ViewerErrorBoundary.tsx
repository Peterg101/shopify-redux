import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Box, Typography, Button } from '@mui/material'
import ViewInArIcon from '@mui/icons-material/ViewInAr'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ViewerErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('3D Viewer error:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false })
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
            height: '100%',
            minHeight: 300,
            gap: 2,
          }}
        >
          <ViewInArIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.5 }} />
          <Typography variant="body1" color="text.secondary">
            Unable to render 3D viewer.
          </Typography>
          <Button variant="outlined" size="small" onClick={this.handleRetry}>
            Retry
          </Button>
        </Box>
      )
    }

    return this.props.children
  }
}
