import { Box, useTheme, Container, List, ListItem, Paper, Typography, Divider} from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { OrderCard } from "./orderCard";
import React from "react";
import { visibleOrders } from "../../app/utility/utils";

export const FulfillOptions = () =>{
    const theme = useTheme();
    const userInterfaceState = useSelector(
        (state: RootState) => state.userInterfaceState
      );
    const drawerWidth = 100


    const styles = {
      container: { mt: 4, mb: 4 },
      paper: { p: 2, display: "flex", flexDirection: "column", height: 800, marginLeft: 10, marginRight: 2 },
      viewPort: { display: "flex", alignItems: "center", justifyContent: "space-between" },
      fileBox: { textAlign: "center", minHeight: "20px" },
      fileInput: {
        marginTop: 10,
        marginLeft: userInterfaceState.leftDrawerOpen && {
          marginLeft: drawerWidth,
          width: `calc(100% - ${drawerWidth}px)`,
          transition: theme.transitions.create(["width", "margin"], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        },
      },
    };
    const visible_claimable_orders = visibleOrders(userInterfaceState.userInformation.user, userInterfaceState.userInformation.claimable_orders)
      return (
        <Box sx={styles.fileInput}>
          <Container maxWidth="lg" sx={styles.container}>
            <Paper>
              {(visible_claimable_orders.length === 0) ? (
                <Typography variant="h6" align="center" color="text.secondary" sx={{ mt: 4 }}>
                  No orders available at the moment.
                </Typography>
              ) : (
                <List>
                  {visible_claimable_orders.map((order, index) => (
                    <React.Fragment key={order.order_id}>
                      <ListItem>
                        <OrderCard {...order} />
                      </ListItem>
                      {index < visible_claimable_orders.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              )}
            </Paper>
          </Container>
        </Box>
      );
}