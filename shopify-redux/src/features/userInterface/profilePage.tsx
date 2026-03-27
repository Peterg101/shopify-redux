import { useState } from "react";
import { useLogOutMutation, authApi } from "../../services/authApi";
import { Box, Button, Typography, Card, CardContent, Grid, Avatar, Chip, CircularProgress } from "@mui/material";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../../app/store";
import PersonIcon from "@mui/icons-material/Person";
import ShoppingBasketIcon from "@mui/icons-material/ShoppingBasket";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import AssignmentIcon from "@mui/icons-material/Assignment";
import LogoutIcon from "@mui/icons-material/Logout";
import PaymentIcon from "@mui/icons-material/Payment";
import PrecisionManufacturingIcon from "@mui/icons-material/PrecisionManufacturing";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import RefreshIcon from "@mui/icons-material/Refresh";
import { callStripeService } from "../../services/fetchFileUtils";
import { FulfillerCapabilityForm } from "../fulfill/FulfillerCapabilityForm";
import { FulfillerCapabilityDisplay } from "../fulfill/FulfillerCapabilityDisplay";
import { FulfillerAddressForm } from "../fulfill/FulfillerAddressForm";

export const ProfilePage = () => {
  const userInfo = useSelector(
    (state: RootState) => state.userInterfaceState.userInformation
  );

  const dispatch = useDispatch();
  const [logOut] = useLogOutMutation();
  const [showCapabilityForm, setShowCapabilityForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefreshSession = async () => {
    setRefreshing(true);
    dispatch(authApi.util.invalidateTags(['sessionData']));
    setTimeout(() => setRefreshing(false), 2000);
  };

  const fulfillerProfile = userInfo?.fulfiller_profile;

  const handleLogOut = () => {
    logOut();
  };

  const stats = [
    {
      label: "Basket Items",
      value: userInfo?.basket_items?.length ?? 0,
      icon: <ShoppingBasketIcon />,
    },
    {
      label: "Orders",
      value: userInfo?.orders?.length ?? 0,
      icon: <LocalShippingIcon />,
    },
    {
      label: "Active Claims",
      value: userInfo?.claims?.length ?? 0,
      icon: <AssignmentIcon />,
    },
  ];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* User Info */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Avatar sx={{ bgcolor: "primary.main", width: 48, height: 48 }}>
          <PersonIcon />
        </Avatar>
        <Box>
          <Typography variant="h6" fontWeight={600}>
            {userInfo?.user?.username ?? "User"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {userInfo?.user?.email ?? ""}
          </Typography>
        </Box>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={2}>
        {stats.map((stat) => (
          <Grid item xs={12} key={stat.label}>
            <Card variant="outlined">
              <CardContent
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  py: 1.5,
                  "&:last-child": { pb: 1.5 },
                }}
              >
                <Box sx={{ color: "primary.main" }}>{stat.icon}</Box>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    {stat.label}
                  </Typography>
                  <Typography variant="h6" fontWeight={600}>
                    {stat.value}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Stripe Payments */}
      <Card variant="outlined">
        <CardContent
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            py: 1.5,
            "&:last-child": { pb: 1.5 },
          }}
        >
          <Box sx={{ color: "primary.main" }}>
            <PaymentIcon />
          </Box>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Payments
            </Typography>
            {userInfo?.stripe_onboarded ? (
              <Chip label="Payments Active" color="success" size="small" />
            ) : (
              <Box sx={{ display: "flex", gap: 1, mt: 0.5, alignItems: "center" }}>
                <Button
                  variant="contained"
                  size="small"
                  onClick={callStripeService}
                >
                  Set Up Payments
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleRefreshSession}
                  disabled={refreshing}
                  startIcon={refreshing ? <CircularProgress size={14} /> : <RefreshIcon />}
                >
                  {refreshing ? "Checking..." : "Check Status"}
                </Button>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Manufacturing Capabilities */}
      <Card variant="outlined">
        <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1.5 }}>
            <Box sx={{ color: "primary.main" }}>
              <PrecisionManufacturingIcon />
            </Box>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Manufacturing Capabilities
              </Typography>
            </Box>
            {fulfillerProfile && !showCapabilityForm && (
              <Button
                size="small"
                variant="outlined"
                onClick={() => setShowCapabilityForm(true)}
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
            >
              Set Up Manufacturing Profile
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Fulfiller Shipping Address */}
      {fulfillerProfile && <FulfillerAddressForm />}

      {/* Logout */}
      <Button
        onClick={handleLogOut}
        variant="outlined"
        color="error"
        startIcon={<LogoutIcon />}
        sx={{ mt: 1 }}
      >
        Log Out
      </Button>
    </Box>
  );
};
