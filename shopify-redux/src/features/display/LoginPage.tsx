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
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../app/store';
import { authApi } from '../../services/authApi';
import { registerWithEmail, loginWithEmail } from '../../services/fetchFileUtils';
import GoogleButton from 'react-google-button';
import { monoFontFamily } from '../../theme';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const isLoggedIn = useSelector((state: RootState) => state.userInterfaceState.isLoggedIn);

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
    window.location.href = `${process.env.REACT_APP_AUTH_SERVICE}/auth/google`;
  };

  const handleSignIn = async () => {
    setError('');
    if (!loginEmail || !loginPassword) {
      setError('Please fill in all fields');
      return;
    }
    try {
      await loginWithEmail(loginEmail, loginPassword);
      dispatch(authApi.util.invalidateTags(['sessionData']));
      navigate('/generate');
    } catch (err: any) {
      setError(err.message || 'Login failed');
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
      await registerWithEmail(regUsername, regEmail, regPassword);
      dispatch(authApi.util.invalidateTags(['sessionData']));
      navigate('/generate');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
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
            Distributed Manufacturing Marketplace
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Design 3D models, place orders, and connect with fulfillers worldwide.
            A collaborative platform for distributed manufacturing.
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

          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <GoogleButton onClick={handleGoogleLogin} />
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};

export default LoginPage;
