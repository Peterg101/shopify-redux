import { useSelector } from "react-redux"
import { RootState } from "../../app/store";
import OBJSTLViewer from "./objStlViewer";
import { JpgViewer } from "./jpgViewer";

const IMAGE_TYPES = ['jpg', 'jpeg', 'png', 'webp'];

interface JpgObjStlViewerProps {
    onTagClick?: (text: string) => void;
}

export const JpgObjStlViewer = ({ onTagClick }: JpgObjStlViewerProps) => {
    const dataState = useSelector(
        (state: RootState) => state.dataState
    )

    const isImage = IMAGE_TYPES.includes(dataState.selectedFileType.toLowerCase());

    return(
        <>
        {isImage ? <JpgViewer/>:<OBJSTLViewer onTagClick={onTagClick} />}
        </>

    )
}