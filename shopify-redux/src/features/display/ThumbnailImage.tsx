import { useState } from 'react'
import { Box } from '@mui/material'
import ViewInArIcon from '@mui/icons-material/ViewInAr'

interface ThumbnailImageProps {
  taskId: string
  alt?: string
}

/**
 * Displays a server-rendered thumbnail image for a 3D model.
 * Falls back to a ViewInAr icon if the thumbnail isn't available.
 *
 * The image is served via step_service GET /thumbnail/{taskId},
 * which redirects to a presigned S3 URL (~30KB PNG vs 2.5MB model file).
 */
export const ThumbnailImage = ({ taskId, alt = '3D model' }: ThumbnailImageProps) => {
  const [error, setError] = useState(false)
  const thumbnailUrl = `${process.env.REACT_APP_STEP_SERVICE}/thumbnail/${taskId}`

  if (error) {
    return (
      <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ViewInArIcon sx={{ fontSize: 48, color: '#00E5FF', opacity: 0.4 }} />
      </Box>
    )
  }

  return (
    <Box
      component="img"
      src={thumbnailUrl}
      alt={alt}
      loading="lazy"
      onError={() => setError(true)}
      sx={{
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        background: 'radial-gradient(circle at center, #1a2230 0%, #0A0E14 100%)',
      }}
    />
  )
}

export default ThumbnailImage
