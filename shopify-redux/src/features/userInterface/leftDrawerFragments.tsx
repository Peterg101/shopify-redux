import React from "react";
import { Typography, Button, Card, CardContent, Divider, Box, CircularProgress } from "@mui/material";
import { AccessTime, Edit, Download } from "@mui/icons-material";
import { TaskInformation } from "../../app/utility/interfaces";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { useFile } from "../../services/fileProvider";
import { resetDataState, setFileProperties, setFromMeshyOrHistory } from "../../services/dataSlice";
import { extractFileInfo, fetchFile } from "../../services/fetchFileUtils";
import { setLeftDrawerClosed } from "../../services/userInterfaceSlice";
import { downloadBlob } from "../../app/utility/utils";

export const LeftDrawerTask: React.FC<TaskInformation> = (task) => {
  const userInterfaceState = useSelector((state: RootState) => state.userInterfaceState);

  const isTaskLoading =
    userInterfaceState.userInformation.incomplete_task &&
    userInterfaceState.userInformation.incomplete_task.task_id === task.task_id;

  return (
    <Card elevation={3} sx={{ borderRadius: 2, mb: 2, overflow: "hidden" }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {task.task_name}
        </Typography>

        <Box display="flex" alignItems="center" gap={1} sx={{ mb: 1 }}>
          <AccessTime fontSize="small" color="action" />
          <Typography variant="body2" color="text.secondary">
            {new Date(task.created_at).toLocaleString()}
          </Typography>
        </Box>

        <Divider sx={{ my: 1 }} />

        {isTaskLoading ? <LeftDrawerTaskLoading /> : <LeftDrawerButtons {...task} />}
      </CardContent>
    </Card>
  );
};

export const LeftDrawerButtons: React.FC<TaskInformation> = (task) => {
  const { actualFile, setActualFile } = useFile();
  const dispatch = useDispatch();

  const handleGetFile = async (fileId: string, filename: string, shouldDownload = false) => {
    setActualFile(null);
    dispatch(resetDataState());
    dispatch(setLeftDrawerClosed());

    const data = await fetchFile(fileId);
    const fileInfo = extractFileInfo(data, filename);

    if (shouldDownload) {
      downloadBlob(fileInfo.file, filename.endsWith(".obj") ? filename : `${filename}.obj`);
    } else {
      setActualFile(fileInfo.file);
      dispatch(setFromMeshyOrHistory({ fromMeshyOrHistory: true }));
      dispatch(
        setFileProperties({
          selectedFile: fileInfo.fileUrl,
          selectedFileType: "obj",
          fileNameBoxValue: filename,
        })
      );
    }
  };

  return (
    <Box display="flex" justifyContent="flex-end" gap={1}>
      <Button
        variant="contained"
        color="primary"
        size="small"
        startIcon={<Download />}
        onClick={() => handleGetFile(task.task_id, task.task_name, true)}
      >
        Download
      </Button>
      <Button
        variant="contained"
        color="primary"
        size="small"
        startIcon={<Edit />}
        onClick={() => handleGetFile(task.task_id, task.task_name)}
      >
        Edit
      </Button>
    </Box>
  );
};

export const LeftDrawerTaskLoading: React.FC = () => {
  const percentage = useSelector((state: RootState) => state.userInterfaceState.meshyLoadedPercentage);

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      gap={1}
      sx={{ py: 2 }}
    >
      <CircularProgress variant="determinate" value={percentage} />
      <Typography variant="body2" color="text.secondary">
        Loading model... {percentage}%
      </Typography>
    </Box>
  );
};

export const LeftDrawerList: React.FC = () => {
  const userInterfaceState = useSelector((state: RootState) => state.userInterfaceState);
  const tasks = userInterfaceState.userInformation?.tasks ?? [];

  return (
    <Box sx={{ p: 2 }}>
      {tasks.length === 0 ? (
        <Typography variant="body1" color="text.secondary">
          No task history available.
        </Typography>
      ) : (
        tasks.map((task) => <LeftDrawerTask key={task.task_id} {...task} />)
      )}
    </Box>
  );
};
