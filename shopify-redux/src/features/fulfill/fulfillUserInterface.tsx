import { useRef } from "react";
import { Box, ListItemButton, ListItemIcon, IconButton, Typography, Tooltip } from "@mui/material";
import AccountBoxIcon from '@mui/icons-material/AccountBox';
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import { Drawer, DrawerHeader } from '../userInterface/uiComponents';
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { setLeftDrawerClosed, setLeftDrawerOpen, setSelectedComponent } from "../../services/userInterfaceSlice";
import { SidebarItem } from "../../app/utility/interfaces";
import { ProfilePage } from "../userInterface/profilePage";
import CategoryIcon from '@mui/icons-material/Category';

export const FulfillUserInterface = () => {
  const userInterfaceState = useSelector((state: RootState) => state.userInterfaceState);
  const dispatch = useDispatch();

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
      text: "Claimed Orders",
      icon: <CategoryIcon />,
    },
  ];

  const renderResultsOptionsComponent = () => {
    switch (userInterfaceState.selectedComponent) {
      case "Profile":
        return <ProfilePage />;
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
