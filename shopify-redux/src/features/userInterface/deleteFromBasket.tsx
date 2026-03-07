import Button from '@mui/material/Button';
import { BasketInformation } from '../../app/utility/interfaces';
import DeleteIcon from '@mui/icons-material/Delete';
import { useDeleteBasketItemMutation } from '../../services/dbApi';

function DeleteFromBasket({ item }: { item: BasketInformation }) {
const [deleteBasketItem] = useDeleteBasketItemMutation()

const handleDeleteBasketItem = async (item:BasketInformation) => {
  await deleteBasketItem(item.task_id)
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
