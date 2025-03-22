import React from "react";
import { Typography, Button, Card, CardContent, Divider, Box } from "@mui/material";
import { AccessTime, Edit } from "@mui/icons-material";
import { TaskInformation } from "../../app/utility/interfaces";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { useFile } from "../../services/fileProvider";
import { resetDataState, setFileProperties, setFromMeshyOrHistory } from "../../services/dataSlice";
import { extractFileInfo, fetchFile } from "../../services/fetchFileUtils";
import { setLeftDrawerClosed } from "../../services/userInterfaceSlice";

export const LeftDrawerTask = (task: TaskInformation) => {
  const { actualFile, setActualFile } = useFile();
  const dispatch = useDispatch();

  const handleGetFile = async (fileId: string, filename: string) => {
    setActualFile(null);
    dispatch(resetDataState());
    dispatch(setLeftDrawerClosed());
    const data = await fetchFile(fileId);
    const fileInfo = extractFileInfo(data, filename);
    setActualFile(fileInfo.file);
    dispatch(setFromMeshyOrHistory({ fromMeshyOrHistory: true }));
    dispatch(
      setFileProperties({
        selectedFile: fileInfo.fileUrl,
        selectedFileType: "obj",
        fileNameBoxValue: filename,
      })
    );
  };

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

        <Box display="flex" justifyContent="flex-end">
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
      </CardContent>
    </Card>
  );
};

export const LeftDrawerList = () => {
  const userInterfaceState = useSelector((state: RootState) => state.userInterfaceState);

  return (
    <Box sx={{ p: 2 }}>
      {userInterfaceState.userInformation?.tasks.length === 0 ? (
        <Typography variant="body1" color="text.secondary">
          No task history available.
        </Typography>
      ) : (
        userInterfaceState.userInformation?.tasks.map((task) => <LeftDrawerTask key={task.task_id} {...task} />)
      )}
    </Box>
  );
};