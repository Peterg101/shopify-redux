import { Typography, Box, Button } from "@mui/material";
import { TaskInformation } from "../../app/utility/interfaces";
import { useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { useLazyGetFileQuery } from "../../services/authApi";
import React, { useEffect } from "react";

export const LeftDrawerTask = (task: TaskInformation) => {
    const [triggerGetFile, { isLoading, isError }] = useLazyGetFileQuery();

    const handleGetFile = async (fileId: string) => {
        try {
            await triggerGetFile(fileId);
        } catch (error) {
            console.error("Error fetching file:", error);
        }
    };

    return (
        <div>
            <Typography>Task Name: {task.task_name}</Typography>
            <Typography>Created At: {task.created_at}</Typography>
            <Button onClick={() => handleGetFile(task.task_id)}>Fetch File</Button>
            {isLoading && <Typography>Loading...</Typography>}
            {isError && <Typography color="error">Error loading file</Typography>}
        </div>
    );
};

export const LeftDrawerList = () =>{
    const userInterfaceState = useSelector(
        (state: RootState) => state.userInterfaceState,
      )

    return(
        <React.Fragment>
            {userInterfaceState.userInformation?.tasks.map((task) => (
                <LeftDrawerTask key ={task.task_id} {...task}/>
            ))}
        </React.Fragment>
    )

}