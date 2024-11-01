import { styled } from '@mui/material/styles';
import Button from '@mui/material/Button';
import { BasketItem } from '../../app/utility/interfaces';
import { UUID } from 'crypto';
import DeleteIcon from '@mui/icons-material/Delete';

const DeleteFromBasket: React.FC<{item: BasketItem}> = ({item}) => {

const handleDeleteBasketItem = (id: UUID) => {
    console.log('Implement the relevant slice in redux store')
    console.log(id)
}
  return (
    <Button
      onClick={() => handleDeleteBasketItem(item.id)}
    >
      <DeleteIcon/>
    </Button>
  );
}

export default DeleteFromBasket;
