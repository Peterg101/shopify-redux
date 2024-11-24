import * as React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { useTheme } from '@mui/material/styles';
import { useSelector } from 'react-redux';
import { RootState } from "../../app/store";
import GoogleButton from 'react-google-button'

export default function LoginDialog() {
const userInterfaceState = useSelector(
    (state: RootState) => state.userInterfaceState
)
  const theme = useTheme();
  const handleLogin = () => {
    console.log('hi')
    window.location.href = "http://localhost:2468/auth/google";
  };


 
  
  return (
    <React.Fragment>
      
      <Dialog
        open={!userInterfaceState.isLoggedIn}
        aria-labelledby="responsive-dialog-title"
      >
        <DialogTitle id="responsive-dialog-title">
          {"Log in to FITD:"}
        </DialogTitle>
        <DialogContent>
        <GoogleButton onClick={handleLogin}/>

        </DialogContent>
        <DialogActions>
          
        </DialogActions>
      </Dialog>
    </React.Fragment>
  );
}