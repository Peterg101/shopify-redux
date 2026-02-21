import { Box, Container, List, ListItem, Paper, Typography, Divider } from "@mui/material";
import { useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { OrderCard } from "./orderCard";
import React from "react";
import { visibleOrders } from "../../app/utility/utils";
import AssignmentIcon from "@mui/icons-material/Assignment";

export const FulfillOptions = () => {
  const userInterfaceState = useSelector(
    (state: RootState) => state.userInterfaceState
  );

  if (!userInterfaceState.userInformation?.user?.user_id) {
    return <Typography sx={{ p: 4, textAlign: 'center' }}>Loading...</Typography>;
  }

  const visible_claimable_orders = visibleOrders(
    userInterfaceState.userInformation.user,
    userInterfaceState.userInformation.claimable_orders ?? []
  );

  return (
    <Box>
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Paper sx={{ p: 2, minHeight: '60vh' }}>
          {visible_claimable_orders.length === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8, gap: 2 }}>
              <AssignmentIcon sx={{ fontSize: 64, color: 'text.secondary', opacity: 0.5 }} />
              <Typography variant="h6" align="center" color="text.secondary">
                No orders available at the moment.
              </Typography>
              <Typography variant="body2" align="center" color="text.secondary">
                Check back later for new orders to fulfill.
              </Typography>
            </Box>
          ) : (
            <List>
              {visible_claimable_orders.map((order, index) => (
                <React.Fragment key={order.order_id}>
                  <ListItem sx={{ display: 'block' }}>
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
