import { Box, TextField, Typography, Button, CircularProgress, Chip } from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../app/store';
import { ChangeEvent } from 'react';
import { setFileNameBoxValue, resetDataState } from '../../services/dataSlice';
import { resetCadState } from '../../services/cadSlice';
import { setMeshyRefining, setMeshyPending, setMeshyPreviewTaskId, resetMeshyState } from '../../services/meshySlice';
import { startRefineTask } from '../../services/fetchFileUtils';
import { connectProgressStream } from '../../services/progressStream';
import { useFile } from '../../services/fileProvider';
import { generateUuid } from '../../app/utility/collectionUtils';
import { selectTotalCost } from '../../services/selectors';
import { monoFontFamily, borderSubtle, borderHover, bgHighlight, bgHighlightHover, glowSubtle, glowMedium } from '../../theme';
import { AddToBasket } from '../userInterface/addToBasket';

export const ToolBar = () => {
  const dispatch = useDispatch();
  const dataState = useSelector((state: RootState) => state.dataState);
  const userInformation = useSelector((state: RootState) => state.userInterfaceState.userInformation);
  const meshyState = useSelector((state: RootState) => state.meshyState);
  const totalCost = useSelector(selectTotalCost);
  const meshyPreviewTaskId = meshyState.meshyPreviewTaskId;
  const meshyRefining = meshyState.meshyRefining;
  const { setActualFile } = useFile();

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    dispatch(setFileNameBoxValue({ fileNameBoxValue: event.target.value }));
  };

  const handleClear = () => {
    dispatch(resetDataState());
    dispatch(resetCadState());
    dispatch(resetMeshyState());
  };

  const handleRefine = async () => {
    if (!meshyPreviewTaskId || !userInformation) return;
    const portId = generateUuid();
    dispatch(setMeshyRefining({ meshyRefining: true }));
    dispatch(setMeshyPending({ meshyPending: true }));
    dispatch(setMeshyPreviewTaskId({ meshyPreviewTaskId: null }));
    await startRefineTask(meshyPreviewTaskId, userInformation.user.user_id, portId);
    connectProgressStream(portId, 'meshy', dispatch, setActualFile);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 1.5,
        p: 1.5,
        mb: 3,
        borderRadius: 3,
        border: `1px solid ${borderSubtle}`,
        backgroundColor: bgHighlight,
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Clear Button */}
      <Button
        variant="outlined"
        size="small"
        startIcon={<ClearIcon />}
        onClick={handleClear}
        sx={{
          transition: 'all 0.2s ease',
          '&:hover': {
            borderColor: 'error.main',
            color: 'error.main',
          },
        }}
      >
        Clear
      </Button>

      {/* File Name */}
      <TextField
        label="File Name"
        variant="outlined"
        size="small"
        value={dataState.fileNameBoxValue}
        onChange={handleChange}
        sx={{ flexGrow: 1, minWidth: 150 }}
      />

      {/* Cost Badge */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: bgHighlightHover,
          border: `1px solid ${borderHover}`,
          borderRadius: 2,
          px: 2,
          py: 0.75,
          boxShadow: `0 0 12px ${glowSubtle}`,
        }}
      >
        <Typography
          variant="body1"
          sx={{
            fontFamily: monoFontFamily,
            fontWeight: 700,
            color: 'primary.main',
            fontSize: '1.1rem',
          }}
        >
          {'\u00a3'}{totalCost.toFixed(2)}
        </Typography>
      </Box>

      {/* Refine Button */}
      {meshyPreviewTaskId && !meshyRefining && (
        <Button
          variant="outlined"
          size="small"
          startIcon={<AutoFixHighIcon />}
          onClick={handleRefine}
          sx={{
            transition: 'all 0.2s ease',
            '&:hover': {
              borderColor: 'primary.main',
              boxShadow: `0 0 12px ${glowMedium}`,
            },
          }}
        >
          Refine
        </Button>
      )}
      {meshyRefining && (
        <Chip
          label="Refining..."
          size="small"
          icon={<CircularProgress size={14} />}
          sx={{ borderColor: 'primary.main' }}
          variant="outlined"
        />
      )}

      {/* Add to Basket */}
      <AddToBasket />
    </Box>
  );
};
