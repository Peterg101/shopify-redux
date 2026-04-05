import { useState, useMemo } from 'react';
import {
  Box, Typography, TextField, InputAdornment, IconButton,
  Collapse, Pagination, Chip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import HistoryIcon from '@mui/icons-material/History';
import { useGetUserTasksQuery } from '../../services/authApi';
import { LeftDrawerTask } from '../userInterface/leftDrawerFragments';
import { borderSubtle, bgHighlight } from '../../theme';

const PAGE_SIZE = 5;

export const GenerationHistoryPanel = () => {
  const { data: tasks = [] } = useGetUserTasksQuery();
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filteredTasks = useMemo(() => {
    if (!search.trim()) return tasks;
    const q = search.toLowerCase();
    return tasks.filter((t: any) =>
      t.task_name.toLowerCase().includes(q) ||
      t.file_type.toLowerCase().includes(q)
    );
  }, [tasks, search]);

  const totalPages = Math.ceil(filteredTasks.length / PAGE_SIZE);
  const paginatedTasks = filteredTasks.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset page when search changes
  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  if (tasks.length === 0) return null;

  return (
    <Box sx={{ mt: 3, border: `1px solid ${borderSubtle}`, borderRadius: 3, overflow: 'hidden' }}>
      {/* Header — always visible, click to toggle */}
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.5,
          px: 2.5, py: 1.5, cursor: 'pointer',
          '&:hover': { backgroundColor: bgHighlight },
        }}
      >
        <HistoryIcon sx={{ color: 'primary.main', fontSize: 20 }} />
        <Typography variant="subtitle1" fontWeight={600} sx={{ flex: 1 }}>
          Recent Generations
        </Typography>
        <Chip
          label={tasks.length}
          size="small"
          sx={{ height: 22, fontSize: '0.75rem', backgroundColor: borderSubtle, color: 'primary.main' }}
        />
        <IconButton size="small" sx={{ color: 'text.secondary' }}>
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>

      {/* Collapsible content */}
      <Collapse in={expanded}>
        <Box sx={{ borderTop: `1px solid ${borderSubtle}` }}>
          {/* Search */}
          {tasks.length > 3 && (
            <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
              <TextField
                size="small"
                fullWidth
                placeholder="Search by name or file type..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
          )}

          {/* Task list */}
          <Box sx={{ px: 2, pb: 1 }}>
            {paginatedTasks.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                {search ? 'No matching generations' : 'No generations yet'}
              </Typography>
            ) : (
              paginatedTasks.map((task: any) => (
                <LeftDrawerTask key={task.task_id} {...task} />
              ))
            )}
          </Box>

          {/* Pagination */}
          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', pb: 2 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, p) => setPage(p)}
                size="small"
                sx={{
                  '& .MuiPaginationItem-root': { color: 'text.secondary' },
                  '& .Mui-selected': { backgroundColor: `${borderSubtle} !important`, color: 'primary.main' },
                }}
              />
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  );
};
