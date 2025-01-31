import React, {useCallback} from 'react';
import {useDropzone} from 'react-dropzone';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { useFile } from '../../services/fileProvider';
import { createFileBlob, extractFileType } from '../../app/utility/utils';
import { useDispatch } from 'react-redux';
import {setFileProperties, setFromMeshyOrHistory} from '../../services/dataSlice';
import { setLeftDrawerClosed, setRightDrawerClosed } from '../../services/userInterfaceSlice';
import AiTextPrompt from './aiTextPrompt';
import { Box, CircularProgress } from '@mui/material';
import { useSelector } from 'react-redux';
import { RootState } from "../../app/store";


export const DropArea = () => {

    const userInterfaceState = useSelector(
        (state: RootState) => state.userInterfaceState
    )

    const {actualFile, setActualFile} = useFile()
    const dispatch = useDispatch()

    const handleProcessFile = useCallback((file: File): void => {
        dispatch(setRightDrawerClosed())
        dispatch(setLeftDrawerClosed())
      const fileBlob = createFileBlob(file)
      const fileExtension = extractFileType(file)
      console.log(fileExtension)
      dispatch(setFileProperties(
        {
          fileNameBoxValue: file.name, 
          selectedFile: fileBlob,
          selectedFileType: fileExtension
        }))
      setActualFile(file)
    }, [setActualFile, dispatch])
    const onDrop = useCallback((acceptedFiles: File[]) => {
        dispatch(setFromMeshyOrHistory({fromMeshyOrHistory: true}))
        acceptedFiles.forEach((file: File) => {
        handleProcessFile(file)
        })
    }, [handleProcessFile] )

    const {getRootProps, getInputProps} = useDropzone({onDrop})
    
    return(
        <Box>
        <Box {...getRootProps()} style={{border: '5px dashed', height: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column'}}>
          <input {...getInputProps()} />
          <CloudUploadIcon sx={{'scale': '5'}}/>
          <h3 style={{marginTop: 50, textAlign: 'center'}}><em>Click</em> or <em>drag</em> an image or 3D model file here, or enter a prompt below.</h3>
          
        </Box> 
  
       
        </Box>
    )
}