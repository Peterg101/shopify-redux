import { useSelector } from "react-redux"
import { RootState } from "../../app/store";
import OBJSTLViewer from "./objStlViewer";
import { JpgViewer } from "./jpgViewer";

const IMAGE_TYPES = ['jpg', 'jpeg', 'png', 'webp'];

export const JpgObjStlViewer = () => {
    const dataState = useSelector(
        (state: RootState) => state.dataState
    )

    const isImage = IMAGE_TYPES.includes(dataState.selectedFileType.toLowerCase());

    return(
        <>
        {isImage ? <JpgViewer/>:<OBJSTLViewer/>}
        </>

    )
}