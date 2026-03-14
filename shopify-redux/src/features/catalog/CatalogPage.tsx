import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import {
  Box,
  Typography,
  TextField,
  Grid,
  MenuItem,
  InputAdornment,
  CircularProgress,
  Pagination,
  useTheme,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { RootState } from "../../app/store";
import { setLeftDrawerClosed, setSelectedComponent } from "../../services/userInterfaceSlice";
import { HeaderBar } from "../userInterface/headerBar";
import { UpdatedUserInterface } from "../userInterface/updatedUserInterface";
import { DRAWER_WIDTH } from "../userInterface/uiComponents";
import { useGetPartsQuery } from "../../services/catalogApi";
import { PartCard } from "./PartCard";

const FILE_TYPES = ["", "stl", "obj", "step"];
const PAGE_SIZE = 12;

export const CatalogPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const theme = useTheme();
  const userInterfaceState = useSelector((state: RootState) => state.userInterfaceState);
  const collapsedWidth = `calc(${theme.spacing(8)} + 1px)`;
  const [search, setSearch] = useState("");
  const [fileType, setFileType] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    dispatch(setLeftDrawerClosed());
    dispatch(setSelectedComponent({ selectedComponent: "" }));
  }, []);

  const { data, isLoading } = useGetPartsQuery({
    q: search || undefined,
    file_type: fileType || undefined,
    category: category || undefined,
    page,
    page_size: PAGE_SIZE,
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  const contentMargin = userInterfaceState.leftDrawerOpen
    ? `${DRAWER_WIDTH}px`
    : collapsedWidth;

  return (
    <Box>
      <HeaderBar />
      <UpdatedUserInterface visibleItems={["Basket"]} />
      <Box sx={{
        display: "flex", flexDirection: "column", gap: 3,
        pt: 10, pb: 6, px: { xs: 2, md: 4 },
        marginLeft: contentMargin,
        transition: theme.transitions.create(["margin"], {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.enteringScreen,
        }),
      }}>
      <Typography variant="h5" fontWeight={600}>
        Parts Catalog
      </Typography>

      {/* Filters */}
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        <TextField
          placeholder="Search parts..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          size="small"
          sx={{ flex: 1, minWidth: 200 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          label="File Type"
          value={fileType}
          onChange={(e) => {
            setFileType(e.target.value);
            setPage(1);
          }}
          select
          size="small"
          sx={{ minWidth: 120 }}
        >
          <MenuItem value="">All</MenuItem>
          {FILE_TYPES.filter(Boolean).map((ft) => (
            <MenuItem key={ft} value={ft}>
              {ft.toUpperCase()}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Category"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          size="small"
          sx={{ minWidth: 140 }}
          placeholder="e.g. hardware"
        />
      </Box>

      {/* Grid */}
      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : data && data.parts.length > 0 ? (
        <>
          <Grid container spacing={2}>
            {data.parts.map((part) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={part.id}>
                <PartCard
                  part={part}
                  onClick={(partId) => navigate(`/catalog/${partId}`)}
                />
              </Grid>
            ))}
          </Grid>
          {totalPages > 1 && (
            <Box sx={{ display: "flex", justifyContent: "center" }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_e, p) => setPage(p)}
                color="primary"
              />
            </Box>
          )}
          <Typography variant="caption" color="text.secondary" textAlign="center">
            {data.total} part{data.total !== 1 ? "s" : ""} found
          </Typography>
        </>
      ) : (
        <Box sx={{ textAlign: "center", py: 6 }}>
          <Typography variant="h6" color="text.secondary">
            No parts found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {search || fileType || category
              ? "Try adjusting your filters"
              : "Be the first to publish a design!"}
          </Typography>
        </Box>
      )}
      </Box>
    </Box>
  );
};
