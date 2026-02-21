import { useRef, useState, useEffect } from "react";
import { Box, Badge, ListItemButton, ListItemIcon, IconButton, Typography, List, Divider, Tooltip } from "@mui/material";
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import { Basket, EmptyBasket } from "./basketFragments";
import AccountBoxIcon from '@mui/icons-material/AccountBox';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ShoppingBasketIcon from '@mui/icons-material/ShoppingBasket';
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import { useTheme } from "@mui/material/styles";
import { Drawer, DrawerHeader } from './uiComponents';
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { setLeftDrawerClosed, setLeftDrawerOpen, setSelectedComponent } from "../../services/userInterfaceSlice";
import { SidebarItem } from "../../app/utility/interfaces";
import { LeftDrawerList } from "./leftDrawerFragments";
import { ProfilePage } from "./profilePage";
import { FloatingCostSummary } from "../display/floatingCostSummary";
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { EmptyOrderHistory, OrderHistory } from "./orderHistoryFragments";
import { colorOscillationStyle } from "../shared/animations";

export const UpdatedUserInterface = () => {
  const [animationTriggered, setAnimationTriggered] = useState(false);

  const userInterfaceState = useSelector((state: RootState) => state.userInterfaceState);
  const dataState = useSelector((state: RootState) => state.dataState);
  const dispatch = useDispatch();
  const theme = useTheme();

  const openDrawer = (itemText: string) => {
    if (userInterfaceState.leftDrawerOpen && userInterfaceState.selectedComponent === itemText) {
      // Same icon clicked while open — close
      dispatch(setLeftDrawerClosed());
      dispatch(setSelectedComponent({ selectedComponent: "" }));
    } else {
      // Different icon or drawer was closed — open/switch
      if (!userInterfaceState.leftDrawerOpen) {
        dispatch(setLeftDrawerOpen()); // toggles false → true
      }
      dispatch(setSelectedComponent({ selectedComponent: itemText }));
    }
  };

  const handleDrawerClose = () => {
    dispatch(setLeftDrawerClosed());
    dispatch(setSelectedComponent({ selectedComponent: "" }));
  };

  useEffect(() => {
    if (dataState) {
      setAnimationTriggered(true);
      const timer = setTimeout(() => {
        setAnimationTriggered(false);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [dataState]);

  const resultsItems: SidebarItem[] = [
    {
      text: "Profile",
      icon: <AccountBoxIcon />,
    },
    {
      text: "Gen AI History",
      icon: (
        <Badge
          badgeContent={userInterfaceState.userInformation?.tasks.length}
          color="secondary"
          anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        >
          <AutoAwesomeIcon />
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
          <ShoppingBasketIcon />
        </Badge>
      ),
    },
    {
      text: "Order History",
      icon: (
        <Badge
          color="secondary"
          anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        >
          <LocalShippingIcon />
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
          </Box>
        );
      case "Order History":
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <List component="nav" sx={{ flexGrow: 1 }}>
              {userInterfaceState.userInformation?.orders.length === 0 ? <EmptyOrderHistory /> : <OrderHistory />}
              <Divider sx={{ my: 1 }} />
            </List>
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
      <Tooltip title={item.text} placement="right" key={index}>
        <ListItemButton
          selected={userInterfaceState.leftDrawerOpen && userInterfaceState.selectedComponent === item.text}
          onClick={() => openDrawer(item.text)}
          sx={{
            minHeight: 48,
            justifyContent: userInterfaceState.leftDrawerOpen ? 'initial' : 'center',
            px: 2.5,
          }}
        >
          <ListItemIcon
            sx={{
              minWidth: 0,
              mr: userInterfaceState.leftDrawerOpen ? 2 : 'auto',
              justifyContent: 'center',
            }}
          >
            {item.icon}
          </ListItemIcon>
        </ListItemButton>
      </Tooltip>
    ));
  };

  const drawerRef = useRef<HTMLDivElement | null>(null);

  return (
    <div>
      <Drawer
        variant="permanent"
        ref={drawerRef}
        drawerWidth={userInterfaceState.drawerWidth}
        open={userInterfaceState.leftDrawerOpen}
      >
        {/* Only show header with title and close button when open */}
        {userInterfaceState.leftDrawerOpen && (
          <DrawerHeader sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
              {userInterfaceState.selectedComponent}
            </Typography>
            <IconButton onClick={handleDrawerClose}>
              <ChevronLeftIcon />
            </IconButton>
          </DrawerHeader>
        )}

        {/* When closed: show icon strip. When open: show content only */}
        {!userInterfaceState.leftDrawerOpen && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, py: 1 }}>
            {sidebarItems(resultsItems)}
          </Box>
        )}

        {userInterfaceState.leftDrawerOpen && (
          <Box sx={{ p: 2, overflow: 'auto', flexGrow: 1 }}>
            {renderResultsOptionsComponent()}
          </Box>
        )}
      </Drawer>
    </div>
  );
};
