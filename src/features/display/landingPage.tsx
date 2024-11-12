import { Box, Button } from "@mui/material"
import UserInterface from "../userInterface/userInterface"
import { MainOptions } from "./mainOptions"
import { useState } from "react";

export const LandingPage = () => {
    const [actualFile, setActualFile] = useState<File | null>(null);

    const handleLogin = () => {
        // Redirect to FastAPI Google login endpoint
        window.location.href = "http://google.co.uk";
      };
    return(
        <Box sx = {{marginTop: 10}}>
            <UserInterface/>
            <MainOptions/>
            <Button onClick={handleLogin}>Call Google</Button>
        </Box>
        
    )
}