import * as React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { Box, Typography } from '@mui/material';
import { useSelector } from 'react-redux';
import { RootState } from "../../app/store";
import GoogleButton from 'react-google-button';
import { monoFontFamily } from '../../theme';

export default function LoginDialog() {
  const userInterfaceState = useSelector(
    (state: RootState) => state.userInterfaceState
  );

  const handleLogin = () => {
    window.location.href = `${process.env.REACT_APP_AUTH_SERVICE}/auth/google`;
  };

  return (
    <Dialog
      open={!userInterfaceState.isLoggedIn}
      aria-labelledby="login-dialog-title"
      PaperProps={{
        sx: {
          minWidth: 360,
          textAlign: 'center',
        },
      }}
    >
      <DialogTitle id="login-dialog-title" sx={{ pb: 1 }}>
        <Typography
          variant="h4"
          fontWeight={700}
          sx={{ fontFamily: monoFontFamily, letterSpacing: 3 }}
        >
          FITD
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Distributed Manufacturing Marketplace
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            py: 2,
          }}
        >
          <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
            Sign in to continue
          </Typography>
          <GoogleButton onClick={handleLogin} />
        </Box>
      </DialogContent>
    </Dialog>
  );
}
