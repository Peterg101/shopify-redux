import React from 'react';
import { useState, useEffect } from "react";
import { useGetSessionQuery, useLogOutMutation } from "./services/authApi";
import { useSelector } from 'react-redux';
import { RootState } from "./app/store";
import { createWebsocketConnection } from "./services/meshyWebsocket";
import { useDispatch} from "react-redux";
import { useSyncTotalCost } from "./hooks/useSyncTotalCost";
import { useSyncTotalBasketCost } from "./hooks/useSyncTotalBasketCost";
import './App.css';
import AppRouter from './features/userInterface/AppRouter';
import LoginDialog from './features/display/loginDialogue';

function App() {

  useSyncTotalCost()
    useSyncTotalBasketCost()
    const [actualFile, setActualFile] = useState<File | null>(null);
    const [messages, setMessages] = useState<string[]>([]);
    const [progress, setProgress] = useState<number | null>(null);
    const userInterfaceState = useSelector(
      (state: RootState) => state.userInterfaceState
    )
    const dispatch = useDispatch()
    useEffect(() => {
      if (userInterfaceState.userInformation?.incomplete_task?.port) {
        const portId = userInterfaceState.userInformation?.incomplete_task.port.port_id;
        createWebsocketConnection(portId, dispatch, setActualFile);
      }
    }, [userInterfaceState.userInformation]);

    const {
      data: sessionData,
      error: sessionError,
      isLoading: isSessionLoading,
      refetch: refetchSession, 
    } = useGetSessionQuery();
    
    const [
      logOut, 
      { 
        data: logOutData, 
        error: logOutError, 
        isLoading: isLogOutLoading 
      }
    ] = useLogOutMutation();

    const handleLogin = () => {
        window.location.href = "http://localhost:2468/auth/google";
      };

    const handleCallProtectedEndpoint = () => {
        refetchSession()
    }
    
    const handleLogOut = () =>{
        logOut()
    }
  return (
    <div>
      <AppRouter/>
      <LoginDialog/>
    </div>
  )
   
}

export default App;
