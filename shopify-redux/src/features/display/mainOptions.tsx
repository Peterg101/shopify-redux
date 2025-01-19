import { Box, Container, Grid, Paper } from "@mui/material";
import { FileViewer } from "./fileViewer";
import { ToolBar } from "./toolBar";
import { useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { styled, Theme, CSSObject, useTheme } from "@mui/material/styles"



export const MainOptions = () => {

  const userInterfaceState = useSelector(
    (state: RootState) => state.userInterfaceState
  )
  const theme = useTheme()
  const drawerWidth = userInterfaceState.drawerWidth
  const dataState = useSelector((state: RootState) => state.dataState)
  const styles = {
    container: { mt: 4, mb: 4 },
    paper: { p: 2, display: 'flex', flexDirection: 'column', height: 850, marginLeft: 10, marginRight: 2 },
    viewPort: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    fileBox: { textAlign: 'center', minHeight: '20px' },
    fileInput: { marginTop: 10, marginLeft: userInterfaceState.leftDrawerOpen && {
      marginLeft: drawerWidth,
      width: `calc(100% - ${drawerWidth}px)`,
      transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),

    }},

  };
  return (
    <Box sx={styles.fileInput}>
      <Container maxWidth="lg" sx={styles.container}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={8} lg={12}>
            <Paper sx={styles.paper}>
              {dataState.fileDisplay && <ToolBar/>}
              <FileViewer />
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};
