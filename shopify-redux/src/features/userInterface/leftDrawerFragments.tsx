import React from "react";
import { Typography, Button, Card, CardContent, Box, CircularProgress, LinearProgress } from "@mui/material";
import { AccessTime, Edit, Download, AutoAwesome } from "@mui/icons-material";
import { TaskInformation } from "../../app/utility/interfaces";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { useFile } from "../../services/fileProvider";
import { resetDataState, setFileProperties, setFromMeshyOrHistory } from "../../services/dataSlice";
import { extractFileInfo, fetchFile, fetchCadFile, isCadFileType } from "../../services/fetchFileUtils";
import { setLeftDrawerClosed } from "../../services/userInterfaceSlice";
import { resetCadState } from "../../services/cadSlice";
import { resetMeshyState } from "../../services/meshySlice";
import { downloadBlob } from "../../app/utility/utils";
import { useGetUserTasksQuery } from "../../services/authApi";

const formatRelativeTime = (dateString: string): string => {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

export function LeftDrawerTask(task: TaskInformation) {
  const userInterfaceState = useSelector((state: RootState) => state.userInterfaceState);

  const isTaskLoading =
    userInterfaceState.userInformation.incomplete_task &&
    userInterfaceState.userInformation.incomplete_task.task_id === task.task_id;

  return (
    <Card
      sx={{
        mb: 1.5,
        overflow: "hidden",
        border: '1px solid rgba(0, 229, 255, 0.12)',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          borderColor: 'rgba(0, 229, 255, 0.3)',
          boxShadow: '0 0 16px rgba(0, 229, 255, 0.1)',
        },
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <AutoAwesome sx={{ color: 'primary.main', fontSize: 18, flexShrink: 0 }} />
            <Typography variant="body1" fontWeight={600} noWrap>
              {task.task_name}
            </Typography>
          </Box>
          {isTaskLoading && (
            <CircularProgress size={16} thickness={4} sx={{ color: 'primary.main', flexShrink: 0 }} />
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, ml: 3.5 }}>
          <AccessTime sx={{ fontSize: 14, color: 'text.secondary' }} />
          <Typography variant="caption" color="text.secondary">
            {formatRelativeTime(task.created_at)}
          </Typography>
        </Box>

        {isTaskLoading ? (
          <LeftDrawerTaskLoading />
        ) : (
          <LeftDrawerButtons {...task} />
        )}
      </CardContent>
    </Card>
  );
};

export function LeftDrawerButtons(task: TaskInformation) {
  const { setActualFile } = useFile();
  const dispatch = useDispatch();

  const handleGetFile = async (fileId: string, filename: string, fileType: string, shouldDownload = false) => {
    setActualFile(null);
    dispatch(resetDataState());
    dispatch(resetCadState());
    dispatch(resetMeshyState());
    dispatch(setLeftDrawerClosed());

    let file: File;
    let fileUrl: string;

    if (isCadFileType(fileType)) {
      const cadResult = await fetchCadFile(fileId);
      file = cadResult.file;
      fileUrl = cadResult.fileUrl;
    } else {
      const data = await fetchFile(fileId);
      const fileInfo = extractFileInfo(data, filename);
      file = fileInfo.file;
      fileUrl = fileInfo.fileUrl;
    }

    if (shouldDownload) {
      const ext = isCadFileType(fileType) ? '.glb' : '.obj';
      downloadBlob(file, filename.endsWith(ext) ? filename : `${filename}${ext}`);
    } else {
      setActualFile(file);
      dispatch(setFromMeshyOrHistory({ fromMeshyOrHistory: true }));
      dispatch(
        setFileProperties({
          selectedFile: fileUrl,
          selectedFileType: fileType,
          fileNameBoxValue: filename,
        })
      );
    }
  };

  return (
    <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 1.5 }}>
      <Button
        variant="outlined"
        size="small"
        startIcon={<Download sx={{ fontSize: 16 }} />}
        onClick={() => handleGetFile(task.task_id, task.task_name, task.file_type, true)}
        sx={{ fontSize: '0.75rem' }}
      >
        Download
      </Button>
      <Button
        variant="outlined"
        size="small"
        startIcon={<Edit sx={{ fontSize: 16 }} />}
        onClick={() => handleGetFile(task.task_id, task.task_name, task.file_type)}
        sx={{ fontSize: '0.75rem' }}
      >
        Edit
      </Button>
    </Box>
  );
};

export function LeftDrawerTaskLoading() {
  const percentage = useSelector((state: RootState) => state.meshyState.meshyLoadedPercentage);

  return (
    <Box sx={{ mt: 2, px: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          Generating...
        </Typography>
        <Typography variant="caption" color="primary.main" fontWeight={600}>
          {percentage}%
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={percentage}
        sx={{
          height: 4,
          borderRadius: 2,
          backgroundColor: 'rgba(0, 229, 255, 0.1)',
          '& .MuiLinearProgress-bar': { borderRadius: 2 },
        }}
      />
    </Box>
  );
};

export function LeftDrawerList() {
  const { data: tasks = [] } = useGetUserTasksQuery();

  return (
    <Box>
      {tasks.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <AutoAwesome sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.3, mb: 1 }} />
          <Typography variant="body1" color="text.secondary">
            No generation history yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, opacity: 0.7 }}>
            Use the AI prompt to create your first model
          </Typography>
        </Box>
      ) : (
        tasks.map((task) => <LeftDrawerTask key={task.task_id} {...task} />)
      )}
    </Box>
  );
};
