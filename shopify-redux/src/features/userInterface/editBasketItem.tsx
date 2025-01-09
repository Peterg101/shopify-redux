
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


// const handleEditBasketItem = (item: BasketInformation) => {
//     console.log(item.task_id)
//     console.log(item.sizing)
//     const combinedBasketItem = combineBasketItem(item.id, uploadedFiles, userInterfaceSlice.basketItems )
//     setActualFile(combinedBasketItem.uploadedFile.file)
//     dispatch(setUploadedFileEditProperties({basketItem: combinedBasketItem.basketItem}))
//     console.log(combinedBasketItem)
//     const {newUploadedFiles, newBasketItems} = deleteFileAndBasketItemFromArray(item.id, uploadedFiles, userInterfaceSlice.basketItems)
//     setUploadedFiles(newUploadedFiles)
//     dispatch(setAllBasketItems({newBasketItems: newBasketItems}))
//     dispatch(setRightDrawerClosed())
//     dispatch(setLeftDrawerClosed())
// }

const handleGetFile = async (fileId: string, filename: string) => {
  console.log(filename);
  console.log(fileId)
  setActualFile(null)
  dispatch(resetDataState())
  dispatch(setRightDrawerClosed())
  const data = await fetchFile(fileId)
  console.log(data)
  const fileInfo = extractFileInfo(data, filename)
  console.log(fileInfo)
  setActualFile(fileInfo.file);
      dispatch(setFileProperties({
          selectedFile: fileInfo.fileUrl,
          selectedFileType: 'obj',
          fileNameBoxValue: filename,
      }));
  
};
  return (
    <Button
      // onClick={() => handleEditBasketItem(item)}
      onClick={()=> handleGetFile(item.task_id, item.name)}
    >
      <ModeEditIcon/>
    </Button>
  );
}

export default EditBasketItem;
