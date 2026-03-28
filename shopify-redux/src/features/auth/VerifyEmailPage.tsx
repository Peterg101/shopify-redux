import React, { useEffect, useState } from 'react';
import { Box, Paper, Typography, Button, Alert, CircularProgress } from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useResendVerificationMutation } from '../../services/authApi';
import { monoFontFamily } from '../../theme';

type VerifyState = 'loading' | 'success' | 'error';

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [resend, { isLoading: resending }] = useResendVerificationMutation();

  const [status, setStatus] = useState<VerifyState>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('No verification token provided.');
      return;
    }

    const verifyEmail = async () => {
      try {
        const response = await fetch(
          `${process.env.REACT_APP_AUTH_SERVICE}/auth/verify-email?token=${encodeURIComponent(token)}`,
          { credentials: 'include' }
        );
        if (response.ok) {
          setStatus('success');
          setTimeout(() => navigate('/generate'), 2000);
        } else {
          const data = await response.json().catch(() => ({}));
          setStatus('error');
          setErrorMessage(data.detail || 'Invalid or expired verification link.');
        }
      } catch {
        setStatus('error');
        setErrorMessage('Something went wrong. Please try again.');
      }
    };

    verifyEmail();
  }, [token, navigate]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'background.default',
        px: 2,
      }}
    >
      <Paper elevation={4} sx={{ maxWidth: 440, width: '100%', p: 4, borderRadius: 3, textAlign: 'center' }}>
        <Typography
          variant="h5"
          fontWeight={700}
          sx={{ fontFamily: monoFontFamily, mb: 3 }}
        >
          Email Verification
        </Typography>

        {status === 'loading' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <CircularProgress />
            <Typography variant="body1" color="text.secondary">
              Verifying your email...
            </Typography>
          </Box>
        )}

        {status === 'success' && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Email verified! Redirecting...
          </Alert>
        )}

        {status === 'error' && (
          <>
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorMessage}
            </Alert>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 2 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={() => resend()}
                disabled={resending}
              >
                {resending ? 'Sending...' : 'Resend Verification Email'}
              </Button>
              <Typography
                variant="body2"
                sx={{ cursor: 'pointer', color: 'primary.main', mt: 1 }}
                onClick={() => navigate('/login')}
              >
                Back to Login
              </Typography>
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
}

export default VerifyEmailPage;
