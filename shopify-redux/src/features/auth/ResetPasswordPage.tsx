import React, { useState } from 'react';
import { Box, Paper, Typography, TextField, Button, Alert } from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useResetPasswordMutation } from '../../services/authApi';
import { monoFontFamily } from '../../theme';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [resetPassword, { isLoading }] = useResetPasswordMutation();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const redirectTimerRef = React.useRef<ReturnType<typeof setTimeout>>();

  React.useEffect(() => {
    return () => clearTimeout(redirectTimerRef.current);
  }, []);

  const handleSubmit = async () => {
    setError('');
    if (!password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!token) {
      setError('Invalid or missing reset token');
      return;
    }
    try {
      await resetPassword({ token, new_password: password }).unwrap();
      setSuccess(true);
      redirectTimerRef.current = setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      setError(err.data?.detail || 'Reset link is invalid or has expired.');
    }
  };

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
      <Paper elevation={4} sx={{ maxWidth: 440, width: '100%', p: 4, borderRadius: 3 }}>
        <Typography
          variant="h5"
          fontWeight={700}
          sx={{ fontFamily: monoFontFamily, mb: 1 }}
        >
          Set New Password
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Enter your new password below.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
            {error.includes('expired') && (
              <Button
                size="small"
                color="inherit"
                onClick={() => navigate('/forgot-password')}
                sx={{ ml: 1, textDecoration: 'underline' }}
              >
                Request a new link
              </Button>
            )}
          </Alert>
        )}

        {success ? (
          <Alert severity="success">
            Password reset successfully! Redirecting to login...
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="New Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
            />
            <TextField
              label="Confirm New Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              fullWidth
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
            <Button
              variant="contained"
              color="primary"
              size="large"
              onClick={handleSubmit}
              disabled={isLoading}
              sx={{ py: 1.4, fontWeight: 600 }}
            >
              {isLoading ? 'Resetting...' : 'Reset Password'}
            </Button>
            <Typography
              variant="body2"
              sx={{ textAlign: 'center', mt: 1, cursor: 'pointer', color: 'primary.main' }}
              onClick={() => navigate('/login')}
            >
              Back to Login
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
}

export default ResetPasswordPage;
