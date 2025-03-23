import { useRef, useState, useEffect } from "react";
import { Box, Container, Grid, Paper, Badge, ListItem, ListItemIcon, IconButton, Typography, List, Toolbar, Divider } from "@mui/material";
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import { Basket, EmptyBasket } from "./basketFragments"
import AccountBoxIcon from '@mui/icons-material/AccountBox';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ShoppingBasketIcon from '@mui/icons-material/ShoppingBasket';
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useTheme } from "@mui/material/styles";
import { AppBar, Drawer, DrawerHeader } from './uiComponents';
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { setLeftDrawerClosed, setLeftDrawerOpen, setSelectedComponent } from "../../services/userInterfaceSlice";
import { SidebarItem } from "../../app/utility/interfaces";
import { LeftDrawerList } from "./leftDrawerFragments";
import { ProfilePage } from "./profilePage";
import { FloatingCostSummary } from "../display/floatingCostSummary";

// Color oscillation style
const colorOscillationStyle = (theme: any) => ({
  animation: "oscillateColorAndJiggle 0.5s linear infinite", // Oscillating and jiggling
  "@keyframes oscillateColorAndJiggle": {
    "0%": {
      color: theme.palette.primary.main, // Primary color
      transform: "rotate(0deg) translateX(0)", // No rotation or translation at the start
    },
    "25%": {
      color: theme.palette.secondary.main, // Secondary color
      transform: "rotate(5deg) translateX(5px)", // Slight rotation and translation to the right
    },
    "50%": {
      color: theme.palette.primary.main, // Primary color
      transform: "rotate(0deg) translateX(0)", // Reset to the original position
    },
    "75%": {
      color: theme.palette.secondary.main, // Secondary color
      transform: "rotate(-5deg) translateX(-5px)", // Slight rotation and translation to the left
    },
    "100%": {
      color: theme.palette.primary.main, // Primary color
      transform: "rotate(0deg) translateX(0)", // Reset to the original position
    },
  },
});

export const UpdatedUserInterface = () => {
  const [animationTriggered, setAnimationTriggered] = useState(false);

  const userInterfaceState = useSelector((state: RootState) => state.userInterfaceState);
  const dataState = useSelector((state: RootState) => state.dataState);
  const dispatch = useDispatch();
  const theme = useTheme();

  const openDrawer = (index: string) => {
    dispatch(setLeftDrawerOpen());
    dispatch(setSelectedComponent({ selectedComponent: index }));
  };

  const handleDrawerClose = () => {
    dispatch(setLeftDrawerClosed());
    dispatch(setSelectedComponent({ selectedComponent: "" }));
  };

  // Trigger animation on dataState change
  useEffect(() => {
    if (dataState) {
      setAnimationTriggered(true);
      const timer = setTimeout(() => {
        setAnimationTriggered(false);
      }, 3000); // Reset after 3 seconds (duration of animation)

      return () => clearTimeout(timer);
    }
  }, [dataState]);

  const resultsItems: SidebarItem[] = [
    {
      text: "Profile",
      icon: (
        <AccountBoxIcon sx={{ fontSize: 40, marginTop: 1 }} />
      ),
    },
    {
      text: "Gen AI History",
      icon: (
        <Badge
          badgeContent={userInterfaceState.userInformation?.tasks.length}
          color="secondary"
          anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        >
          <AutoAwesomeIcon sx={{ fontSize: 40, marginTop: 1 }} />
        </Badge>
      ),
    },
    {
      text: "Basket",
      icon: (
        <Badge
          badgeContent={userInterfaceState.userInformation?.basket_items.length}
          color="secondary"
          anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        >
          <ShoppingBasketIcon sx={{ fontSize: 40, marginTop: 1 }} />
        </Badge>
      ),
    },
    ...(dataState.displayObjectConfig
      ? [
          {
            text: "Cost Summary",
            icon: (
              <AttachMoneyIcon
                sx={{
                  fontSize: 40,
                  marginTop: 1,
                  ...(animationTriggered ? colorOscillationStyle(theme) : {}),
                }}
              />
            ),
          },
        ]
      : []),
  ];

  const renderResultsOptionsComponent = () => {
    switch (userInterfaceState.selectedComponent) {
      case "Profile":
        return <ProfilePage />;
      case "Gen AI History":
        return <LeftDrawerList />;
      case "Basket":
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <List component="nav" sx={{ flexGrow: 1 }}>
              {userInterfaceState.userInformation?.basket_items.length === 0 ? <EmptyBasket /> : <Basket />}
              <Divider sx={{ my: 1 }} />
            </List>
            <Box sx={{ marginTop: 'auto', padding: 2 }} />
          </Box>
        );
      case "Cost Summary":
        return <FloatingCostSummary />;
      default:
        return null;
    }
  };

  const sidebarItems = (items: SidebarItem[]) => {
    return items.map((item, index) => (
      <ListItem button key={index} onClick={() => openDrawer(item.text)}>
        <ListItemIcon sx={{ marginRight: '16px' }}>{item.icon}</ListItemIcon>
      </ListItem>
    ));
  };

  const drawerRef = useRef<HTMLDivElement | null>(null);

  return (
    <div>
      <AppBar position="fixed" open={userInterfaceState.leftDrawerOpen} drawerWidth={userInterfaceState.drawerWidth}>
        <Toolbar>
          <Typography variant="h5" noWrap component="div">
            FITD
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ display: "flex", justifyContent: "flex-end" }} />
        </Toolbar>
      </AppBar>

      <Drawer
      // @ts-expect-error variant undefined
        variant={"permanent"}
        ref={drawerRef}
        drawerWidth={userInterfaceState.drawerWidth}
        open={userInterfaceState.leftDrawerOpen}
      >
        <DrawerHeader sx={{ display: "flex", justifyContent: "space-between" }}>
          <Typography variant="h5">
            {userInterfaceState.selectedComponent}
          </Typography>
          <IconButton onClick={() => handleDrawerClose()}>
            {theme.direction === "rtl" ? (
              <ChevronRightIcon />
            ) : (
              <ChevronLeftIcon />
            )}
          </IconButton>
        </DrawerHeader>

        {!userInterfaceState.leftDrawerOpen ? (
          sidebarItems(resultsItems)
        ) : (
          <Box sx={{ p: 2 }}>
            {renderResultsOptionsComponent()}
          </Box>
        )}
      </Drawer>
    </div>
  );
};