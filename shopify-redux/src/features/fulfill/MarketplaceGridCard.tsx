import React, { useState } from 'react'
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Box,
  Chip,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogActions as MuiDialogActions,
  Snackbar,
  Alert,
} from '@mui/material'
import ViewInArIcon from '@mui/icons-material/ViewInAr'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import VerifiedIcon from '@mui/icons-material/Verified'
import { useDispatch } from 'react-redux'
import { Order } from '../../app/utility/interfaces'
import logger from '../../app/utility/logger'
import { setClaimedOrder, setFulfillMode } from '../../services/userInterfaceSlice'
import { resetDataState } from '../../services/dataSlice'
import { useOrderFileLoader } from '../../hooks/useOrderFileLoader'
import OBJSTLViewer from '../display/objStlViewer'
import ModelThumbnail from '../display/ModelThumbnail'
import { monoFontFamily } from '../../theme'
import { getScarcityColor } from '../../app/utility/fulfillUtils'

interface MarketplaceGridCardProps {
  order: Order
}

const isNewOrder = (createdAt: string) => {
  const created = new Date(createdAt)
  const now = new Date()
  return now.getTime() - created.getTime() < 24 * 60 * 60 * 1000
}

export const MarketplaceGridCard = React.memo(({ order }: MarketplaceGridCardProps) => {
  const dispatch = useDispatch()
  const { prepareOrderFile } = useOrderFileLoader()
  const [viewerOpen, setViewerOpen] = useState(false)
  const [snackbar, setSnackbar] = useState({ open: false, message: '' })

  const remaining = order.quantity - order.quantity_claimed
  const pricePerUnit = order.quantity > 0 ? order.price / order.quantity : 0
  const progressPercent = (order.quantity_claimed / order.quantity) * 100
  const scarcityColor = getScarcityColor(remaining, order.quantity)
  const isNew = isNewOrder(order.created_at)
  const isHighQA = order.qa_level === 'high'
  const hasSpec = Boolean(order.process_id)
  const isImage = order.selectedFileType?.startsWith('image')
  const is3D = order.selectedFileType?.includes('obj') || order.selectedFileType?.includes('stl')

  const handleClaim = async () => {
    try {
      await prepareOrderFile(order)
      dispatch(setClaimedOrder({ claimedOrder: order }))
    } catch (err) {
      logger.error('Error claiming order:', err)
      setSnackbar({ open: true, message: 'Failed to load order file.' })
    }
  }

  const handleView3D = async () => {
    try {
      await prepareOrderFile(order)
      dispatch(setFulfillMode({ fulfillMode: true }))
      setViewerOpen(true)
    } catch (err) {
      logger.error('Error loading 3D viewer:', err)
      setSnackbar({ open: true, message: 'Sorry, this file could not be loaded.' })
    }
  }

  const handleCloseViewer = () => {
    dispatch(resetDataState())
    setViewerOpen(false)
  }

  return (
    <>
      <Card
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
          '&:hover': {
            transform: 'translateY(-2px)',
            borderColor: 'rgba(0, 229, 255, 0.35)',
            boxShadow: '0 0 24px rgba(0, 229, 255, 0.15)',
            '& .thumbnail-zoom': {
              transform: 'scale(1.02)',
            },
          },
        }}
      >
        {/* Thumbnail area */}
        <Box sx={{ position: 'relative', overflow: 'hidden' }}>
          <Box
            className="thumbnail-zoom"
            sx={{
              aspectRatio: '4/3',
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
                sx={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            ) : is3D && order.task_id ? (
              <ModelThumbnail
                taskId={order.task_id}
                fileType={order.selectedFileType}
                colour={order.colour}
                name={order.name}
              />
            ) : (
              <ViewInArIcon sx={{ fontSize: 64, color: 'text.secondary', opacity: 0.4 }} />
            )}
          </Box>

          {/* Overlay badges */}
          <Box sx={{ position: 'absolute', top: 8, left: 8, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {isHighQA && (
              <Chip
                label="QA: High"
                size="small"
                sx={{
                  bgcolor: 'rgba(255, 145, 0, 0.85)',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  height: 22,
                }}
              />
            )}
            {isNew && (
              <Chip
                label="NEW"
                size="small"
                sx={{
                  bgcolor: 'rgba(118, 255, 3, 0.85)',
                  color: '#0A0E14',
                  fontWeight: 700,
                  fontSize: '0.7rem',
                  height: 22,
                }}
              />
            )}
            {hasSpec && (
              <Chip
                icon={<VerifiedIcon sx={{ fontSize: 14, color: '#00E5FF !important' }} />}
                label="Spec'd"
                size="small"
                sx={{
                  bgcolor: 'rgba(0, 229, 255, 0.15)',
                  color: '#00E5FF',
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  height: 22,
                  borderColor: 'rgba(0, 229, 255, 0.3)',
                  border: '1px solid',
                }}
              />
            )}
          </Box>

          {/* Scarcity indicator */}
          <Chip
            icon={<FiberManualRecordIcon sx={{ fontSize: 10, color: `${scarcityColor} !important` }} />}
            label={`${remaining} left`}
            size="small"
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              bgcolor: 'rgba(10, 14, 20, 0.8)',
              color: scarcityColor,
              fontWeight: 600,
              fontSize: '0.7rem',
              height: 22,
              backdropFilter: 'blur(4px)',
            }}
          />
        </Box>

        {/* Card content */}
        <CardContent sx={{ flexGrow: 1, pb: 1 }}>
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {order.name}
          </Typography>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
            <Chip label={order.technique} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
            <Chip label={order.material} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
            <Chip label={order.colour} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }}>
            <LinearProgress
              variant="determinate"
              value={progressPercent}
              sx={{
                flexGrow: 1,
                height: 6,
                borderRadius: 3,
                bgcolor: 'rgba(136, 153, 170, 0.15)',
                '& .MuiLinearProgress-bar': {
                  bgcolor: scarcityColor,
                  borderRadius: 3,
                },
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
              {order.quantity_claimed}/{order.quantity}
            </Typography>
          </Box>

          <Typography
            variant="body2"
            sx={{ mt: 1, color: '#00E5FF', fontFamily: monoFontFamily, fontWeight: 600 }}
          >
            ${pricePerUnit.toFixed(2)}/unit
          </Typography>
        </CardContent>

        <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
          <Button size="small" variant="contained" onClick={handleClaim} sx={{ flex: 1 }}>
            Claim
          </Button>
          {is3D && (
            <Button size="small" variant="outlined" onClick={handleView3D} sx={{ flex: 1 }}>
              View 3D
            </Button>
          )}
        </CardActions>
      </Card>

      <Dialog open={viewerOpen} onClose={handleCloseViewer} maxWidth="lg" fullWidth>
        <DialogTitle>{order.name}</DialogTitle>
        <Box sx={{ height: '60vh' }}>
          <OBJSTLViewer />
        </Box>
        <MuiDialogActions>
          <Button onClick={handleCloseViewer}>Close</Button>
        </MuiDialogActions>
      </Dialog>

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
