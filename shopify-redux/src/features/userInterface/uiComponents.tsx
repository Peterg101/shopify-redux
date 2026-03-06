import { styled, Theme, CSSObject } from "@mui/material/styles"
import MuiDrawer, { DrawerProps as MuiDrawerProps } from "@mui/material/Drawer"
import MuiAppBar, { AppBarProps as MuiAppBarProps } from "@mui/material/AppBar"

export const DRAWER_WIDTH = 400;

export const openedMixin = (theme: Theme): CSSObject => ({
  width: DRAWER_WIDTH,
  transition: theme.transitions.create("width", {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: "hidden",
  top: typeof theme.mixins.toolbar.minHeight === 'number'
    ? theme.mixins.toolbar.minHeight
    : 56,
  height: `calc(100% - ${typeof theme.mixins.toolbar.minHeight === 'number' ? theme.mixins.toolbar.minHeight : 56}px)`,
})

export const closedMixin = (theme: Theme): CSSObject => ({
  transition: theme.transitions.create("width", {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  overflowX: "hidden",
  width: `calc(${theme.spacing(7)} + 1px)`,
  [theme.breakpoints.up("sm")]: {
    width: `calc(${theme.spacing(8)} + 1px)`,
  },
  top: typeof theme.mixins.toolbar.minHeight === 'number'
    ? theme.mixins.toolbar.minHeight
    : 56,
  height: `calc(100% - ${typeof theme.mixins.toolbar.minHeight === 'number' ? theme.mixins.toolbar.minHeight : 56}px)`,
})

export const DrawerHeader = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
}))

export interface AppBarProps extends MuiAppBarProps {
  open?: boolean
}

export interface StyledDrawerProps extends MuiDrawerProps {
  open?: boolean
}

export const AppBar = styled(MuiAppBar, {
  shouldForwardProp: prop => prop !== "open",
})<AppBarProps>(({ theme, open }) => ({
  zIndex: theme.zIndex.drawer + 1,
  transition: theme.transitions.create(["width", "margin"], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  ...(open && {
    marginLeft: DRAWER_WIDTH,
    width: `calc(100% - ${DRAWER_WIDTH}px)`,
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
}))

export const Drawer = styled(MuiDrawer, {
  shouldForwardProp: prop => prop !== "open",
})<StyledDrawerProps>(({ theme, open }) => ({
  width: DRAWER_WIDTH,
  flexShrink: 0,
  whiteSpace: open ? "normal" : "nowrap",
  boxSizing: "border-box",
  ...(open && {
    ...openedMixin(theme),
    "& .MuiDrawer-paper": openedMixin(theme),
  }),
  ...(!open && {
    ...closedMixin(theme),
    "& .MuiDrawer-paper": closedMixin(theme),
  }),
}))
