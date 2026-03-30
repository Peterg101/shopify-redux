import React from 'react'
import { Box, Typography, Button, Paper } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import HomeIcon from '@mui/icons-material/Home'
import { glowMedium, borderHover } from '../../theme'

export const NotFoundPage = () => {
  const navigate = useNavigate()

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0A0E14',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 6,
          borderRadius: 3,
          textAlign: 'center',
          maxWidth: 480,
          backdropFilter: 'blur(12px)',
          background: 'rgba(19, 25, 32, 0.85)',
          border: `1px solid ${glowMedium}`,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 24px rgba(0, 229, 255, 0.05)',
        }}
      >
        <Typography
          variant="h1"
          sx={{
            fontWeight: 800,
            fontSize: '6rem',
            color: '#00E5FF',
            textShadow: '0 0 40px rgba(0, 229, 255, 0.4), 0 0 80px rgba(0, 229, 255, 0.2)',
            lineHeight: 1,
            mb: 2,
          }}
        >
          404
        </Typography>
        <Typography variant="h5" fontWeight={600} gutterBottom>
          Page Not Found
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          The page you're looking for doesn't exist or has been moved.
        </Typography>
        <Button
          variant="contained"
          size="large"
          startIcon={<HomeIcon />}
          onClick={() => navigate('/')}
          sx={{
            py: 1.4,
            px: 4,
            borderRadius: 2,
            fontWeight: 600,
            '&:hover': {
              boxShadow: `0 0 20px ${borderHover}`,
            },
          }}
        >
          Go Home
        </Button>
      </Paper>
    </Box>
  )
}
