import Button from '@mui/material/Button';
import {  deleteFileAndBasketItemFromArray } from '../../app/utility/utils';
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { setAllBasketItems } from '../../services/userInterfaceSlice';
import { BasketItem } from '../../app/utility/interfaces';
import { useUploadedFiles } from '../../services/uploadedFilesProvider';

import DeleteIcon from '@mui/icons-material/Delete';

const DeleteFromBasket: React.FC<{item: BasketItem}> = ({item}) => {
const dispatch = useDispatch()
const {uploadedFiles, setUploadedFiles} = useUploadedFiles()
const userInterfaceSlice = useSelector(
  (state: RootState) => state.userInterfaceState
)

const handleDeleteBasketItem = (item:BasketItem) => {
  const {newUploadedFiles, newBasketItems} = deleteFileAndBasketItemFromArray(item.id, uploadedFiles, userInterfaceSlice.basketItems)
  setUploadedFiles(newUploadedFiles)
  dispatch(setAllBasketItems({newBasketItems: newBasketItems}))
}
  return (
    <Button
      onClick={() => handleDeleteBasketItem(item)}
    >
      <DeleteIcon/>
    </Button>
  );
}

export default DeleteFromBasket;
