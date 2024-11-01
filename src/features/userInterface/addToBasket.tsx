import { Button } from "@mui/material"
import AddIcon from '@mui/icons-material/Add';



export const AddToBasket = () => {
    const handleAddToBasket = () => {
        console.log('Adding item to the basket')
    }
    return(
        <Button
        component="label"
        role={undefined}
        variant="contained"
        tabIndex={-1}
        
        // startIcon={}
        onClick={handleAddToBasket}
        // disabled = {!statePopulationErrors}
        sx={{
          border:'1px',
          backgroundColor: 'white',
          '&:hover': {
            backgroundColor: 'theme-color', // Change the background color on hover
          }}}
      >
        <AddIcon sx ={{color: 'black'}} />
      </Button>  
    )
}