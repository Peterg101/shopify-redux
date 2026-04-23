import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Tabs,
  Tab,
  Divider,
  Alert,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectIsLoggedIn } from '../../services/selectors';
import { useLoginMutation, useRegisterMutation } from '../../services/authApi';
import { GitHub as GitHubIcon, Google as GoogleIcon } from '@mui/icons-material';
import { monoFontFamily } from '../../theme';
import { FEATURES } from '../../config/featureFlags';

export function LoginPage() {
  const navigate = useNavigate();
  const isLoggedIn = useSelector(selectIsLoggedIn);
  const [login] = useLoginMutation();
  const [register] = useRegisterMutation();

  const [tab, setTab] = useState(0);
  const [error, setError] = useState('');

  // Sign In fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register fields
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  React.useEffect(() => {
    if (isLoggedIn) {
      navigate('/generate');
    }
  }, [isLoggedIn, navigate]);

  const handleGoogleLogin = () => {
    window.location.href = `${process.env.REACT_APP_API_URL}/auth/google`;
  };

  const handleSignIn = async () => {
    setError('');
    if (!loginEmail || !loginPassword) {
      setError('Please fill in all fields');
      return;
    }
    try {
      await login({ email: loginEmail, password: loginPassword }).unwrap();
      navigate('/generate');
    } catch (err: any) {
      setError(err.data?.detail || err.message || 'Login failed');
    }
  };

  const handleRegister = async () => {
    setError('');
    if (!regUsername || !regEmail || !regPassword || !regConfirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    if (regPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setError('Passwords do not match');
      return;
    }
    try {
      await register({ username: regUsername, email: regEmail, password: regPassword }).unwrap();
      navigate('/generate');
    } catch (err: any) {
      setError(err.data?.detail || err.message || 'Registration failed');
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
      <Box
        sx={{
          display: 'flex',
          maxWidth: 900,
          width: '100%',
          gap: 4,
          flexDirection: { xs: 'column', md: 'row' },
        }}
      >
        {/* Left: Product Info */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Typography
            variant="h2"
            fontWeight={700}
            sx={{ fontFamily: monoFontFamily, letterSpacing: 3, mb: 2 }}
          >
            FITD
          </Typography>
          <Typography variant="h5" color="text.secondary" sx={{ mb: 2 }}>
            {FEATURES.MANUFACTURING
              ? 'Distributed Manufacturing Marketplace'
              : 'AI-Powered CAD Generation'}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {FEATURES.MANUFACTURING
              ? 'Design 3D models, place orders, and connect with fulfillers worldwide. A collaborative platform for distributed manufacturing.'
              : 'Describe your part in plain English. Chat with our AI engineer. Get a manufacturing-ready STEP file in seconds.'}
          </Typography>
        </Box>

        {/* Right: Auth Forms */}
        <Paper elevation={4} sx={{ flex: 1, p: 4, borderRadius: 3 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
            <Tab label="Sign In" />
            <Tab label="Register" />
          </Tabs>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {tab === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Email"
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                fullWidth
              />
              <TextField
                label="Password"
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                fullWidth
              />
              <Button
                variant="contained"
                color="primary"
                size="large"
                onClick={handleSignIn}
                sx={{ py: 1.4, fontWeight: 600 }}
              >
                Sign In
              </Button>
              <Typography
                variant="body2"
                sx={{ textAlign: 'center', mt: 1, cursor: 'pointer', color: 'primary.main' }}
                onClick={() => navigate('/forgot-password')}
              >
                Forgot Password?
              </Typography>
            </Box>
          )}

          {tab === 1 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Username"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                fullWidth
              />
              <TextField
                label="Email"
                type="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                fullWidth
              />
              <TextField
                label="Password"
                type="password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                fullWidth
              />
              <TextField
                label="Confirm Password"
                type="password"
                value={regConfirmPassword}
                onChange={(e) => setRegConfirmPassword(e.target.value)}
                fullWidth
              />
              <Button
                variant="contained"
                color="primary"
                size="large"
                onClick={handleRegister}
                sx={{ py: 1.4, fontWeight: 600 }}
              >
                Register
              </Button>
            </Box>
          )}

          <Divider sx={{ my: 3 }}>or</Divider>

          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, width: '100%' }}>
            <Button
              variant="contained"
              fullWidth
              startIcon={<GoogleIcon />}
              onClick={handleGoogleLogin}
              sx={{ bgcolor: '#fff', color: '#3c4043', '&:hover': { bgcolor: '#f2f2f2' }, maxWidth: 240, py: 1.2, fontWeight: 500, textTransform: 'none', fontSize: '0.9rem' }}
            >
              Continue with Google
            </Button>
            <Button
              variant="contained"
              fullWidth
              startIcon={<GitHubIcon />}
              onClick={() => window.location.href = `${process.env.REACT_APP_API_URL}/auth/github`}
              sx={{ bgcolor: '#24292e', color: '#fff', '&:hover': { bgcolor: '#1a1e22' }, maxWidth: 240, py: 1.2, fontWeight: 500, textTransform: 'none', fontSize: '0.9rem' }}
            >
              Continue with GitHub
            </Button>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};

export default LoginPage;
