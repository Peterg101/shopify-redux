import React, {useCallback} from 'react';
import {useDropzone} from 'react-dropzone';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { useFile } from '../../services/fileProvider';
import { createFileBlob, extractFileType } from '../../app/utility/utils';
import { useDispatch } from 'react-redux';
import { setFileNameBoxValue, setFileProperties, setSelectedFile, setSelectedFileType } from '../../services/dataSlice';

export const Dropzone = () => {
    const {actualFile, setActualFile} = useFile()
    const dispatch = useDispatch()

    const handleProcessFile = (file: File): void => {
      
      const fileBlob = createFileBlob(file)
      const fileExtension = extractFileType(file)
      dispatch(setFileProperties(
        {
          fileNameBoxValue: file.name, 
          selectedFile: fileBlob, 
          selectedFileType: fileExtension
        }))
      setActualFile(file)
    }
    const onDrop = useCallback((acceptedFiles: File[]) => {
        acceptedFiles.forEach((file: File) => {
        handleProcessFile(file)
        })
    }, [] )

    const {getRootProps, getInputProps} = useDropzone({onDrop})
    
    return (
        <div {...getRootProps()} style={{border: '5px dashed', height: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column'}}>
          <input {...getInputProps()} />
          <CloudUploadIcon sx={{'scale': '5'}}/>
          <h3 style={{marginTop: 50}}><em>Click</em> or <em>drag</em> an image or 3D model file here, or enter a prompt below.</h3>
        </div>
      )

}