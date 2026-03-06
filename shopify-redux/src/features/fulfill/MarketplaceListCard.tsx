import React, { useState } from 'react'
import {
  Card,
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
import { useDispatch } from 'react-redux'
import { Order } from '../../app/utility/interfaces'
import { setClaimedOrder } from '../../services/userInterfaceSlice'
import { resetDataState, setFulfillMode } from '../../services/dataSlice'
import { useOrderFileLoader } from '../../hooks/useOrderFileLoader'
import OBJSTLViewer from '../display/objStlViewer'
import ModelThumbnail from '../display/ModelThumbnail'
import { monoFontFamily } from '../../theme'
import { getScarcityColor } from '../../app/utility/fulfillUtils'

interface MarketplaceListCardProps {
  order: Order
}

export const MarketplaceListCard = React.memo(({ order }: MarketplaceListCardProps) => {
  const dispatch = useDispatch()
  const { prepareOrderFile } = useOrderFileLoader()
  const [viewerOpen, setViewerOpen] = useState(false)
  const [snackbar, setSnackbar] = useState({ open: false, message: '' })

  const remaining = order.quantity - order.quantity_claimed
  const pricePerUnit = order.quantity > 0 ? order.price / order.quantity : 0
  const progressPercent = (order.quantity_claimed / order.quantity) * 100
  const scarcityColor = getScarcityColor(remaining, order.quantity)
  const isImage = order.selectedFileType?.startsWith('image')
  const is3D = order.selectedFileType?.includes('obj') || order.selectedFileType?.includes('stl')

  const handleClaim = async () => {
    try {
      await prepareOrderFile(order)
      dispatch(setClaimedOrder({ claimedOrder: order }))
    } catch (err) {
      console.error('Error claiming order:', err)
      setSnackbar({ open: true, message: 'Failed to load order file.' })
    }
  }

  const handleView3D = async () => {
    try {
      await prepareOrderFile(order)
      dispatch(setFulfillMode({ fulfillMode: true }))
      setViewerOpen(true)
    } catch (err) {
      console.error('Error loading 3D viewer:', err)
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
          alignItems: 'center',
          px: 2,
          py: 1.5,
          gap: 2,
          transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
          '&:hover': {
            borderColor: 'rgba(0, 229, 255, 0.35)',
            boxShadow: '0 0 24px rgba(0, 229, 255, 0.15)',
          },
        }}
      >
        {/* Thumbnail */}
        <Box
          sx={{
            width: 120,
            height: 120,
            flexShrink: 0,
            borderRadius: 1,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(0, 229, 255, 0.04)',
          }}
        >
          {isImage ? (
            <Box
              component="img"
              src={order.selectedFile}
              alt={order.name}
              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : is3D && order.task_id ? (
            <ModelThumbnail
              taskId={order.task_id}
              fileType={order.selectedFileType}
              colour={order.colour}
              name={order.name}
            />
          ) : (
            <ViewInArIcon sx={{ fontSize: 40, color: 'text.secondary', opacity: 0.4 }} />
          )}
        </Box>

        {/* Name + details */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {order.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {order.material} | {order.colour}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
            <Chip label={order.technique} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
            {order.qa_level === 'high' && (
              <Chip
                label="High QA"
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.7rem',
                  bgcolor: 'rgba(255, 145, 0, 0.85)',
                  color: '#fff',
                  fontWeight: 600,
                }}
              />
            )}
          </Box>
        </Box>

        {/* Progress */}
        <Box sx={{ width: 120, flexShrink: 0 }}>
          <LinearProgress
            variant="determinate"
            value={progressPercent}
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: 'rgba(136, 153, 170, 0.15)',
              '& .MuiLinearProgress-bar': { bgcolor: scarcityColor, borderRadius: 3 },
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', textAlign: 'center' }}>
            {order.quantity_claimed}/{order.quantity} ({remaining} left)
          </Typography>
        </Box>

        {/* Price */}
        <Typography
          variant="body2"
          sx={{ color: '#00E5FF', fontFamily: monoFontFamily, fontWeight: 600, flexShrink: 0, width: 80, textAlign: 'right' }}
        >
          ${pricePerUnit.toFixed(2)}/unit
        </Typography>

        {/* Actions */}
        <CardActions sx={{ flexShrink: 0, p: 0 }}>
          <Button size="small" variant="contained" onClick={handleClaim}>
            Claim
          </Button>
          {is3D && (
            <Button size="small" variant="outlined" onClick={handleView3D}>
              View 3D
            </Button>
          )}
        </CardActions>
      </Card>

      <Dialog open={viewerOpen} onClose={handleCloseViewer} maxWidth="lg" fullWidth>
        <DialogTitle>{order.name}</DialogTitle>
        <Box>
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
