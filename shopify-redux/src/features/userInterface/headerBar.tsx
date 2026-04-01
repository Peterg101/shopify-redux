import { useState } from 'react';
import { AppBar } from './uiComponents';
import { Box, Typography, Toolbar, Button, IconButton, Drawer, List, ListItemButton, ListItemText, useMediaQuery } from "@mui/material";
import MenuIcon from '@mui/icons-material/Menu';
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../../app/store";
import { Link, useLocation } from "react-router-dom";
import { monoFontFamily, textGlow } from "../../theme";
import { UnreadBadge } from '../messaging/UnreadBadge';
import { MessagesDrawer } from '../messaging/MessagesDrawer';
import { setLeftDrawerClosed } from '../../services/userInterfaceSlice';

const navItems = [
  { label: 'Generate', path: '/generate' },
  { label: 'Fulfill', path: '/fulfill' },
  { label: 'Catalog', path: '/catalog' },
];

const navButtonSx = (active: boolean) => ({
  textTransform: "none" as const,
  fontWeight: active ? "bold" : "normal",
  borderBottom: active ? "2px solid" : "2px solid transparent",
  borderBottomColor: active ? "primary.main" : "transparent",
  borderRadius: 0,
  color: active ? "primary.main" : "inherit",
  textShadow: active ? textGlow : "none",
});

export const HeaderBar = () => {
  const userInterfaceState = useSelector(
    (state: RootState) => state.userInterfaceState
  );
  const dispatch = useDispatch();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const isSmall = useMediaQuery('(max-width:600px)');

  const handleMessagesOpen = () => {
    dispatch(setLeftDrawerClosed());
    setMessagesOpen(true);
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
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

          {/* Desktop nav */}
          <Box sx={{ display: { xs: "none", sm: "flex" }, gap: 2 }}>
            {navItems.map(({ label, path }) => (
              <Button key={path} component={Link} to={path} sx={navButtonSx(isActive(path))}>
                {label}
              </Button>
            ))}
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          {/* Messages badge */}
          <UnreadBadge onClick={handleMessagesOpen} />

          {/* Mobile hamburger */}
          {isSmall && (
            <IconButton color="inherit" onClick={() => setMobileOpen(true)} edge="end">
              <MenuIcon />
            </IconButton>
          )}
        </Toolbar>
      </AppBar>

      {/* Mobile nav drawer */}
      <Drawer
        anchor="right"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        sx={{ display: { sm: 'none' }, '& .MuiDrawer-paper': { width: 200, bgcolor: 'background.paper' } }}
      >
        <List sx={{ pt: 2 }}>
          {navItems.map(({ label, path }) => (
            <ListItemButton
              key={path}
              component={Link}
              to={path}
              selected={isActive(path)}
              onClick={() => setMobileOpen(false)}
            >
              <ListItemText primary={label} primaryTypographyProps={{
                fontWeight: isActive(path) ? 700 : 400,
                color: isActive(path) ? 'primary.main' : 'text.primary',
              }} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      {/* Messages drawer (right side) */}
      <MessagesDrawer open={messagesOpen} onClose={() => setMessagesOpen(false)} />
    </>
  );
};
