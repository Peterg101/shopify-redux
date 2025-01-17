import React, { useState, useRef, useMemo } from 'react';
import { styled, createTheme, ThemeProvider } from '@mui/material/styles';
import { Drawer } from './drawer';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import MuiAppBar, { AppBarProps as MuiAppBarProps } from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import {ShoppingBasket, ChevronLeft, ChevronRight, Menu} from '@mui/icons-material';
import Badge from '@mui/material/Badge';
import List from '@mui/material/List';
import { UploadedFile } from '../../app/utility/interfaces';
import { EmptyBasket, Basket } from './basketFragments';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../app/store';
import { setRightDrawerOpen, setLeftDrawerOpen } from '../../services/userInterfaceSlice';
import { LeftDrawerList } from './leftDrawerFragments';

const AppBar = styled(MuiAppBar)<MuiAppBarProps>(({ theme }) => ({
  zIndex: theme.zIndex.drawer + 1,
  transition: theme.transitions.create(['width', 'margin'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
}));

const defaultTheme = createTheme();

export default function UserInterface() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const dispatch = useDispatch()
  const userInterfaceState = useSelector(
    (state: RootState) => state.userInterfaceState,
  )
  const fileInputRef = useRef<HTMLInputElement>(null);


  const toggleRightDrawer = () => {
    dispatch(setRightDrawerOpen())
  };

  const toggleLeftDrawer = () => {
    dispatch(setLeftDrawerOpen())
  };

  return (
    <ThemeProvider theme={defaultTheme}>
      <CssBaseline />
      <AppBar position="fixed">
        <Toolbar sx={{ pr: '24px' }}>
          <IconButton edge="start" color="inherit" aria-label="open left drawer" onClick={toggleLeftDrawer}>
            {userInterfaceState.leftDrawerOpen ? <ChevronLeft /> : <Menu />}
          </IconButton>
          <Typography component="h1" variant="h6" color="inherit" noWrap sx={{ flexGrow: 1 }}>
            FITD
          </Typography>
          <IconButton edge="end" color="inherit" aria-label="open right drawer" onClick={toggleRightDrawer} sx={{ marginLeft: 'auto' }}>
            <Badge badgeContent={userInterfaceState.userInformation?.basket_items.length} color="secondary">
              {userInterfaceState.rightDrawerOpen ? <ChevronRight /> : <ShoppingBasket />}
            </Badge>
          </IconButton>
        </Toolbar>
      </AppBar>      
      <Drawer variant="permanent" open={userInterfaceState.rightDrawerOpen} drawerWidth = {userInterfaceState.drawerWidth} anchor="right">
        <Toolbar sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', px: [1] }}>
          <IconButton onClick={toggleRightDrawer}>
            <ChevronLeft />
          </IconButton>
        </Toolbar>
        <Divider />
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <List component="nav" sx={{ flexGrow: 1 }}>
            {userInterfaceState.userInformation?.basket_items.length === 0 ? <EmptyBasket/> : <Basket/>}
            <Divider sx={{ my: 1 }} />
          </List>
          <Box sx={{ marginTop: 'auto', padding: 2 }}>
          </Box>
        </Box>
      </Drawer>
      <Drawer variant="permanent" open={userInterfaceState.leftDrawerOpen} anchor="left" drawerWidth = {userInterfaceState.drawerWidth}>
        <Toolbar sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', px: [1] }}>
          <IconButton onClick={toggleLeftDrawer}>
            <ChevronRight />
          </IconButton>
        </Toolbar>
        <Divider />
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <LeftDrawerList/>
        </Box>
      </Drawer>
    </ThemeProvider>
  );
}
