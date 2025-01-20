
import Button from '@mui/material/Button';
import { BasketInformation } from '../../app/utility/interfaces';
import ModeEditIcon from '@mui/icons-material/ModeEdit';
import { combineBasketItem, deleteFileAndBasketItemFromArray } from '../../app/utility/utils';
import { useFile } from '../../services/fileProvider';
import { useUploadedFiles } from '../../services/uploadedFilesProvider';
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { setUploadedFileEditProperties } from '../../services/dataSlice';
import { setAllBasketItems, setLeftDrawerClosed, setRightDrawerClosed } from '../../services/userInterfaceSlice';
import { resetDataState, setFileProperties } from "../../services/dataSlice";
import { extractFileInfo, fetchFile } from "../../services/fetchFileUtils";

const EditBasketItem: React.FC<{item: BasketInformation}> = ({item}) => {
const {actualFile, setActualFile} = useFile()
const dispatch = useDispatch()
const {uploadedFiles, setUploadedFiles} = useUploadedFiles()
const userInterfaceSlice = useSelector(
  (state: RootState) => state.userInterfaceState
)


// const handleEditBasketItem = async (item: BasketInformation) => {
//   setActualFile(null)
//   dispatch(resetDataState())
//   dispatch(setRightDrawerClosed())
//   const data = await fetchFile(item.task_id)
//   const fileInfo = extractFileInfo(data, item.name)
//   setActualFile(fileInfo.file);
//   dispatch(setFileProperties({
//     selectedFile: fileInfo.fileUrl,
//     selectedFileType: 'obj',
//     fileNameBoxValue: item.name,
// }))


const handleEditBasketItem = async (item: BasketInformation) => {
  setActualFile(null)
  dispatch(resetDataState())
  dispatch(setRightDrawerClosed())
  const data = await fetchFile(item.task_id)
  console.log(item.selectedFileType)
  console.log(data)
  const fileInfo = extractFileInfo(data, item.name)
  console.log(fileInfo)
  setActualFile(fileInfo.file);
  dispatch(setUploadedFileEditProperties({
    basketItem: item,
    fileInformation:fileInfo
  }))
  
}
  

  return (
    <Button
      onClick={() => handleEditBasketItem(item)}
    >
      <ModeEditIcon/>
    </Button>
  );
}

export default EditBasketItem;
