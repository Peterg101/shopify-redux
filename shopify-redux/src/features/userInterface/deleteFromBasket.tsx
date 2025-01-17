import Button from '@mui/material/Button';
import {  deleteFileAndBasketItemFromArray } from '../../app/utility/utils';
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { setAllBasketItems } from '../../services/userInterfaceSlice';
import { BasketInformation, BasketItem } from '../../app/utility/interfaces';
import { useUploadedFiles } from '../../services/uploadedFilesProvider';
import { deleteBasketItem } from '../../services/fetchFileUtils';
import DeleteIcon from '@mui/icons-material/Delete';
import { authApi } from '../../services/authApi';

const DeleteFromBasket: React.FC<{item: BasketInformation}> = ({item}) => {
const dispatch = useDispatch()
const {uploadedFiles, setUploadedFiles} = useUploadedFiles()
const userInterfaceSlice = useSelector(
  (state: RootState) => state.userInterfaceState
)

const handleDeleteBasketItem = async (item:BasketInformation) => {
  await deleteBasketItem(item.task_id)
  dispatch(authApi.util.invalidateTags([{ type: 'sessionData' }]));   
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
