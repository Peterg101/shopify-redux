import React, { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Alert,
} from '@mui/material'
import { RootState } from '../../app/store'
import { updateFulfillerAddress, getFulfillerAddress } from '../../services/fetchFileUtils'
import { FulfillerAddress } from '../../app/utility/interfaces'

export const FulfillerAddressForm = () => {
  const { userInformation } = useSelector((state: RootState) => state.userInterfaceState)
  const userId = userInformation?.user?.user_id

  const [address, setAddress] = useState<FulfillerAddress>({
    name: '',
    line1: '',
    line2: '',
    city: '',
    postal_code: '',
    country: 'GB',
  })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!userId) return
    getFulfillerAddress(userId)
      .then((existing) => {
        if (existing) {
          setAddress(existing)
        }
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [userId])

  const handleSave = async () => {
    if (!userId) return
    setSaving(true)
    setError('')
    setSuccess(false)
    try {
      await updateFulfillerAddress(userId, address)
      setSuccess(true)
    } catch (e: any) {
      setError(e.message || 'Failed to save address')
    } finally {
      setSaving(false)
    }
  }

  if (!loaded) return null

  return (
    <Paper elevation={2} sx={{ p: 3, borderRadius: 3, maxWidth: 500 }}>
      <Typography variant="h6" fontWeight={600} gutterBottom>
        Fulfiller Shipping Address
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        This is the return address used on shipping labels when you fulfil orders.
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="Full Name"
          value={address.name}
          onChange={(e) => setAddress({ ...address, name: e.target.value })}
          required
          fullWidth
          size="small"
        />
        <TextField
          label="Address Line 1"
          value={address.line1}
          onChange={(e) => setAddress({ ...address, line1: e.target.value })}
          required
          fullWidth
          size="small"
        />
        <TextField
          label="Address Line 2"
          value={address.line2 || ''}
          onChange={(e) => setAddress({ ...address, line2: e.target.value })}
          fullWidth
          size="small"
        />
        <TextField
          label="City"
          value={address.city}
          onChange={(e) => setAddress({ ...address, city: e.target.value })}
          required
          fullWidth
          size="small"
        />
        <TextField
          label="Postcode"
          value={address.postal_code}
          onChange={(e) => setAddress({ ...address, postal_code: e.target.value })}
          required
          fullWidth
          size="small"
        />
        <TextField
          label="Country"
          value={address.country}
          onChange={(e) => setAddress({ ...address, country: e.target.value })}
          fullWidth
          size="small"
          disabled
        />
      </Box>

      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mt: 2 }}>Address saved!</Alert>}

      <Button
        variant="contained"
        onClick={handleSave}
        disabled={saving || !address.name || !address.line1 || !address.city || !address.postal_code}
        sx={{ mt: 2 }}
      >
        {saving ? 'Saving...' : 'Save Address'}
      </Button>
    </Paper>
  )
}
