import { useSelector } from "react-redux"
import { Dropzone } from "./dropzone"
import { RootState } from "../../app/store";
import { JpgObjStlViewer } from "./jpgObjStlViewer";

export const FileViewer = () => {
    const dataState = useSelector(
        (state: RootState) => state.dataState
    )

    return(
        <>
        {
        dataState.fileDisplay ? <JpgObjStlViewer/>:<Dropzone/>}
        </>
        
    )
}