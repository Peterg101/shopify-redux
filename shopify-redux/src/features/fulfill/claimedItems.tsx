import { Box, Typography, Container, Paper, List, ListItem, Divider} from "@mui/material";
import { useSelector } from "react-redux";
import { RootState } from "../../app/store";
import React from "react";
import { ClaimCard } from "./claimCard";

export const ClaimedItems = () => {
  const userInterfaceState = useSelector(
    (state: RootState) => state.userInterfaceState
  );

  return (
    <Box>
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
                          <ClaimCard claim={claim} />
                        </ListItem>
                        {index < userInterfaceState.userInformation.orders.length - 1 && <Divider />}
                      </React.Fragment>
                  ))}
                </List>
              )}
        </Paper>
      </Container>
    </Box>
  );
};