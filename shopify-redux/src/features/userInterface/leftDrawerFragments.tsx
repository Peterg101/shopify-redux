import { Typography, Box, Button } from "@mui/material";
import { TaskInformation } from "../../app/utility/interfaces";
import { useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { useLazyGetFileQuery } from "../../services/authApi";
import React, { useEffect } from "react";

export const LeftDrawerTask = (task: TaskInformation) => {
    const [triggerGetFile, { data: fileData, isLoading, isError }] = useLazyGetFileQuery();

    const handleGetFile = (fileId: string) => {
        triggerGetFile(fileId);
    };

    useEffect(() => {
        if (fileData) {
            console.log("File data:", fileData);
        }
    }, [fileData]);

    return (
        <div style={{ marginBottom: 20 }}>
            <Typography>Task Name: {task.task_name}</Typography>
            <Typography>Created At: {task.created_at}</Typography>
            <Button onClick={() => handleGetFile(task.task_id)}>Edit</Button>
            {isLoading && <Typography>Loading...</Typography>}
            {isError && <Typography color="error">Error loading file data</Typography>}
            {fileData && (
                <Typography>File Data Loaded</Typography>
            )}
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