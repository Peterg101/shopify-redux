import React, { useState } from 'react'
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Box,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions as MuiDialogActions,
  CircularProgress,
} from '@mui/material'
import ViewInArIcon from '@mui/icons-material/ViewInAr'
import { Add, Remove } from '@mui/icons-material'
import { useDispatch } from 'react-redux'
import { Claim } from '../../app/utility/interfaces'
import { setSelectedClaim, setUpdateClaimMode } from '../../services/userInterfaceSlice'
import { useOrderFileLoader } from '../../hooks/useOrderFileLoader'
import { useUpdateClaimQuantityMutation, useUpdateClaimStatusMutation } from '../../services/dbApi'
import PrintIcon from '@mui/icons-material/Print'
import { monoFontFamily, glowMedium, bgHighlight } from '../../theme'
import { STATUS_PHASES } from './ClaimDashboardHeader'

const PHASE_ORDER = STATUS_PHASES.map((p) => p.label)

const getPhaseIndex = (status: string): number => {
  const idx = STATUS_PHASES.findIndex((p) => p.statuses.includes(status))
  return idx >= 0 ? idx : 0
}

const getPhaseColor = (status: string): string => {
  const phase = STATUS_PHASES.find((p) => p.statuses.includes(status))
  if (!phase) return 'rgba(136, 153, 170, 0.6)'
  const colorMap: Record<string, string> = {
    default: 'rgba(136, 153, 170, 0.8)',
    info: '#29B6F6',
    warning: '#FFA726',
    primary: '#42A5F5',
    success: '#66BB6A',
    error: '#EF5350',
  }
  return colorMap[phase.color] || 'rgba(136, 153, 170, 0.6)'
}

function MiniStepper({ status }: { status: string }) {
  const currentIdx = getPhaseIndex(status)
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0, my: 1 }}>
      {PHASE_ORDER.map((label, idx) => (
        <Box key={label} sx={{ display: 'flex', alignItems: 'center' }}>
          <Tooltip title={label} arrow>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: idx <= currentIdx ? getPhaseColor(status) : 'rgba(136, 153, 170, 0.2)',
                transition: 'background-color 0.2s',
              }}
            />
          </Tooltip>
          {idx < PHASE_ORDER.length - 1 && (
            <Box
              sx={{
                width: 12,
                height: 2,
                bgcolor: idx < currentIdx ? getPhaseColor(status) : 'rgba(136, 153, 170, 0.15)',
                transition: 'background-color 0.2s',
              }}
            />
          )}
        </Box>
      ))}
    </Box>
  )
}

interface ClaimGridCardProps {
  claim: Claim
}

