import { Typography, Box, Button } from "@mui/material";
import { FileResponse, TaskInformation } from "../../app/utility/interfaces";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { authApi, useLazyGetFileQuery } from "../../services/authApi";
import React, { useEffect, useState } from "react";
import { useFile } from "../../services/fileProvider";
import { resetDataState, setFileProperties } from "../../services/dataSlice";
import { extractFileType } from "../../app/utility/utils";


export const LeftDrawerTask = (task: TaskInformation) => {
    // const [triggerGetFile, { data: fileData, isLoading, isError}] = useLazyGetFileQuery();
    const { actualFile, setActualFile } = useFile();
    // const [currentFilename, setCurrentFilename] = useState<string>('');
    const dispatch = useDispatch();

    const fetchFile = async (fileId: string): Promise<FileResponse> => {
        try {
          const response = await fetch(`http://localhost:2468/file_storage/${fileId}`, {
            method: 'GET',
            credentials: 'include'
          });
      
          if (!response.ok) {
            throw new Error(`Failed to fetch file with ID ${fileId}: ${response.statusText}`);
          }
      
          const data: FileResponse = await response.json();
          return data;
        } catch (error) {
          console.error("Error fetching file:", error);
          throw error;
        }
      };

     const handleGetFile = async (fileId: string, filename: string) => {
        console.log(filename);
        console.log(fileId)
        setActualFile(null)
        dispatch(resetDataState())
        // Trigger the API call
        // setCurrentFilename(filename);
        // triggerGetFile(fileId, false);
        const data = await fetchFile(fileId)
        const byteCharacters = atob(data.file_data);
        const byteNumbers = Array.from(byteCharacters, char => char.charCodeAt(0));
        const fileData = new Uint8Array(byteNumbers)
        console.log("File data:", fileData);
        const blob = new Blob([fileData], { type: "application/octet-stream" });
        const file = new File([blob], filename, { type: "application/octet-stream" });
        const objectURL = URL.createObjectURL(file);
        setActualFile(file);
            dispatch(setFileProperties({
                selectedFile: objectURL,
                selectedFileType: 'obj',
                fileNameBoxValue: filename,
            }));

    };

    // useEffect(() => {
    //     let objectURL: string | null = null;
    //     if (fileData) {
    //         console.log("File data:", fileData);
    //         const decodedData = atob(fileData.file_data);
    //         const blob = new Blob([decodedData], { type: "application/octet-stream" });
    //         const file = new File([blob], "downloaded_file.obj", { type: "application/octet-stream" });
    //         objectURL = URL.createObjectURL(file);
    //         setActualFile(file);
    //         dispatch(setFileProperties({
    //             selectedFile: objectURL,
    //             selectedFileType: extractFileType(file),
    //             fileNameBoxValue: currentFilename,
    //         }));
    //     }
    //     return () => {
    //         if (objectURL) URL.revokeObjectURL(objectURL);
    //     };
    // }, [fileData, currentFilename, dispatch, setActualFile]);

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