import { useState } from 'react';
import { AppBar, Box, Typography, Toolbar, Button, IconButton, Drawer, List, ListItemButton, ListItemText, useMediaQuery, Avatar, Menu, MenuItem, ListItemIcon, Divider } from "@mui/material";
import MenuIcon from '@mui/icons-material/Menu';
import SettingsIcon from '@mui/icons-material/Settings';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import LogoutIcon from '@mui/icons-material/Logout';
import PaymentIcon from '@mui/icons-material/Payment';
import { useSelector } from "react-redux";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { monoFontFamily, textGlow } from "../../theme";
import { UnreadBadge } from '../messaging/UnreadBadge';
import { MessagesDrawer } from '../messaging/MessagesDrawer';
import { selectUserInformation } from '../../services/selectors';
import { useLogOutMutation } from '../../services/authApi';
import { FEATURES } from '../../config/featureFlags';
import SubscriptionBanner from '../billing/SubscriptionBanner';

const allNavItems = [
  { label: 'Generate', path: '/generate' },
  { label: 'Fulfill', path: '/fulfill', manufacturing: true },
  { label: 'Catalog', path: '/catalog', manufacturing: true },
];

const navItems = allNavItems.filter(
  (item) => !item.manufacturing || FEATURES.MANUFACTURING
);

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
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const isSmall = useMediaQuery('(max-width:600px)');
  const userInfo = useSelector(selectUserInformation);
  const [logOut] = useLogOutMutation();

  const handleMessagesOpen = () => {
    setMessagesOpen(true);
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      <AppBar
        position="fixed"
        sx={{ bgcolor: 'background.paper' }}
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

          {/* Subscription banner */}
          <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
            <SubscriptionBanner />
          </Box>

          {/* Messages badge */}
          <UnreadBadge onClick={handleMessagesOpen} />

          {/* Profile avatar */}
          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: 14, color: '#0A0E14' }}>
              {userInfo?.user?.username?.[0]?.toUpperCase() || 'U'}
            </Avatar>
          </IconButton>

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

      {/* Profile menu */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="body1" fontWeight={600}>{userInfo?.user?.username}</Typography>
          <Typography variant="body2" color="text.secondary">{userInfo?.user?.email}</Typography>
        </Box>
        <Divider />
        {FEATURES.MANUFACTURING && (
          <MenuItem onClick={() => { navigate('/orders'); setAnchorEl(null); }}>
            <ListItemIcon><LocalShippingIcon fontSize="small" /></ListItemIcon>
            <ListItemText>My Orders</ListItemText>
          </MenuItem>
        )}
        {FEATURES.MANUFACTURING && (
          <MenuItem onClick={() => { navigate('/fulfiller-settings'); setAnchorEl(null); }}>
            <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Fulfiller Settings</ListItemText>
          </MenuItem>
        )}
        <MenuItem onClick={() => { navigate('/billing'); setAnchorEl(null); }}>
          <ListItemIcon><PaymentIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Billing</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { logOut(); setAnchorEl(null); }}>
          <ListItemIcon><LogoutIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText sx={{ color: 'error.main' }}>Log Out</ListItemText>
        </MenuItem>
      </Menu>

      {/* Messages drawer (right side) */}
      <MessagesDrawer open={messagesOpen} onClose={() => setMessagesOpen(false)} />
    </>
  );
};
