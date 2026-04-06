import { useSelector } from "react-redux"
import { Box } from "@mui/material"
import { Dropzone } from "./dropzone"
import { RootState } from "../../app/store";
import { JpgObjStlViewer } from "./jpgObjStlViewer";
import { RefiningOverlay } from "./RefiningOverlay";

export const FileViewer = () => {
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
            <JpgObjStlViewer />
            {isRefining && <RefiningOverlay />}
        </Box>
    );
}
