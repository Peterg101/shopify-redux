import React from 'react';
import { useState, useEffect } from "react";
import { useGetSessionQuery } from "./services/authApi";
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

    const [, setActualFile] = useState<File | null>(null);
    const userInterfaceState = useSelector(
      (state: RootState) => state.userInterfaceState
    )
    const dispatch = useDispatch()
    const incompletePort = userInterfaceState.userInformation?.incomplete_task?.port;
    const portId = incompletePort?.port_id;
    useEffect(() => {
      if (incompletePort) {
        const { cleanup } = createWebsocketConnection(portId!, dispatch, setActualFile);
        return cleanup;
      }
    }, [incompletePort, portId, dispatch]);

    useGetSessionQuery(undefined, { pollingInterval: 5 * 60 * 1000 });

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppRouter/>
    </ThemeProvider>
  )
}

export default App;
