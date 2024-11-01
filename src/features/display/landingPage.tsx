import { Box } from "@mui/material"
import UserInterface from "../userInterface/userInterface"
import { MainOptions } from "./mainOptions"
import { useState } from "react";

export const LandingPage = () => {
    const [actualFile, setActualFile] = useState<File | null>(null);
    return(
        <Box sx = {{marginTop: 10}}>
            <UserInterface/>
            <MainOptions/>
        </Box>
        
    )
}