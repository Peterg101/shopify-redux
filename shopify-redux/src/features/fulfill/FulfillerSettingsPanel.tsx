import { useState } from "react"
import { useSelector, useDispatch } from "react-redux"
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Typography,
} from "@mui/material"
import PaymentIcon from "@mui/icons-material/Payment"
import PrecisionManufacturingIcon from "@mui/icons-material/PrecisionManufacturing"
import RefreshIcon from "@mui/icons-material/Refresh"
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline"
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked"
import { RootState } from "../../app/store"
import { authApi } from "../../services/authApi"
import { useGetFulfillerProfileQuery } from "../../services/dbApi"
import { callStripeService } from "../../services/fetchFileUtils"
import { FulfillerCapabilityForm } from "./FulfillerCapabilityForm"
import { FulfillerCapabilityDisplay } from "./FulfillerCapabilityDisplay"
import { FulfillerAddressForm } from "./FulfillerAddressForm"

const sectionCard = {
  border: "1px solid rgba(0, 229, 255, 0.08)",
  background: "rgba(19, 25, 32, 0.6)",
  backdropFilter: "blur(4px)",
  borderRadius: 3,
}

const sectionHeader = {
  display: "flex",
  alignItems: "center",
  gap: 1.5,
  mb: 1,
}

const iconBox = {
  color: "#00E5FF",
  display: "flex",
  alignItems: "center",
  opacity: 0.85,
}

/** Compact step indicator for the onboarding checklist */
const StepRow = ({ done, label }: { done: boolean; label: string }) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.25 }}>
    {done ? (
      <CheckCircleOutlineIcon sx={{ fontSize: 16, color: "success.main" }} />
    ) : (
      <RadioButtonUncheckedIcon sx={{ fontSize: 16, color: "text.disabled" }} />
    )}
    <Typography
      variant="caption"
      sx={{ color: done ? "text.primary" : "text.secondary" }}
    >
      {label}
    </Typography>
  </Box>
)

export const FulfillerSettingsPanel = () => {
  const dispatch = useDispatch()
  const userInfo = useSelector(
    (state: RootState) => state.userInterfaceState.userInformation
  )

  const userId = userInfo?.user?.user_id
  const { data: fulfillerProfile } = useGetFulfillerProfileQuery(userId!, { skip: !userId })

  const [showCapabilityForm, setShowCapabilityForm] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const stripeReady = !!userInfo?.stripe_onboarded
  const profileReady = !!fulfillerProfile

  const handleRefreshSession = () => {
    setRefreshing(true)
    dispatch(authApi.util.invalidateTags(["sessionData"]))
    setTimeout(() => setRefreshing(false), 2000)
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      {/* ── Onboarding Progress ── */}
      <Box sx={{ px: 0.5 }}>
        <Typography
          variant="overline"
          sx={{
            color: "#00E5FF",
            letterSpacing: 2,
            fontWeight: 700,
            fontSize: "0.65rem",
          }}
        >
          Fulfilment Setup
        </Typography>
        <Box sx={{ mt: 0.5 }}>
          <StepRow done={stripeReady} label="Payment account connected" />
          <StepRow done={profileReady} label="Manufacturing profile created" />
          <StepRow
            done={profileReady}
            label="Shipping address configured"
          />
        </Box>
      </Box>

      {/* ── 1. Stripe Payments ── */}
      <Card variant="outlined" sx={sectionCard}>
        <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
          <Box sx={sectionHeader}>
            <Box sx={iconBox}>
              <PaymentIcon fontSize="small" />
            </Box>
            <Typography variant="subtitle2" fontWeight={600}>
              Payments
            </Typography>
          </Box>

          {stripeReady ? (
            <Chip
              label="Payments Active"
              color="success"
              size="small"
              variant="outlined"
              sx={{ fontWeight: 600 }}
            />
          ) : (
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Button
                variant="contained"
                size="small"
                onClick={callStripeService}
                sx={{ textTransform: "none", fontWeight: 600 }}
              >
                Set Up Payments
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={handleRefreshSession}
                disabled={refreshing}
                startIcon={
                  refreshing ? (
                    <CircularProgress size={14} />
                  ) : (
                    <RefreshIcon fontSize="small" />
                  )
                }
                sx={{ textTransform: "none" }}
              >
                {refreshing ? "Checking\u2026" : "Check Status"}
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* ── 2. Manufacturing Capabilities ── */}
      <Card variant="outlined" sx={sectionCard}>
        <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
          <Box sx={{ ...sectionHeader, mb: showCapabilityForm ? 2 : 1 }}>
            <Box sx={iconBox}>
              <PrecisionManufacturingIcon fontSize="small" />
            </Box>
            <Typography variant="subtitle2" fontWeight={600} sx={{ flexGrow: 1 }}>
              Manufacturing Capabilities
            </Typography>
            {fulfillerProfile && !showCapabilityForm && (
              <Button
                size="small"
                variant="outlined"
                onClick={() => setShowCapabilityForm(true)}
                sx={{ textTransform: "none", minWidth: 0, px: 1.5 }}
              >
                Edit
              </Button>
            )}
          </Box>

          {showCapabilityForm ? (
            <FulfillerCapabilityForm
              existingProfile={fulfillerProfile}
              onComplete={() => setShowCapabilityForm(false)}
            />
          ) : fulfillerProfile ? (
            <FulfillerCapabilityDisplay profile={fulfillerProfile} />
          ) : (
            <Button
              variant="contained"
              size="small"
              onClick={() => setShowCapabilityForm(true)}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              Set Up Manufacturing Profile
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ── 3. Shipping Address ── */}
      {profileReady && <FulfillerAddressForm />}
    </Box>
  )
}