export const ClaimGridCard = React.memo(({ claim }: ClaimGridCardProps) => {
  const dispatch = useDispatch()
  const { prepareOrderFile } = useOrderFileLoader()
  const [updateQuantity, { isLoading: adjusting }] = useUpdateClaimQuantityMutation()
  const [updateStatus, { isLoading: withdrawing }] = useUpdateClaimStatusMutation()
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false)

  const order = claim.order
  const pricePerUnit = order.quantity > 0 ? order.price / order.quantity : 0
  const totalValue = pricePerUnit * claim.quantity
  const isImage = order.selectedFileType?.startsWith('image')
  const is3D = order.selectedFileType?.includes('obj') || order.selectedFileType?.includes('stl')

  const otherClaimed = (order.claims || [])
    .filter((c) => c.id !== claim.id)
    .reduce((sum, c) => sum + c.quantity, 0)
  const maxAvailable = order.quantity - otherClaimed

  const statusLabel = claim.status.replace(/_/g, ' ')
  const phaseColor = getPhaseColor(claim.status)

  const handleUpdateClaim = async () => {
    await prepareOrderFile(claim.order)
    dispatch(setUpdateClaimMode({ updateClaimMode: true }))
    dispatch(setSelectedClaim({ selectedClaim: claim }))
  }

  const handleQuantityChange = async (delta: number) => {
    const newQuantity = claim.quantity + delta
    if (newQuantity < 1 || newQuantity > maxAvailable) return
    await updateQuantity({ claimId: claim.id, quantity: newQuantity })
  }

  const handleWithdraw = async () => {
    try {
      await updateStatus({ claimId: claim.id, status: 'cancelled' }).unwrap()
    } finally {
      setWithdrawDialogOpen(false)
    }
  }

  const canWithdraw = claim.status === 'pending' || claim.status === 'in_progress'

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
          boxShadow: `0 0 24px ${glowMedium}`,
          '& .thumbnail-zoom': { transform: 'scale(1.02)' },
        },
      }}
    >
      {/* Thumbnail */}
      <Box sx={{ position: 'relative', overflow: 'hidden' }}>
        <Box
          className="thumbnail-zoom"
          sx={{
            aspectRatio: '4/3',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: bgHighlight,
            transition: 'transform 0.3s ease',
          }}
        >
          {is3D ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
              <ViewInArIcon sx={{ fontSize: 48, color: '#00E5FF', opacity: 0.5 }} />
              <Chip label={order.selectedFileType?.toUpperCase()} size="small" variant="outlined"
                sx={{ height: 18, fontSize: '0.6rem', opacity: 0.6 }} />
            </Box>
          ) : isImage ? (
            <Box component="img" src={order.selectedFile} alt={order.name}
              sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <PrintIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.3 }} />
          )}
        </Box>

        {/* Status badge */}
        <Chip
          label={statusLabel}
          size="small"
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
            bgcolor: `${phaseColor}dd`,
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.7rem',
            height: 22,
            textTransform: 'capitalize',
            backdropFilter: 'blur(4px)',
          }}
        />

        {/* Quantity badge */}
        <Chip
          label={`Qty: ${claim.quantity}`}
          size="small"
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            bgcolor: 'rgba(10, 14, 20, 0.8)',
            color: '#00E5FF',
            fontWeight: 600,
            fontSize: '0.7rem',
            height: 22,
            backdropFilter: 'blur(4px)',
          }}
        />
      </Box>

      {/* Card content */}
      <CardContent sx={{ flexGrow: 1, pb: 0 }}>
        <Typography
          variant="subtitle1"
          sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {order.name}
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
          <Chip label={order.technique} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
          <Chip label={order.material} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
          {order.colour && <Chip label={order.colour} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />}
        </Box>

        <MiniStepper status={claim.status} />

        <Typography
          variant="body2"
          sx={{ color: '#00E5FF', fontFamily: monoFontFamily, fontWeight: 600 }}
        >
          ${pricePerUnit.toFixed(2)}/unit x {claim.quantity} = ${totalValue.toFixed(2)}
        </Typography>

        {claim.tracking_number && (
          <Tooltip title={claim.tracking_number} arrow>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: 'block',
                mt: 0.5,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              Tracking: {claim.tracking_number}
            </Typography>
          </Tooltip>
        )}

        {/* Quantity adjuster (pending or in_progress) */}
        {(claim.status === 'pending' || claim.status === 'in_progress') && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
            <IconButton
              size="small"
              onClick={() => handleQuantityChange(-1)}
              disabled={adjusting || claim.quantity <= 1}
            >
              <Remove fontSize="small" />
            </IconButton>
            <Chip
              label={claim.quantity}
              size="small"
              color="primary"
              sx={{ minWidth: 40, fontWeight: 600 }}
            />
            <IconButton
              size="small"
              onClick={() => handleQuantityChange(1)}
              disabled={adjusting || claim.quantity >= maxAvailable}
            >
              <Add fontSize="small" />
            </IconButton>
            <Typography variant="caption" color="text.secondary">
              / {maxAvailable} available
            </Typography>
          </Box>
        )}
      </CardContent>

      <CardActions sx={{ px: 2, pb: 2, pt: 1 }}>
        <Button size="small" variant="contained" onClick={handleUpdateClaim} sx={{ flex: 1 }}>
          Update Status
        </Button>
        {canWithdraw && (
          <Button
            size="small"
            variant="outlined"
            color="error"
            onClick={() => setWithdrawDialogOpen(true)}
          >
            Withdraw
          </Button>
        )}
      </CardActions>
    </Card>

    <Dialog open={withdrawDialogOpen} onClose={() => !withdrawing && setWithdrawDialogOpen(false)}>
      <DialogTitle>Withdraw Claim?</DialogTitle>
      <DialogContent>
        <Typography variant="body2">
          Are you sure you want to withdraw this claim? {claim.quantity} units will be returned to
          the marketplace.
        </Typography>
      </DialogContent>
      <MuiDialogActions>
        <Button onClick={() => setWithdrawDialogOpen(false)} disabled={withdrawing}>
          Cancel
        </Button>
        <Button
          onClick={handleWithdraw}
          color="error"
          variant="contained"
          disabled={withdrawing}
          startIcon={withdrawing ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          Withdraw
        </Button>
      </MuiDialogActions>
    </Dialog>
    </>
  )
})
