import { AppBar } from './uiComponents';
import { Box, Typography, Toolbar, Button } from "@mui/material";
import { useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { Link, useLocation } from "react-router-dom";
import { monoFontFamily } from "../../theme";

export const HeaderBar = () => {
  const userInterfaceState = useSelector(
    (state: RootState) => state.userInterfaceState
  );
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <AppBar
      position="fixed"
      open={userInterfaceState.leftDrawerOpen}
    >
      <Toolbar sx={{ display: "flex", gap: 3 }}>
        <Typography
          variant="h5"
          noWrap
          component="div"
          sx={{
            fontWeight: "bold",
            fontFamily: monoFontFamily,
            letterSpacing: 2,
          }}
        >
          FITD
        </Typography>

        <Box sx={{ display: "flex", gap: 2 }}>
          <Button
            component={Link}
            to="/generate"
            sx={{
              textTransform: "none",
              fontWeight: isActive("/generate") ? "bold" : "normal",
              borderBottom: isActive("/generate")
                ? "2px solid"
                : "2px solid transparent",
              borderBottomColor: isActive("/generate")
                ? "primary.main"
                : "transparent",
              borderRadius: 0,
              color: isActive("/generate") ? "primary.main" : "inherit",
              textShadow: isActive("/generate")
                ? "0 0 8px rgba(0, 229, 255, 0.5)"
                : "none",
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
              borderBottom: isActive("/fulfill")
                ? "2px solid"
                : "2px solid transparent",
              borderBottomColor: isActive("/fulfill")
                ? "primary.main"
                : "transparent",
              borderRadius: 0,
              color: isActive("/fulfill") ? "primary.main" : "inherit",
              textShadow: isActive("/fulfill")
                ? "0 0 8px rgba(0, 229, 255, 0.5)"
                : "none",
            }}
          >
            Fulfill
          </Button>
        </Box>

        <Box sx={{ flexGrow: 1 }} />
      </Toolbar>
    </AppBar>
  );
};
