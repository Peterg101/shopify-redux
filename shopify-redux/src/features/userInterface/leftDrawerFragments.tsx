import { Typography, Button } from "@mui/material";
import { TaskInformation } from "../../app/utility/interfaces";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import React from "react";
import { useFile } from "../../services/fileProvider";
import { resetDataState, setFileProperties } from "../../services/dataSlice";
import { extractFileInfo, fetchFile } from "../../services/fetchFileUtils";
import { setLeftDrawerClosed } from "../../services/userInterfaceSlice";

export const LeftDrawerTask = (task: TaskInformation) => {
    const { actualFile, setActualFile } = useFile();
    const dispatch = useDispatch();

     const handleGetFile = async (fileId: string, filename: string) => {
        setActualFile(null)
        dispatch(resetDataState())
        dispatch(setLeftDrawerClosed())
        const data = await fetchFile(fileId)
        const fileInfo = extractFileInfo(data, filename)
        setActualFile(fileInfo.file);
            dispatch(setFileProperties({
                selectedFile: fileInfo.fileUrl,
                selectedFileType: 'obj',
                fileNameBoxValue: filename,
            }));
        
    };
    return (
        <div style={{ marginBottom: 20 }}>
            <Typography>Task Name: {task.task_name}</Typography>
            <Typography>Created At: {task.created_at}</Typography>
            <Button onClick={() => handleGetFile(task.task_id, task.task_name)}>Edit</Button>
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