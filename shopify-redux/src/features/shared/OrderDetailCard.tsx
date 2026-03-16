import { useState } from 'react'
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Box,
  Dialog,
  DialogTitle,
  DialogActions as MuiDialogActions,
  Snackbar,
  Alert,
} from '@mui/material'
import { useDispatch } from 'react-redux'
import { Order } from '../../app/utility/interfaces'
import logger from '../../app/utility/logger'
import { resetDataState } from '../../services/dataSlice'
import { setFulfillMode } from '../../services/userInterfaceSlice'
import { useOrderFileLoader } from '../../hooks/useOrderFileLoader'
import OBJSTLViewer from '../display/objStlViewer'
import { monoFontFamily } from '../../theme'

interface OrderDetailCardProps {
  order: Order
  variant: 'claimable' | 'claimed'
  onAction: (order: Order) => Promise<void>
  actionLabel: string
}

export function OrderDetailCard({
  order,
  variant,
  onAction,
  actionLabel,
}: OrderDetailCardProps) {
  const dispatch = useDispatch()
  const { prepareOrderFile } = useOrderFileLoader()
  const [viewerOpen, setViewerOpen] = useState(false)
  const [snackbar, setSnackbar] = useState({ open: false, message: '' })

  const handleView = async () => {
    try {
      await prepareOrderFile(order)
      dispatch(setFulfillMode({ fulfillMode: true }))
      setViewerOpen(true)
    } catch (err) {
      logger.error('Error loading file:', err)
      setSnackbar({ open: true, message: 'Sorry, this file could not be loaded.' })
    }
  }

  const handleAction = async () => {
    try {
      await onAction(order)
    } catch (err) {
      logger.error('Error performing action:', err)
      setSnackbar({ open: true, message: 'An error occurred. Please try again.' })
    }
  }

  const handleCloseViewer = () => {
    dispatch(resetDataState())
    setViewerOpen(false)
  }

  const pricePerUnit = order.quantity > 0 ? order.price / order.quantity : 0

  return (
    <>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          {variant === 'claimed' && (
            <Typography variant="overline" color="primary.main" sx={{ fontWeight: 700 }}>
              Claimed Order
            </Typography>
          )}
          <Typography variant="h6">{order.name}</Typography>

          <Typography variant="body2" color="text.secondary">
            Material: {order.material} | Technique: {order.technique}{order.colour ? ` | Colour: ${order.colour}` : ''} | Size: {order.sizing}
          </Typography>

          {variant === 'claimable' ? (
            <Typography variant="body2" color="text.secondary">
              Required: {order.quantity} | Claimed: {order.quantity_claimed}
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Claimed Quantity: {order.quantity_claimed}
            </Typography>
          )}

          <Typography variant="body2" color="text.secondary" sx={{ fontFamily: monoFontFamily }}>
            {variant === 'claimable'
              ? `Total order value: $${order.price.toFixed(2)}`
              : `Total value to you: $${(pricePerUnit * order.quantity_claimed).toFixed(2)}`}
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ fontFamily: monoFontFamily }}>
            Price per unit: ${pricePerUnit.toFixed(2)}
          </Typography>

          <Typography variant="body2" color="text.secondary">
            Status: {order.status} {order.is_collaborative && '(Collaborative)'}
          </Typography>

          {order.selectedFileType?.startsWith('image') && (
            <Box mt={1}>
              <img
                src={order.selectedFile}
                alt={order.name}
                style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8 }}
              />
            </Box>
          )}
        </CardContent>

        <CardActions>
          <Button size="small" variant="contained" onClick={handleAction}>
            {actionLabel}
          </Button>

          {order.selectedFileType?.includes('obj') && (
            <Button size="small" variant="outlined" onClick={handleView}>
              View
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
}
