import { Box, useTheme, Typography, Stack, Container } from "@mui/material";
import { useSelector } from "react-redux";
import { RootState } from "../../app/store";

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
        <Stack spacing={2}>
          <Typography variant="h5">Claimed Items</Typography>
          <Typography variant="h5">Claimed Items</Typography>
          <Typography variant="h5">Claimed Items</Typography>
          <Typography variant="h5">Claimed Items</Typography>
        </Stack>
      </Container>
    </Box>
  );
};