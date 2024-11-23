import { Box, Button } from "@mui/material"
import UserInterface from "../userInterface/userInterface"
import { MainOptions } from "./mainOptions"
import { useState } from "react";
import { useGetSessionQuery, useLogOutMutation } from "../../services/authApi";

export const LandingPage = () => {
    const [actualFile, setActualFile] = useState<File | null>(null);
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
        console.log(sessionData)
        console.log(sessionError)
        

    }

    const handleLogOut = () =>{
        logOut()
        console.log(logOutData)
    }

    return(
        <Box sx = {{marginTop: 10}}>
            <UserInterface/>
            <MainOptions/>
            <Button onClick={handleLogin}>Call Google</Button>
            <Button onClick={handleCallProtectedEndpoint}>Call Protected Endpoint</Button>
            <Button onClick={handleLogOut}>Log Out</Button>
        </Box>
        
    )
}