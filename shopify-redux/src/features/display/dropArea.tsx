import React, {useCallback} from 'react';
import {useDropzone} from 'react-dropzone';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { useFile } from '../../services/fileProvider';
import { createFileBlob, extractFileType } from '../../app/utility/utils';
import { useDispatch } from 'react-redux';
import {setFileProperties, setFromMeshyOrHistory} from '../../services/dataSlice';
import { setLeftDrawerClosed, setRightDrawerClosed } from '../../services/userInterfaceSlice';
import { Box, Typography } from '@mui/material';

export const DropArea = () => {
    const {setActualFile} = useFile()
    const dispatch = useDispatch()

    const handleProcessFile = useCallback((file: File): void => {
        dispatch(setRightDrawerClosed())
        dispatch(setLeftDrawerClosed())
        const fileBlob = createFileBlob(file)
        const fileExtension = extractFileType(file)
        dispatch(setFileProperties({
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
    }, [handleProcessFile, dispatch])

    const {getRootProps, getInputProps, isDragActive} = useDropzone({onDrop})

    return (
        <Box>
            <Box
                {...getRootProps()}
                sx={{
                    border: '2px dashed',
                    borderColor: isDragActive ? 'primary.main' : 'rgba(0, 229, 255, 0.3)',
                    borderRadius: 2,
                    height: { xs: '300px', md: '500px' },
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    backgroundColor: isDragActive ? 'rgba(0, 229, 255, 0.04)' : 'transparent',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                        borderColor: 'primary.main',
                        backgroundColor: 'rgba(0, 229, 255, 0.04)',
                        boxShadow: '0 0 20px rgba(0, 229, 255, 0.1)',
                    },
                }}
            >
                <input {...getInputProps()} />
                <CloudUploadIcon sx={{ fontSize: 80, color: 'primary.main', mb: 2, opacity: 0.7 }} />
                <Typography variant="h6" color="text.secondary" textAlign="center" sx={{ px: 2 }}>
                    <em>Click</em> or <em>drag</em> an image or 3D model file here, or enter a prompt below.
                </Typography>
            </Box>
        </Box>
    )
}
