import { Box, Container, Grid, Paper, Snackbar, Alert } from "@mui/material";
import { FileViewer } from "./fileViewer";
import { ToolBar } from "./toolBar";
import { useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { useEffect, useState } from "react";
import { useTheme } from "@mui/material/styles";

export const MainOptions = () => {
  const userInterfaceState = useSelector(
    (state: RootState) => state.userInterfaceState
  );
  const theme = useTheme();
  const drawerWidth = userInterfaceState.drawerWidth;
  const dataState = useSelector((state: RootState) => state.dataState);
  const [openToast, setOpenToast] = useState(false);

  useEffect(() => {
    if (dataState.displayObjectConfig) {
      setOpenToast(true);
      setTimeout(() => {
        setOpenToast(false);
      }, 3000);
    }
  }, [dataState.displayObjectConfig]);

  const collapsedWidth = `calc(${theme.spacing(8)} + 1px)`;

  return (
    <Box
      sx={{
        marginLeft: userInterfaceState.leftDrawerOpen ? `${drawerWidth}px` : collapsedWidth,
        transition: theme.transitions.create(["margin"], {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.enteringScreen,
        }),
      }}
    >
      <Container maxWidth="lg" sx={{ mt: 10, mb: 4 }}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Paper sx={{ p: 2, display: "flex", flexDirection: "column", minHeight: '70vh' }}>
              {dataState.fileDisplay && <ToolBar />}
              <FileViewer />
            </Paper>
          </Grid>
        </Grid>
      </Container>

      <Snackbar
        open={openToast}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        autoHideDuration={3000}
        onClose={() => setOpenToast(false)}
        sx={{ mt: 8 }}
      >
        <Alert onClose={() => setOpenToast(false)} severity="info" sx={{ width: "100%" }}>
          Keep track of your model costs in the cost summary menu in the sidebar!
        </Alert>
      </Snackbar>
    </Box>
  );
};
