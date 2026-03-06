import {
  Box,
  Typography,
  TextField,
  IconButton,
  Button,
  Paper,
  Divider,
  Grid,
  Dialog,
  DialogActions,
  DialogTitle,
} from '@mui/material'
import { Add, Remove, OpenInFull } from '@mui/icons-material'
import { useState } from 'react'
import { Order } from '../../app/utility/interfaces'
import OBJSTLViewer from '../display/objStlViewer'

interface ClaimPanelProps {
  order: Order
  mode: 'claim' | 'update'
  onConfirm: (quantity: number) => void
  onCancel: () => void
}

export function ClaimPanel({
  order,
  mode,
  onConfirm,
  onCancel,
}: ClaimPanelProps) {
  const maxQuantity = order.quantity - order.quantity_claimed
  const [quantity, setQuantity] = useState(Math.min(order.quantity, maxQuantity) || 1)
  const [viewerOpen, setViewerOpen] = useState(false)

  const increment = () => setQuantity((q) => (q < maxQuantity ? q + 1 : q))
  const decrement = () => setQuantity((q) => (q > 1 ? q - 1 : q))

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: 'background.default',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        py: 10,
        px: 3,
      }}
    >
      <Grid
        container
        spacing={4}
        sx={{ maxWidth: 1200, width: '100%', alignItems: 'stretch' }}
      >
        {/* 3D Viewer */}
        <Grid item xs={12} md={7}>
          <Paper
            elevation={4}
            sx={{
              borderRadius: 3,
              overflow: 'hidden',
              height: '100%',
              minHeight: 600,
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <OBJSTLViewer />
            <IconButton
              onClick={() => setViewerOpen(true)}
              aria-label="Expand 3D viewer"
              sx={{
                position: 'absolute',
                top: 12,
                right: 12,
                backgroundColor: 'rgba(0, 229, 255, 0.15)',
                '&:hover': { backgroundColor: 'rgba(0, 229, 255, 0.25)' },
                boxShadow: 2,
              }}
            >
              <OpenInFull />
            </IconButton>
          </Paper>
        </Grid>

        {/* Details + Claim Controls */}
        <Grid
          item
          xs={12}
          md={5}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
          }}
        >
          {/* Order Details */}
          <Paper elevation={2} sx={{ flex: 1, p: 3, borderRadius: 3 }}>
            <Typography variant="h5" fontWeight={600} gutterBottom>
              Order Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography variant="body1"><strong>Name:</strong> {order.name}</Typography>
              <Typography variant="body1"><strong>Material:</strong> {order.material}</Typography>
              <Typography variant="body1"><strong>Technique:</strong> {order.technique}</Typography>
              <Typography variant="body1"><strong>Colour:</strong> {order.colour}</Typography>
              <Typography variant="body1"><strong>Size:</strong> {order.sizing}</Typography>
              <Typography variant="body1"><strong>Quantity:</strong> {order.quantity}</Typography>
              <Typography variant="body1">
                <strong>Status:</strong> {order.status} {order.is_collaborative && '(Collaborative)'}
              </Typography>
            </Box>
          </Paper>

          {/* Claim Controls */}
          <Paper
            elevation={3}
            sx={{
              flex: 1,
              p: 4,
              borderRadius: 3,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <Typography variant="h4" fontWeight={600} gutterBottom>
              {mode === 'claim' ? 'Claim Items' : 'Update Claim'}
            </Typography>

            <Typography variant="body1" color="text.secondary" textAlign="center" mb={3}>
              You can claim up to <strong>{maxQuantity}</strong> items from this order.
            </Typography>

            <Divider sx={{ width: '100%', mb: 3 }} />

            <Box display="flex" alignItems="center" justifyContent="center" gap={2} mb={3}>
              <IconButton
                onClick={decrement}
                color="primary"
                disabled={quantity <= 1}
              >
                <Remove />
              </IconButton>

              <TextField
                type="number"
                size="small"
                value={quantity}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10)
                  if (!isNaN(val) && val >= 1 && val <= maxQuantity) {
                    setQuantity(val)
                  }
                }}
                inputProps={{
                  min: 1,
                  max: maxQuantity,
                  style: { textAlign: 'center', width: '70px' },
                }}
              />

              <IconButton
                onClick={increment}
                color="primary"
                disabled={quantity >= maxQuantity}
              >
                <Add />
              </IconButton>
            </Box>

            <Box display="flex" gap={2} width="100%" mt="auto">
              <Button
                variant="contained"
                color="primary"
                size="large"
                fullWidth
                sx={{ py: 1.4, borderRadius: 2, fontWeight: 600 }}
                onClick={() => onConfirm(quantity)}
              >
                {mode === 'claim' ? 'Confirm Claim' : 'Update Claim'}
              </Button>

              <Button
                variant="outlined"
                size="large"
                fullWidth
                sx={{ py: 1.4, borderRadius: 2, fontWeight: 600 }}
                onClick={onCancel}
              >
                Cancel
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <Dialog open={viewerOpen} onClose={() => setViewerOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>{order.name}</DialogTitle>
        <Box sx={{ height: '60vh' }}>
          <OBJSTLViewer />
        </Box>
        <DialogActions>
          <Button onClick={() => setViewerOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
