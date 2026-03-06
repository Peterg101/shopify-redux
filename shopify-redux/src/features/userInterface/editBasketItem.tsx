
import Button from '@mui/material/Button';
import { BasketInformation } from '../../app/utility/interfaces';
import ModeEditIcon from '@mui/icons-material/ModeEdit';import { useFile } from '../../services/fileProvider';
import { useDispatch} from "react-redux";
import { setSelectedFile, setUploadedFileEditProperties } from '../../services/dataSlice';
import {setLeftDrawerClosed } from '../../services/userInterfaceSlice';
import { resetDataState } from "../../services/dataSlice";
import { extractFileInfo, fetchFile } from "../../services/fetchFileUtils";

function EditBasketItem({ item }: { item: BasketInformation }) {
const {actualFile, setActualFile} = useFile()
const dispatch = useDispatch()

const handleEditBasketItem = async (item: BasketInformation) => {
  setActualFile(null)
  dispatch(resetDataState())
  const data = await fetchFile(item.task_id)
  const fileInfo = extractFileInfo(data, item.name)
  setActualFile(fileInfo.file);
  dispatch(setSelectedFile({selectedFile: fileInfo.fileUrl}))
  dispatch(setUploadedFileEditProperties({
    basketItem: item,
    fileInformation:fileInfo
  }))
  dispatch(setLeftDrawerClosed())
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
