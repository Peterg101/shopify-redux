import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { Box, Typography, Button, TextField } from '@mui/material'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'

interface EvidenceUploadSectionProps {
  qaLevel: string
  currentStatus: string
  onEvidenceChange: (file: File | null, description: string) => void
}

export const EvidenceUploadSection = ({
  qaLevel,
  currentStatus,
  onEvidenceChange,
}: EvidenceUploadSectionProps) => {
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null)
  const [evidencePreview, setEvidencePreview] = useState<string | null>(null)
  const [evidenceDescription, setEvidenceDescription] = useState('')
  const [fileError, setFileError] = useState('')

  // Revoke blob URL on unmount or when preview changes
  useEffect(() => {
    return () => {
      if (evidencePreview) URL.revokeObjectURL(evidencePreview)
    }
  }, [evidencePreview])

  // Notify parent when file or description changes
  useEffect(() => {
    onEvidenceChange(evidenceFile, evidenceDescription)
  }, [evidenceFile, evidenceDescription, onEvidenceChange])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFileError('')
    if (acceptedFiles.length === 0) return

    const file = acceptedFiles[0]
    if (file.size > 5 * 1024 * 1024) {
      setFileError('File too large -- maximum 5 MB')
      return
    }
    if (!file.type.startsWith('image/')) {
      setFileError('Only image files are accepted')
      return
    }
    setEvidenceFile(file)
    const url = URL.createObjectURL(file)
    setEvidencePreview(url)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 1,
    multiple: false,
  })

  const clearEvidence = () => {
    setEvidenceFile(null)
    if (evidencePreview) URL.revokeObjectURL(evidencePreview)
    setEvidencePreview(null)
    setEvidenceDescription('')
    setFileError('')
  }

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {currentStatus === 'qa_check' && qaLevel === 'high'
          ? 'Upload QA evidence photo (required for high-QA orders)'
          : 'Upload photo evidence (optional)'}
      </Typography>

      {!evidenceFile ? (
        <Box
          {...getRootProps()}
          sx={{
            border: '2px dashed',
            borderColor: isDragActive
              ? 'primary.main'
              : fileError
                ? 'error.main'
                : 'rgba(0, 229, 255, 0.25)',
            borderRadius: 2,
            py: 3,
            px: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            cursor: 'pointer',
            backgroundColor: isDragActive
              ? 'rgba(0, 229, 255, 0.06)'
              : 'transparent',
            transition: 'all 0.2s ease',
            '&:hover': {
              borderColor: 'primary.main',
              backgroundColor: 'rgba(0, 229, 255, 0.04)',
              boxShadow: '0 0 20px rgba(0, 229, 255, 0.08)',
            },
          }}
        >
          <input {...getInputProps()} />
          <CloudUploadIcon
            sx={{ fontSize: 36, color: 'primary.main', mb: 1, opacity: 0.7 }}
          />
          <Typography
            variant="body2"
            color="text.secondary"
            textAlign="center"
          >
            Drag photo here or click to browse
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 0.5, opacity: 0.5 }}
          >
            Max 5 MB, images only
          </Typography>
        </Box>
      ) : (
        <Box
          sx={{
            border: '1px solid rgba(0, 229, 255, 0.2)',
            borderRadius: 2,
            p: 2,
            position: 'relative',
          }}
        >
          {evidencePreview && (
            <Box
              sx={{
                mb: 1.5,
                borderRadius: 1,
                overflow: 'hidden',
                maxHeight: 160,
                display: 'flex',
                justifyContent: 'center',
                backgroundColor: 'rgba(0,0,0,0.2)',
              }}
            >
              <img
                src={evidencePreview}
                alt="Evidence preview"
                style={{
                  maxWidth: '100%',
                  maxHeight: 160,
                  objectFit: 'contain',
                }}
              />
            </Box>
          )}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '70%',
              }}
            >
              {evidenceFile.name}
            </Typography>
            <Button
              size="small"
              color="error"
              startIcon={<DeleteOutlineIcon sx={{ fontSize: 16 }} />}
              onClick={clearEvidence}
              sx={{ textTransform: 'none', minWidth: 'auto' }}
            >
              Remove
            </Button>
          </Box>
          <TextField
            label="Evidence Description"
            value={evidenceDescription}
            onChange={(e) => setEvidenceDescription(e.target.value)}
            fullWidth
            size="small"
            sx={{ mt: 1.5 }}
          />
        </Box>
      )}

      {fileError && (
        <Typography
          variant="caption"
          color="error"
          sx={{ mt: 0.5, display: 'block' }}
        >
          {fileError}
        </Typography>
      )}
    </Box>
  )
}
