import { useSelector } from "react-redux"
import { RootState } from "../../app/store";
import OBJSTLViewer from "./objStlViewer";
import { JpgViewer } from "./jpgViewer";

export const JpgObjStlViewer = () => {
    const dataState = useSelector(
        (state: RootState) => state.dataState
    )

    return(
        <>
        {
        dataState.selectedFileType == 'jpg' ? <JpgViewer/>:<OBJSTLViewer/>}
        </>
        
    )
}