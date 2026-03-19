import {
  Paper,
  Box,
  Typography,
  Grid,
  Button,
  Chip,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import DownloadIcon from '@mui/icons-material/Download'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'

interface ShippingLabelCardProps {
  label: { label_url: string; tracking_number: string; carrier_code: string }
  onCopySuccess: () => void
}

export const ShippingLabelCard = ({ label, onCopySuccess }: ShippingLabelCardProps) => {
  return (
    <Paper
      elevation={2}
      sx={{
        p: 2.5,
        borderRadius: 3,
        border: '1px solid rgba(68, 138, 255, 0.25)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <LocalShippingIcon sx={{ color: '#448AFF', fontSize: 24 }} />
        <Typography variant="h6" fontWeight={600}>
          Shipping Label
        </Typography>
      </Box>
      <Divider sx={{ mb: 2 }} />
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={6}>
          <Typography variant="caption" color="text.secondary">
            Carrier
          </Typography>
          <Box sx={{ mt: 0.5 }}>
            <Chip
              label={label.carrier_code}
              size="small"
              sx={{
                backgroundColor: 'rgba(68, 138, 255, 0.12)',
                color: '#448AFF',
                fontWeight: 600,
              }}
            />
          </Box>
        </Grid>
        <Grid item xs={6}>
          <Typography variant="caption" color="text.secondary">
            Tracking Number
          </Typography>
          <Box
            sx={{
              mt: 0.5,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            <Typography
              variant="body2"
              sx={{ fontFamily: 'monospace', fontWeight: 600 }}
            >
              {label.tracking_number}
            </Typography>
            <Tooltip title="Copy tracking number">
              <IconButton
                size="small"
                onClick={() => {
                  navigator.clipboard.writeText(label.tracking_number)
                  onCopySuccess()
                }}
                sx={{ color: 'text.secondary' }}
              >
                <ContentCopyIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Grid>
        <Grid item xs={12}>
          <Button
            variant="contained"
            fullWidth
            startIcon={<DownloadIcon />}
            href={label.label_url}
            target="_blank"
            sx={{
              mt: 1,
              py: 1.2,
              fontWeight: 600,
              backgroundColor: '#448AFF',
              '&:hover': {
                backgroundColor: '#2979FF',
                boxShadow: '0 0 16px rgba(68, 138, 255, 0.4)',
              },
            }}
          >
            Download PDF Label
          </Button>
        </Grid>
      </Grid>
    </Paper>
  )
}
