
import Button from '@mui/material/Button';
import { BasketItem } from '../../app/utility/interfaces';
import ModeEditIcon from '@mui/icons-material/ModeEdit';
import { combineBasketItem, deleteFileAndBasketItemFromArray } from '../../app/utility/utils';
import { useFile } from '../../services/fileProvider';
import { useUploadedFiles } from '../../services/uploadedFilesProvider';
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { setUploadedFileEditProperties } from '../../services/dataSlice';
import { setAllBasketItems } from '../../services/userInterfaceSlice';

const EditBasketItem: React.FC<{item: BasketItem}> = ({item}) => {
const {actualFile, setActualFile} = useFile()
const dispatch = useDispatch()
const {uploadedFiles, setUploadedFiles} = useUploadedFiles()
const userInterfaceSlice = useSelector(
  (state: RootState) => state.userInterfaceState
)


const handleEditBasketItem = (item: BasketItem) => {
    console.log(item.id)
    console.log(item.sizing)
    const combinedBasketItem = combineBasketItem(item.id, uploadedFiles, userInterfaceSlice.basketItems )
    setActualFile(combinedBasketItem.uploadedFile.file)
    dispatch(setUploadedFileEditProperties({basketItem: combinedBasketItem.basketItem}))
    console.log(combinedBasketItem)
    const {newUploadedFiles, newBasketItems} = deleteFileAndBasketItemFromArray(item.id, uploadedFiles, userInterfaceSlice.basketItems)
    setUploadedFiles(newUploadedFiles)
    dispatch(setAllBasketItems({newBasketItems: newBasketItems}))
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
