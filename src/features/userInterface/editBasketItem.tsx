
import Button from '@mui/material/Button';
import { BasketItem } from '../../app/utility/interfaces';
import { UUID } from 'crypto';
import ModeEditIcon from '@mui/icons-material/ModeEdit';

const EditBasketItem: React.FC<{item: BasketItem}> = ({item}) => {

const handleEditBasketItem = (id: UUID) => {
    console.log('Implement the relevant slice in redux store')
    console.log(id)
}
  return (
    <Button
      onClick={() => handleEditBasketItem(item.id)}
    >
      <ModeEditIcon/>
    </Button>
  );
}

export default EditBasketItem;
