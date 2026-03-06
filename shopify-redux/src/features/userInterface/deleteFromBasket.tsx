import Button from '@mui/material/Button';
import { useDispatch } from "react-redux";
import { BasketInformation } from '../../app/utility/interfaces';
import { deleteBasketItem } from '../../services/fetchFileUtils';
import DeleteIcon from '@mui/icons-material/Delete';
import { authApi } from '../../services/authApi';

function DeleteFromBasket({ item }: { item: BasketInformation }) {
const dispatch = useDispatch()

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
