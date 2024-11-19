import { Box, Button } from "@mui/material"
import UserInterface from "../userInterface/userInterface"
import { MainOptions } from "./mainOptions"
import { useState } from "react";

export const LandingPage = () => {
    const [actualFile, setActualFile] = useState<File | null>(null);
    
    const handleLogin = () => {
        // Redirect to FastAPI Google login endpoint
        window.location.href = "http://localhost:2468/auth/google";
      };

    const handleCallProtectedEndpoint = () => {
        fetch("http://localhost:2468/get_session", {
            method: "GET",
            credentials: "include",  // Ensure cookies are sent
          })
            .then((response) => response.json())
            .then((data) => {
              console.log(data); // Handle successful response
            })
            .catch((error) => {
              console.error("Authentication failed", error);
            });

    }

    const logOut = () =>{
        fetch("http://localhost:2468/logout", {
            method: "GET",
            credentials: "include",  // Ensure cookies are sent
          })
            .then((response) => response.json())
            .then((data) => {
              console.log(data); // Handle successful response
            })
            .catch((error) => {
              console.error("Authentication failed", error);
            });
    }

    return(
        <Box sx = {{marginTop: 10}}>
            <UserInterface/>
            <MainOptions/>
            <Button onClick={handleLogin}>Call Google</Button>
            <Button onClick={handleCallProtectedEndpoint}>Call Protected Endpoint</Button>
            <Button onClick={logOut}>Log Out</Button>
        </Box>
        
    )
}