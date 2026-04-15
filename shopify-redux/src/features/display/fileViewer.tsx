import { useSelector } from "react-redux"
import { Box } from "@mui/material"
import { Dropzone } from "./dropzone"
import { RootState } from "../../app/store";
import OBJSTLViewer from "./objStlViewer";
import { RefiningOverlay } from "./RefiningOverlay";

interface FileViewerProps {
    onTagClick?: (text: string) => void;
}

export const FileViewer = ({ onTagClick }: FileViewerProps) => {
    const dataState = useSelector(
        (state: RootState) => state.dataState
    )
    const cadState = useSelector(
        (state: RootState) => state.cadState
    )

    const isRefining = dataState.fileDisplay && (cadState.cadPending || cadState.cadLoading);

    if (!dataState.fileDisplay) {
        return <Dropzone />;
    }

    return (
        <Box sx={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <OBJSTLViewer onTagClick={onTagClick} />
            {isRefining && <RefiningOverlay />}
        </Box>
    );
}
