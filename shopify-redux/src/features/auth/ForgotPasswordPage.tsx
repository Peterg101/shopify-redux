import React, { useState } from 'react';
import { Box, Paper, Typography, TextField, Button, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useForgotPasswordMutation } from '../../services/authApi';
import { monoFontFamily } from '../../theme';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [forgotPassword, { isLoading }] = useForgotPasswordMutation();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    try {
      await forgotPassword({ email }).unwrap();
      setSubmitted(true);
    } catch {
      // Always show success to avoid revealing whether the email exists
      setSubmitted(true);
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
          Reset Password
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Enter your email and we'll send you a link to reset your password.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {submitted ? (
          <>
            <Alert severity="success" sx={{ mb: 2 }}>
              If an account exists with that email, you'll receive a password reset link shortly.
            </Alert>
            <Button
              variant="text"
              color="primary"
              onClick={() => navigate('/login')}
              sx={{ mt: 1 }}
            >
              Back to Login
            </Button>
          </>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              {isLoading ? 'Sending...' : 'Send Reset Link'}
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

export default ForgotPasswordPage;
