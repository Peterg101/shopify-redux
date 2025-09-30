import { AppBar } from './uiComponents';
import { Box, Typography, Toolbar, Button } from "@mui/material";
import { useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { Link, useLocation } from "react-router-dom";

export const HeaderBar = () => {
  const userInterfaceState = useSelector(
    (state: RootState) => state.userInterfaceState
  );
  const location = useLocation();

  // Helper to check active route
  const isActive = (path: string) => location.pathname === path;

  return (
    <AppBar
      position="fixed"
      open={userInterfaceState.leftDrawerOpen}
      drawerWidth={userInterfaceState.drawerWidth}
    >
      <Toolbar sx={{ display: "flex", gap: 3 }}>
        {/* Logo / Title */}
        <Typography variant="h5" noWrap component="div" sx={{ fontWeight: "bold" }}>
          FITD
        </Typography>

        {/* Navigation buttons (styled like nav links) */}
        <Box sx={{ display: "flex", gap: 2 }}>
          <Button
            component={Link}
            to="/generate"
            sx={{
              textTransform: "none",
              fontWeight: isActive("/generate") ? "bold" : "normal",
              borderBottom: isActive("/generate") ? "2px solid white" : "2px solid transparent",
              borderRadius: 0,
              color: "inherit",
            }}
          >
            Generate
          </Button>
          <Button
            component={Link}
            to="/fulfill"
            sx={{
              textTransform: "none",
              fontWeight: isActive("/fulfill") ? "bold" : "normal",
              borderBottom: isActive("/fulfill") ? "2px solid white" : "2px solid transparent",
              borderRadius: 0,
              color: "inherit",
            }}
          >
            Fulfill
          </Button>
        </Box>

        {/* Spacer */}
        <Box sx={{ flexGrow: 1 }} />
      </Toolbar>
    </AppBar>
  );
};
