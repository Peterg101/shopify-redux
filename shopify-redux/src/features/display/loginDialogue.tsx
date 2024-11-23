import * as React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useSelector } from 'react-redux';
import { RootState } from "../../app/store";

export default function LoginDialog() {
//   const [open, setOpen] = React.useState(false);
const userInterfaceState = useSelector(
    (state: RootState) => state.userInterfaceState
)
  const theme = useTheme();
  const handleLogin = () => {
    window.location.href = "http://localhost:2468/auth/google";
  };
  return (
    <React.Fragment>
      
      <Dialog
        // fullScreen={fullScreen}
        open={!userInterfaceState.isLoggedIn}
        // onClose={handleClose}
        aria-labelledby="responsive-dialog-title"
      >
        <DialogTitle id="responsive-dialog-title">
          {"Login options:"}
        </DialogTitle>
        <DialogContent>
        <Button onClick={handleLogin}>Log in with Google</Button>

        </DialogContent>
        <DialogActions>
          
        </DialogActions>
      </Dialog>
    </React.Fragment>
  );
}