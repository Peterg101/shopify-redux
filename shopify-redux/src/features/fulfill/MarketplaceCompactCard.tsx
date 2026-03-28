import React, { useState } from 'react'
import {
  Card,
  CardActionArea,
  Typography,
  Box,
  CircularProgress,
  Snackbar,
  Alert,
} from '@mui/material'
import ViewInArIcon from '@mui/icons-material/ViewInAr'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import VerifiedIcon from '@mui/icons-material/Verified'
import { useDispatch } from 'react-redux'
import { Order } from '../../app/utility/interfaces'
import logger from '../../app/utility/logger'
import { setClaimedOrder } from '../../services/userInterfaceSlice'
import { useOrderFileLoader } from '../../hooks/useOrderFileLoader'
import { ThumbnailImage } from '../display/ThumbnailImage'
import { monoFontFamily } from '../../theme'
import { getScarcityColor } from '../../app/utility/fulfillUtils'

interface MarketplaceCompactCardProps {
  order: Order
}

export const MarketplaceCompactCard = React.memo(({ order }: MarketplaceCompactCardProps) => {
  const dispatch = useDispatch()
  const { prepareOrderFile } = useOrderFileLoader()
  const [snackbar, setSnackbar] = useState({ open: false, message: '' })

  const remaining = order.quantity - order.quantity_claimed
  const pricePerUnit = order.quantity > 0 ? order.price / order.quantity : 0
  const progressPercent = (order.quantity_claimed / order.quantity) * 100
  const scarcityColor = getScarcityColor(remaining, order.quantity)
  const isImage = order.selectedFileType?.startsWith('image')
  const is3D = order.selectedFileType?.includes('obj') || order.selectedFileType?.includes('stl')

  const handleClick = async () => {
    try {
      await prepareOrderFile(order)
      dispatch(setClaimedOrder({ claimedOrder: order }))
    } catch (err) {
      logger.error('Error claiming order:', err)
      setSnackbar({ open: true, message: 'Failed to load order file.' })
    }
  }

  return (
    <>
      <Card
        sx={{
          transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
          '&:hover': {
            transform: 'translateY(-2px)',
            borderColor: 'rgba(0, 229, 255, 0.35)',
            boxShadow: '0 0 24px rgba(0, 229, 255, 0.15)',
            '& .compact-zoom': {
              transform: 'scale(1.02)',
            },
          },
        }}
      >
        <CardActionArea onClick={handleClick}>
          <Box sx={{ position: 'relative', overflow: 'hidden' }}>
            {/* Thumbnail */}
            <Box
              className="compact-zoom"
              sx={{
                aspectRatio: '1/1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'rgba(0, 229, 255, 0.04)',
                transition: 'transform 0.3s ease',
              }}
            >
              {isImage ? (
                <Box
                  component="img"
                  src={order.selectedFile}
                  alt={order.name}
                  sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : order.task_id ? (
                <ThumbnailImage taskId={order.task_id} alt={order.name} />
              ) : (
                <ViewInArIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.4 }} />
              )}
            </Box>

            {/* Bottom gradient overlay with text */}
            <Box
              sx={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                background: 'linear-gradient(transparent, rgba(10, 14, 20, 0.9))',
                px: 1.5,
                py: 1,
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  color: '#E4E8EE',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: '0.8rem',
                }}
              >
                {order.name}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: '#00E5FF', fontFamily: monoFontFamily, fontWeight: 600 }}
              >
                ${pricePerUnit.toFixed(2)}
              </Typography>
            </Box>

            {/* Spec badge */}
            {order.process_id && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  display: 'flex',
                  alignItems: 'center',
                  bgcolor: 'rgba(0, 229, 255, 0.15)',
                  borderRadius: 1,
                  px: 0.5,
                  py: 0.25,
                  backdropFilter: 'blur(4px)',
                  border: '1px solid rgba(0, 229, 255, 0.3)',
                }}
              >
                <VerifiedIcon sx={{ fontSize: 12, color: '#00E5FF' }} />
              </Box>
            )}

            {/* Scarcity badge */}
            <Box
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                bgcolor: 'rgba(10, 14, 20, 0.8)',
                borderRadius: 1,
                px: 0.75,
                py: 0.25,
                backdropFilter: 'blur(4px)',
              }}
            >
              <FiberManualRecordIcon sx={{ fontSize: 8, color: scarcityColor }} />
              <Typography variant="caption" sx={{ color: scarcityColor, fontWeight: 600, fontSize: '0.65rem' }}>
                {remaining} left
              </Typography>
            </Box>

            {/* Progress ring */}
            <Box
              sx={{
                position: 'absolute',
                bottom: 8,
                right: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CircularProgress
                variant="determinate"
                value={progressPercent}
                size={28}
                thickness={3}
                sx={{
                  color: scarcityColor,
                  '& .MuiCircularProgress-circle': {
                    strokeLinecap: 'round',
                  },
                }}
              />
              <CircularProgress
                variant="determinate"
                value={100}
                size={28}
                thickness={3}
                sx={{
                  color: 'rgba(136, 153, 170, 0.15)',
                  position: 'absolute',
                  zIndex: -1,
                }}
              />
            </Box>
          </Box>
        </CardActionArea>
      </Card>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ open: false, message: '' })}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert severity="error" onClose={() => setSnackbar({ open: false, message: '' })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  )
})
