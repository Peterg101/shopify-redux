import { useLogOutMutation, useGetUserBasketQuery, useGetUserOrdersQuery, useGetUserClaimsQuery } from "../../services/authApi";
import { Box, Button, Typography, Card, CardContent, Grid, Avatar } from "@mui/material";
import { useSelector } from "react-redux";
import { RootState } from "../../app/store";
import PersonIcon from "@mui/icons-material/Person";
import ShoppingBasketIcon from "@mui/icons-material/ShoppingBasket";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import AssignmentIcon from "@mui/icons-material/Assignment";
import LogoutIcon from "@mui/icons-material/Logout";

export const ProfilePage = () => {
  const userInfo = useSelector(
    (state: RootState) => state.userInterfaceState.userInformation
  );

  const [logOut] = useLogOutMutation();
  const { data: basketItems = [] } = useGetUserBasketQuery();
  const { data: orders = [] } = useGetUserOrdersQuery();
  const { data: claims = [] } = useGetUserClaimsQuery();

  const handleLogOut = () => {
    logOut();
  };

  const stats = [
    {
      label: "Basket Items",
      value: basketItems.length,
      icon: <ShoppingBasketIcon />,
    },
    {
      label: "Orders",
      value: orders.length,
      icon: <LocalShippingIcon />,
    },
    {
      label: "Active Claims",
      value: claims.length,
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
