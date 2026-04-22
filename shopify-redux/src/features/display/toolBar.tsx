import { useState } from 'react';
import { Box, TextField, Typography, Button, IconButton, Tooltip, Snackbar } from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../app/store';
import { ChangeEvent } from 'react';
import { setFileNameBoxValue, resetDataState } from '../../services/dataSlice';
import { resetCadState } from '../../services/cadSlice';
import { resetConversation } from '../../services/cadChatSlice';
import { selectTotalCost } from '../../services/selectors';
import { useSubmitFeedbackMutation } from '../../services/authApi';
import { monoFontFamily, borderSubtle, borderHover, bgHighlight, bgHighlightHover, glowSubtle } from '../../theme';
import { AddToBasket } from '../userInterface/addToBasket';

export const ToolBar = () => {
  const dispatch = useDispatch();
  const dataState = useSelector((state: RootState) => state.dataState);
  const totalCost = useSelector(selectTotalCost);
  const [submitFeedback] = useSubmitFeedbackMutation();
  const [liked, setLiked] = useState(false);
  const [snackOpen, setSnackOpen] = useState(false);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    dispatch(setFileNameBoxValue({ fileNameBoxValue: event.target.value }));
  };

  const handleClear = () => {
    dispatch(resetDataState());
    dispatch(resetCadState());
    dispatch(resetConversation());
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

      <TextField
        label="File Name"
        variant="outlined"
        size="small"
        value={dataState.fileNameBoxValue}
        onChange={handleChange}
        sx={{ flexGrow: 1, minWidth: 150 }}
      />

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

      {dataState.taskId && (
        <Tooltip title={liked ? 'Thanks!' : 'This looks great — help improve future generations'}>
          <IconButton
            size="small"
            onClick={async () => {
              if (liked || !dataState.taskId) return;
              try {
                await submitFeedback({ taskId: dataState.taskId, rating: 'up' });
                setLiked(true);
                setSnackOpen(true);
              } catch { /* non-critical */ }
            }}
            sx={{
              color: liked ? 'primary.main' : 'text.secondary',
              transition: 'color 0.2s',
              '&:hover': { color: 'primary.main' },
            }}
          >
            {liked ? <ThumbUpIcon /> : <ThumbUpOutlinedIcon />}
          </IconButton>
        </Tooltip>
      )}

      <AddToBasket />

      <Snackbar
        open={snackOpen}
        autoHideDuration={3000}
        onClose={() => setSnackOpen(false)}
        message="Thanks! This design will help improve future generations."
      />
    </Box>
  );
};
