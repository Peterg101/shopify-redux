import type React from "react"
import { useRef } from "react"
import ListItem from "@mui/material/ListItem"
import ListItemIcon from "@mui/material/ListItemIcon"
import IconButton from "@mui/material/IconButton"
import { useTheme } from "@mui/material/styles"
import { AppBar, Drawer, DrawerHeader } from './uiComponents'
import { Box, Divider, List, Toolbar, Typography } from "@mui/material"
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft"
import ChevronRightIcon from "@mui/icons-material/ChevronRight"
import { SidebarItem } from "../../app/utility/interfaces"
// import { SidebarItem } from "../results/resultsInterfaces"
import HistoryIcon from "@mui/icons-material/History"
// import { SearchHistory } from "../form/searchHistory"
// import { UserInterfaceProps } from "./displayInterfaces"
import { useDispatch, useSelector } from "react-redux"
import { RootState } from "../../app/store"
import ManageSearchIcon from "@mui/icons-material/ManageSearch"
import TuneIcon from "@mui/icons-material/Tune"
// import { InputTable } from "../form/inputsTable"
// import { useAppDispatch } from "../../app/hooks"
// import {
//   setDrawerOpen,
//   setSelectedComponent,
// } from "../../services/userInterfaceSlice"
// import { FilterComponent } from "./filterComponent"
import AccountBoxIcon from '@mui/icons-material/AccountBox';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ShoppingBasketIcon from '@mui/icons-material/ShoppingBasket';
import { setLeftDrawerClosed, setLeftDrawerOpen, setSelectedComponent } from "../../services/userInterfaceSlice"
import { Basket, EmptyBasket } from "./basketFragments"
import { LeftDrawerList } from "./leftDrawerFragments"

export const UpdatedUserInterface = () => {
  const userInterfaceState = useSelector(
    (state: RootState) => state.userInterfaceState,
  )
  const dispatch = useDispatch()

  const theme = useTheme()

  const openDrawer = (index: string) => {
    dispatch(setLeftDrawerOpen())
    dispatch(setSelectedComponent({ selectedComponent: index }))
  }

  const handleDrawerClose = () => {
    dispatch(setLeftDrawerClosed())
    dispatch(setSelectedComponent({ selectedComponent: "" }))
  }


  const resultsItems: SidebarItem[] = [
    {
      text: "Profile",
      icon: (
        <AccountBoxIcon
          sx={{ fontSize: 40, marginTop: 1 }}
          data-testid="account-icon"
        />
      ),
    },
    {
      text: "Gen AI History",
      icon: (
        <AutoAwesomeIcon
          sx={{ fontSize: 40, marginTop: 1 }}
          data-testid="ai-icon"
        />
      ),
    },
    {
        text: "Basket",
        icon: (
          <ShoppingBasketIcon
            sx={{ fontSize: 40, marginTop: 1 }}
            data-testid="basket-icon"
          />
        ),
      },
  ]

  const renderResultsOptionsComponent = () => {
    switch (userInterfaceState.selectedComponent) {
      case "Profile":
        return <h1>Profile</h1>
      case "Gen AI History":
        return (
          <LeftDrawerList/>
        )
      case "Basket":
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <List component="nav" sx={{ flexGrow: 1 }}>
            {userInterfaceState.userInformation?.basket_items.length === 0 ? <EmptyBasket/> : <Basket/>}
            <Divider sx={{ my: 1 }} />
          </List>
          <Box sx={{ marginTop: 'auto', padding: 2 }}>
          </Box>
        </Box>
        ) 
    }
  }


  const sidebarItems = (items: SidebarItem[]) => {
    return items.map((item, index) => (
      <ListItem button key={index} onClick={() => openDrawer(item.text)}>
        <ListItemIcon>{item.icon}</ListItemIcon>
      </ListItem>
    ))
  }

  const drawerRef = useRef<HTMLDivElement | null>(null)

  return (
    <div>
      <AppBar
        position="fixed"
        open={userInterfaceState.leftDrawerOpen}
        drawerWidth={userInterfaceState.drawerWidth}
      >
        <Toolbar>
          <Typography variant="h5" noWrap component="div">
            FITD
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ display: "flex", justifyContent: "flex-end" }}></Box>
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
              <ChevronRightIcon data-testid="right-icon" />
            ) : (
              <ChevronLeftIcon data-testid="left-icon" />
            )}
          </IconButton>
        </DrawerHeader>
        
        {!userInterfaceState.leftDrawerOpen ? (
          <>
            {sidebarItems(resultsItems)}
          </>
        ) : (
          <Box sx={{ p: 2 }}>
            {renderResultsOptionsComponent()}
          </Box>
        )}
      </Drawer>
    </div>
  )
}
