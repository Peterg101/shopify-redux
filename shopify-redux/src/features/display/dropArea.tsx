import React, {useCallback} from 'react';
import {useDropzone} from 'react-dropzone';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { useFile } from '../../services/fileProvider';
import { createFileBlob, extractFileType } from '../../app/utility/utils';
import { useDispatch } from 'react-redux';
import {setFileProperties, setFromMeshyOrHistory} from '../../services/dataSlice';
import { setLeftDrawerClosed } from '../../services/userInterfaceSlice';
import { Box, Typography } from '@mui/material';
import { borderHover, bgHighlight, bgHighlightHover } from '../../theme';

export const DropArea = () => {
    const {setActualFile} = useFile()
    const dispatch = useDispatch()

    const handleProcessFile = useCallback((file: File): void => {
        dispatch(setLeftDrawerClosed())
        const fileBlob = createFileBlob(file)
        const fileExtension = extractFileType(file)
        dispatch(setFromMeshyOrHistory({fromMeshyOrHistory: true}))
        dispatch(setFileProperties({
            fileNameBoxValue: file.name,
            selectedFile: fileBlob,
            selectedFileType: fileExtension
        }))
        setActualFile(file)
    }, [setActualFile, dispatch])

    const onDrop = useCallback((acceptedFiles: File[]) => {
        acceptedFiles.forEach((file: File) => {
            handleProcessFile(file)
        })
    }, [handleProcessFile])

    const {getRootProps, getInputProps, isDragActive} = useDropzone({onDrop})

    return (
        <Box
            {...getRootProps()}
            sx={{
                border: '2px dashed',
                borderColor: isDragActive ? 'primary.main' : borderHover,
                borderRadius: 2,
                py: { xs: 6, md: 8 },
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                cursor: 'pointer',
                backgroundColor: isDragActive ? bgHighlight : 'transparent',
                transition: 'all 0.2s ease',
                '&:hover': {
                    borderColor: 'primary.main',
                    backgroundColor: bgHighlight,
                    boxShadow: `0 0 20px ${bgHighlightHover}`,
                },
            }}
        >
            <input {...getInputProps()} />
            <CloudUploadIcon sx={{ fontSize: 72, color: 'primary.main', mb: 2, opacity: 0.7 }} />
            <Typography variant="h6" color="text.secondary" textAlign="center" sx={{ px: 2 }}>
                Click or drag an image or 3D model file
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, opacity: 0.5 }}>
                Supports: .obj .stl .step .stp .jpg .png
            </Typography>
        </Box>
    )
}
