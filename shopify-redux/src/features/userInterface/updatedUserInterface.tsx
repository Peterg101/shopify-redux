import { useRef } from "react";
import { Box, Badge, ListItemButton, ListItemIcon, IconButton, Typography, List, Divider, Tooltip, useMediaQuery } from "@mui/material";
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
import { useGetUserBasketQuery, useGetUserOrdersQuery, useGetUserTasksQuery } from "../../services/authApi";
import { SidebarItem } from "../../app/utility/interfaces";
import { LeftDrawerList } from "./leftDrawerFragments";
import { ProfilePage } from "./profilePage";
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { EmptyOrderHistory, OrderHistory } from "./orderHistoryFragments";

interface UpdatedUserInterfaceProps {
  visibleItems?: string[];
}

export const UpdatedUserInterface = ({ visibleItems }: UpdatedUserInterfaceProps) => {
  const userInterfaceState = useSelector((state: RootState) => state.userInterfaceState);
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { data: basketItems = [] } = useGetUserBasketQuery();
  const { data: orders = [] } = useGetUserOrdersQuery();
  const { data: tasks = [] } = useGetUserTasksQuery();

  const openDrawer = (itemText: string) => {
    if (userInterfaceState.leftDrawerOpen && userInterfaceState.selectedComponent === itemText) {
      dispatch(setLeftDrawerClosed());
      dispatch(setSelectedComponent({ selectedComponent: "" }));
    } else {
      if (!userInterfaceState.leftDrawerOpen) {
        dispatch(setLeftDrawerOpen());
      }
      dispatch(setSelectedComponent({ selectedComponent: itemText }));
    }
  };

  const handleDrawerClose = () => {
    dispatch(setLeftDrawerClosed());
    dispatch(setSelectedComponent({ selectedComponent: "" }));
  };

  const resultsItems: SidebarItem[] = [
    {
      text: "Profile",
      icon: <AccountBoxIcon />,
    },
    {
      text: "Gen AI History",
      icon: (
        <Badge
          badgeContent={tasks.length}
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
          badgeContent={basketItems.length}
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
  ].filter((item) => !visibleItems || visibleItems.includes(item.text));

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
              {basketItems.length === 0 ? <EmptyBasket /> : <Basket />}
              <Divider sx={{ my: 1 }} />
            </List>
          </Box>
        );
      case "Order History":
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <List component="nav" sx={{ flexGrow: 1 }}>
              {orders.length === 0 ? <EmptyOrderHistory /> : <OrderHistory />}
              <Divider sx={{ my: 1 }} />
            </List>
          </Box>
        );
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
        variant={isMobile ? "temporary" : "permanent"}
        ref={drawerRef}
        open={userInterfaceState.leftDrawerOpen}
        onClose={handleDrawerClose}
      >
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

        {!userInterfaceState.leftDrawerOpen && !isMobile && (
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
