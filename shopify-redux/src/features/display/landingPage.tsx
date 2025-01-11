import { Box, Button } from "@mui/material"
import UserInterface from "../userInterface/userInterface"
import { MainOptions } from "./mainOptions"
import { useState, useEffect } from "react";
import { useGetSessionQuery, useLogOutMutation } from "../../services/authApi";
import { useSelector } from 'react-redux';
import { RootState } from "../../app/store";
import LoginDialog from "./loginDialogue";

export const LandingPage = () => {


    const [actualFile, setActualFile] = useState<File | null>(null);
    const [messages, setMessages] = useState<string[]>([]);
    const [progress, setProgress] = useState<number | null>(null);
    const userInterfaceState = useSelector(
      (state: RootState) => state.userInterfaceState
    )

    useEffect(() => {
      if (userInterfaceState.userInformation?.incomplete_tasks) {
        const taskId = userInterfaceState.userInformation.incomplete_tasks[0].task_id
        console.log(taskId)



        const ws = new WebSocket(`ws://localhost:1234/ws/${taskId}`);

        ws.onopen = () => {
          console.log('WebSocket connection opened.');
        };

        ws.onmessage = (event) => {
          console.log('Message from server:', event.data);

          // Handle progress updates and task completion
          if (event.data.includes('Progress:')) {
            const progressMatch = event.data.match(/Progress: (\d+)%/);
            if (progressMatch) {
              setProgress(parseInt(progressMatch[1], 10));
            }
          } else if (event.data.includes('Task Completed!')) {
            setMessages((prev) => [...prev, 'Task Completed!']);
            localStorage.removeItem('task_id');
            console.log('Task completed. Removed task ID from storage.');
          } else {
            setMessages((prev) => [...prev, event.data]);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
        };

        ws.onclose = () => {
          console.log('WebSocket connection closed.');
        };

        // Cleanup on component unmount
        return () => {
          ws.close();
        };
      }
      else{
        console.warn('NOTHING THERE')
      }

      




    }), [userInterfaceState.userInformation?.incomplete_tasks]

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

    const startTask = async () => {
      console.log('clicked 2');
    
      const taskId = "12345"; // Replace with your dynamic task ID if needed
      const response = await fetch('http://localhost:1234/start_task/', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json', // Specify that you're sending JSON data
    
        },
        body: JSON.stringify({ task_id: taskId }), // Send task_id in the request body
      });
    
      const data = await response.json();
      console.log(data.message); // This will be "Task started!"
    };
    

    const handleLogOut = () =>{
        logOut()
    }

    return(
        <Box sx = {{marginTop: 10}}>
            <UserInterface/>
            <MainOptions/>
            <LoginDialog/>
            <Button onClick={handleLogin}>Call Google</Button>
            <Button onClick={handleCallProtectedEndpoint}>Call Protected Endpoint</Button>
            <Button onClick={startTask}>Start Task</Button>
            <Button onClick={handleLogOut}>Log Out</Button>
        </Box>
        
    )
}