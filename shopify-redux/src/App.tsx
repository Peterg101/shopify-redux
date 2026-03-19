import React from 'react';
import { useState, useEffect } from "react";
import { useGetSessionQuery, useLogOutMutation } from "./services/authApi";
import { useSelector } from 'react-redux';
import { RootState } from "./app/store";
import { createWebsocketConnection } from "./services/meshyWebsocket";
import { useDispatch} from "react-redux";
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { theme } from './theme';
import './App.css';
import AppRouter from './features/userInterface/AppRouter';

function App() {

    const [actualFile, setActualFile] = useState<File | null>(null);
    const userInterfaceState = useSelector(
      (state: RootState) => state.userInterfaceState
    )
    const dispatch = useDispatch()
    useEffect(() => {
      if (userInterfaceState.userInformation?.incomplete_task?.port) {
        const portId = userInterfaceState.userInformation?.incomplete_task.port.port_id;
        const { cleanup } = createWebsocketConnection(portId, dispatch, setActualFile);
        return cleanup;
      }
    }, [userInterfaceState.userInformation?.incomplete_task?.port?.port_id]);

    useGetSessionQuery(undefined, { pollingInterval: 5 * 60 * 1000 });

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppRouter/>
    </ThemeProvider>
  )
}

export default App;
