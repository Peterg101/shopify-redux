import React, { useState } from 'react'
import {
  Card,
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
import logger from '../../app/utility/logger'
import { setSelectedClaim, setUpdateClaimMode } from '../../services/userInterfaceSlice'
import { useOrderFileLoader } from '../../hooks/useOrderFileLoader'
import { patchClaimQuantity, patchClaimStatus } from '../../services/fetchFileUtils'
import { authApi } from '../../services/authApi'
import ModelThumbnail from '../display/ModelThumbnail'
import { monoFontFamily } from '../../theme'
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

function MiniStepperInline({ status }: { status: string }) {
  const currentIdx = getPhaseIndex(status)
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      {PHASE_ORDER.map((label, idx) => (
        <Box key={label} sx={{ display: 'flex', alignItems: 'center' }}>
          <Tooltip title={label} arrow>
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                bgcolor: idx <= currentIdx ? getPhaseColor(status) : 'rgba(136, 153, 170, 0.2)',
              }}
            />
          </Tooltip>
          {idx < PHASE_ORDER.length - 1 && (
            <Box
              sx={{
                width: 8,
                height: 2,
                bgcolor: idx < currentIdx ? getPhaseColor(status) : 'rgba(136, 153, 170, 0.15)',
              }}
            />
          )}
        </Box>
      ))}
    </Box>
  )
}

interface ClaimListCardProps {
  claim: Claim
}

export const ClaimListCard = React.memo(({ claim }: ClaimListCardProps) => {
  const dispatch = useDispatch()
  const { prepareOrderFile } = useOrderFileLoader()
  const [adjusting, setAdjusting] = useState(false)
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)

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
    setAdjusting(true)
    try {
      await patchClaimQuantity(claim.id, newQuantity)
      dispatch(authApi.util.invalidateTags(['sessionData']))
    } catch (err) {
      logger.error('Error adjusting quantity:', err)
    } finally {
      setAdjusting(false)
    }
  }

  const handleWithdraw = async () => {
    setWithdrawing(true)
    try {
      await patchClaimStatus(claim.id, 'cancelled')
      dispatch(authApi.util.invalidateTags(['sessionData']))
    } catch (err) {
      logger.error('Error withdrawing claim:', err)
    } finally {
      setWithdrawing(false)
      setWithdrawDialogOpen(false)
    }
  }

  const canWithdraw = claim.status === 'pending' || claim.status === 'in_progress'

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
          width: 80,
          height: 80,
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
          <ViewInArIcon sx={{ fontSize: 32, color: 'text.secondary', opacity: 0.4 }} />
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
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.25 }}>
          <Chip label={order.technique} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
          <Chip label={order.material} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
          <Chip label={order.colour} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
        </Box>
      </Box>

      {/* Status chip */}
      <Chip
        label={statusLabel}
        size="small"
        sx={{
          bgcolor: `${phaseColor}dd`,
          color: '#fff',
          fontWeight: 600,
          fontSize: '0.7rem',
          textTransform: 'capitalize',
          flexShrink: 0,
        }}
      />

      {/* Mini stepper */}
      <Box sx={{ flexShrink: 0, display: { xs: 'none', md: 'flex' } }}>
        <MiniStepperInline status={claim.status} />
      </Box>

      {/* Price */}
      <Typography
        variant="body2"
        sx={{
          color: '#00E5FF',
          fontFamily: monoFontFamily,
          fontWeight: 600,
          flexShrink: 0,
          width: 80,
          textAlign: 'right',
        }}
      >
        ${totalValue.toFixed(2)}
      </Typography>

      {/* Quantity adjuster or qty display */}
      <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {(claim.status === 'pending' || claim.status === 'in_progress') ? (
          <>
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
              sx={{ minWidth: 32, fontWeight: 600 }}
            />
            <IconButton
              size="small"
              onClick={() => handleQuantityChange(1)}
              disabled={adjusting || claim.quantity >= maxAvailable}
            >
              <Add fontSize="small" />
            </IconButton>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            Qty: {claim.quantity}
          </Typography>
        )}
      </Box>

      {/* Actions */}
      <CardActions sx={{ flexShrink: 0, p: 0, gap: 0.5 }}>
        <Button size="small" variant="contained" onClick={handleUpdateClaim}>
          Update
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
