import React from "react";
import { Typography, Button, Card, CardContent, Box, Chip, CircularProgress, LinearProgress } from "@mui/material";
import { AccessTime, Edit, Download, AutoAwesome } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { TaskInformation } from "../../app/utility/interfaces";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { useFile } from "../../services/fileProvider";
import { resetDataState, setFileProperties, setAutoScaleOnLoad, setStepMetadata, setTaskId, setFileNameBoxValue } from "../../services/dataSlice";
import { extractFileInfo, fetchFile, fetchCadFile, isCadFileType, downloadCadStepFile } from "../../services/fetchFileUtils";
import { setLeftDrawerClosed } from "../../services/userInterfaceSlice";
import { resetCadState } from "../../services/cadSlice";
import { hydrateChatHistory, resetConversation } from "../../services/cadChatSlice";
import { fetchConversation } from "../../services/cadChatApi";
import { ChatMessage } from "../../app/utility/interfaces";
import { downloadBlob } from "../../app/utility/utils";
import { useGetUserTasksQuery } from "../../services/authApi";
import { borderSubtle, borderHover, bgHighlightHover } from "../../theme";

const formatRelativeTime = (dateString: string): string => {
  const now = new Date();
  // Backend stores UTC timestamps without 'Z' suffix — normalize
  const normalized = dateString.endsWith('Z') || dateString.includes('+') ? dateString : dateString + 'Z';
  const date = new Date(normalized);
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
        border: `1px solid ${borderSubtle}`,
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          borderColor: borderHover,
          boxShadow: `0 0 16px ${bgHighlightHover}`,
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
          {!task.complete && (
            <Chip
              label="Draft"
              size="small"
              sx={{ ml: 1, height: 18, fontSize: '0.65rem', color: '#FF9100', borderColor: '#FF9100' }}
              variant="outlined"
            />
          )}
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
  const navigate = useNavigate();

  const handleGetFile = async (fileId: string, filename: string, fileType: string, shouldDownload = false, complete = true) => {
    setActualFile(null);
    dispatch(resetConversation());  // Clear chat FIRST to prevent race condition
    dispatch(resetDataState());
    dispatch(resetCadState());
    dispatch(setLeftDrawerClosed());
    // Navigate to the generate page so Dropzone/FileViewer is visible
    if (!shouldDownload) navigate('/generate');

    // Incomplete tasks have no model — resume chat conversation
    if (complete === false) {
      console.log('[Draft Resume] task:', fileId, 'complete:', complete);

      // Set taskId and filename SYNCHRONOUSLY before any async work
      dispatch(setTaskId({ taskId: fileId }));
      dispatch(setFileNameBoxValue({ fileNameBoxValue: filename }));
      // Hydrate immediately so chatTaskId is set before CadChat can mount
      dispatch(hydrateChatHistory({ taskId: fileId, messages: [] }));

      // Scroll to top so the Dropzone/chat is visible
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Then fetch conversation history async and update if available
      try {
        const { messages } = await fetchConversation(fileId);
        console.log('[Draft Resume] fetched messages:', messages?.length ?? 0);
        if (messages && messages.length > 0) {
          const chatMessages: ChatMessage[] = messages.map((msg: any, i: number) => ({
            id: `history-${i}`,
            role: msg.role,
            content: msg.content,
            timestamp: Date.now(),
          }));
          dispatch(hydrateChatHistory({ taskId: fileId, messages: chatMessages }));
        }
      } catch (err) {
        console.log('[Draft Resume] conversation fetch failed:', err);
      }
      return;
    }

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
      if (fileType === 'step') {
        // Download original STEP file, not the GLB preview
        await downloadCadStepFile(fileId, filename);
        return;
      }
      const ext = isCadFileType(fileType) ? '.glb' : '.obj';
      downloadBlob(file, filename.endsWith(ext) ? filename : `${filename}${ext}`);
    } else {
      setActualFile(file);
      dispatch(setAutoScaleOnLoad({ autoScaleOnLoad: true }));
      // CAD files are fetched as GLB previews — tell the viewer to use GLTFScene
      const viewerFileType = isCadFileType(fileType) ? 'glb' : fileType;
      dispatch(
        setFileProperties({
          selectedFile: fileUrl,
          selectedFileType: viewerFileType,
          fileNameBoxValue: filename,
          taskId: fileId,
        })
      );
      // Mark as complete so ParameterEditor and RefinementInput appear
      if (isCadFileType(fileType)) {
        dispatch(setStepMetadata({ processingStatus: 'complete' }));
        // Fetch geometry metadata for feature overlay
        try {
          const geoResp = await fetch(
            `${process.env.REACT_APP_API_URL}/tasks/${fileId}/geometry`,
            { credentials: 'include' }
          );
          if (geoResp.ok) {
            const { features, faces, edges } = await geoResp.json();
            dispatch(setStepMetadata({ features, faces, edges }));
          }
        } catch { /* non-critical — overlay just won't show */ }

        // Hydrate conversation history if available
        try {
          const { messages } = await fetchConversation(fileId);
          if (messages.length > 0) {
            const chatMessages: ChatMessage[] = messages.map((msg: any, i: number) => ({
              id: `history-${i}`,
              role: msg.role,
              content: msg.content,
              timestamp: Date.now(),
            }));
            dispatch(hydrateChatHistory({ taskId: fileId, messages: chatMessages }));
          } else {
            dispatch(resetConversation());
          }
        } catch { /* conversation may not exist for older tasks */ }
      } else {
        dispatch(resetConversation());
      }
    }
  };

  return (
    <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 1.5 }}>
      <Button
        variant="outlined"
        size="small"
        disabled={!task.complete}
        startIcon={<Download sx={{ fontSize: 16 }} />}
        onClick={() => handleGetFile(task.task_id, task.task_name, task.file_type, true, task.complete)}
        sx={{ fontSize: '0.75rem' }}
      >
        Download
      </Button>
      <Button
        variant="outlined"
        size="small"
        startIcon={<Edit sx={{ fontSize: 16 }} />}
        onClick={() => handleGetFile(task.task_id, task.task_name, task.file_type, false, task.complete)}
        sx={{ fontSize: '0.75rem' }}
      >
        Edit
      </Button>
    </Box>
  );
};

export function LeftDrawerTaskLoading() {
  const percentage = useSelector((state: RootState) => state.cadState.cadLoadedPercentage);

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
          backgroundColor: bgHighlightHover,
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
