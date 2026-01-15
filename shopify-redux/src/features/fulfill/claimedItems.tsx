import { Box, useTheme, Typography, Stack, Container, Paper, List, ListItem, Divider} from "@mui/material";
import { useSelector } from "react-redux";
import { RootState } from "../../app/store";
import React from "react";

export const ClaimedItems = () => {
  const theme = useTheme();
  const userInterfaceState = useSelector(
    (state: RootState) => state.userInterfaceState
  );

  const drawerWidth = 100;

  return (
    <Box
      sx={{
        mt: 10,
        ...(userInterfaceState.leftDrawerOpen && {
          ml: `${drawerWidth}px`,
          width: `calc(100% - ${drawerWidth}px)`,
          transition: theme.transitions.create(["width", "margin"], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        }),
      }}
    >
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Paper>
            {(!userInterfaceState.userInformation.claims || userInterfaceState.userInformation.claims.length === 0) ? (
                <Typography variant="h6" align="center" color="text.secondary" sx={{ mt: 4 }}>
                  You haven't claimed anything yet.
                </Typography>
              ) : (
                <List>
                  {userInterfaceState.userInformation.claims.map((claim, index) => (
                    <React.Fragment key={claim.id}>
                      <ListItem>
                        <Typography>ITEM</Typography>
                      </ListItem>
                      {index < userInterfaceState.userInformation.claims.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              )}
        </Paper>
      </Container>
    </Box>
  );
};