import React from 'react';
import { useState, useEffect } from "react";
import { useGetSlimSessionQuery } from "./services/authApi";
import { connectSSE } from "./services/sseListener";
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

    const dispatch = useDispatch();
    const [, setActualFile] = useState<File | null>(null);
    const userInterfaceState = useSelector(
      (state: RootState) => state.userInterfaceState
    )
    const incompletePort = userInterfaceState.userInformation?.incomplete_task?.port;
    const portId = incompletePort?.port_id;
    useEffect(() => {
      if (incompletePort) {
        const { cleanup } = createWebsocketConnection(portId!, dispatch, setActualFile);
        return cleanup;
      }
    }, [incompletePort, portId, dispatch]);

    // SSE connection for real-time cache invalidation
    useEffect(() => {
      if (userInterfaceState.userInformation) {
        const cleanup = connectSSE(dispatch);
        return cleanup;
      }
    }, [userInterfaceState.userInformation !== null, dispatch]);

    useGetSlimSessionQuery(undefined, { pollingInterval: 30 * 60 * 1000 });

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppRouter/>
    </ThemeProvider>
  )
}

export default App;
