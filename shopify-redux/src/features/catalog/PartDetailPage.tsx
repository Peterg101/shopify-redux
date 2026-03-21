import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import {
  Box,
  Typography,
  Chip,
  Button,
  Card,
  CardContent,
  CircularProgress,
  IconButton,
  useTheme,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DownloadIcon from "@mui/icons-material/Download";
import { RootState } from "../../app/store";
import { setLeftDrawerClosed, setSelectedComponent } from "../../services/userInterfaceSlice";
import { HeaderBar } from "../userInterface/headerBar";
import { UpdatedUserInterface } from "../userInterface/updatedUserInterface";
import { DRAWER_WIDTH } from "../userInterface/uiComponents";
import { useGetPartDetailQuery } from "../../services/catalogApi";
import PartDetailViewer from "./PartDetailViewer";
import { PartConfigSidebar } from "./PartConfigSidebar";

export const PartDetailPage = () => {
  const { partId } = useParams<{ partId: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const theme = useTheme();
  const userInterfaceState = useSelector((state: RootState) => state.userInterfaceState);
  const collapsedWidth = `calc(${theme.spacing(8)} + 1px)`;
  const [viewerColour, setViewerColour] = useState("white");

  useEffect(() => {
    dispatch(setLeftDrawerClosed());
    dispatch(setSelectedComponent({ selectedComponent: "" }));
  }, [dispatch]);

  const { data: part, isLoading, error } = useGetPartDetailQuery(partId!, {
    skip: !partId,
  });

  const contentMargin = userInterfaceState.leftDrawerOpen
    ? `${DRAWER_WIDTH}px`
    : collapsedWidth;

  const transitionSx = {
    marginLeft: contentMargin,
    transition: theme.transitions.create(["margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  };

  if (isLoading) {
    return (
      <Box>
        <HeaderBar />
        <UpdatedUserInterface visibleItems={["Basket"]} />
        <Box sx={{ display: "flex", justifyContent: "center", py: 6, ...transitionSx }}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  if (error || !part) {
    return (
      <Box>
        <HeaderBar />
        <UpdatedUserInterface visibleItems={["Basket"]} />
        <Box sx={{ pt: 12, px: 4, ...transitionSx }}>
          <Typography color="error">Part not found</Typography>
          <Button onClick={() => navigate("/catalog")} sx={{ mt: 1 }}>
            Back to Catalog
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <HeaderBar />
      <UpdatedUserInterface />
      <Box sx={{
        display: "flex",
        height: "calc(100vh - 64px)",
        ...transitionSx,
      }}>
        {/* Left panel — viewer + metadata */}
        <Box sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "auto",
          pt: 10,
          pb: 4,
          px: { xs: 2, md: 3 },
          gap: 2,
        }}>
          {/* Header */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <IconButton onClick={() => navigate("/catalog")} size="small">
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h5" fontWeight={600} sx={{ flexGrow: 1 }}>
              {part.name}
            </Typography>
          </Box>

          {/* 3D Viewer */}
          <Box sx={{ flex: 1, minHeight: 400 }}>
            <PartDetailViewer
              taskId={part.task_id}
              fileType={part.file_type}
              colour={viewerColour}
            />
          </Box>

          {/* Description / Tags / Metadata */}
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent>
              {part.description && (
                <Typography variant="body2" sx={{ mb: 2 }}>
                  {part.description}
                </Typography>
              )}

              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 2 }}>
                <Chip label={part.file_type.toUpperCase()} size="small" color="primary" />
                {part.category && <Chip label={part.category} size="small" variant="outlined" />}
                {part.recommended_process && (
                  <Chip label={part.recommended_process} size="small" variant="outlined" />
                )}
                {part.recommended_material && (
                  <Chip label={part.recommended_material} size="small" variant="outlined" />
                )}
              </Box>

              {part.tags && part.tags.length > 0 && (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 2 }}>
                  {part.tags.map((tag) => (
                    <Chip key={tag} label={tag} size="small" variant="outlined" color="default" />
                  ))}
                </Box>
              )}

              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "text.secondary" }}>
                <DownloadIcon sx={{ fontSize: 16 }} />
                <Typography variant="body2">{part.download_count} orders</Typography>
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Right sidebar */}
        <PartConfigSidebar part={part} onColourChange={setViewerColour} />
      </Box>
    </Box>
  );
};
