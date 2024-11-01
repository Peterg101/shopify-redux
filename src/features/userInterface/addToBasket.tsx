import { Button } from "@mui/material"
import AddIcon from '@mui/icons-material/Add';
import { generateUuid } from "../../app/utility/utils";
import { BasketItem, UploadedFile } from "../../app/utility/interfaces";
import { useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { useFile } from '../../services/fileProvider';

export const AddToBasket = () => {
  const dataState = useSelector(
    (state: RootState) => state.dataState
)
const {actualFile, setActualFile} = useFile()

    const handleAddToBasket = () => {
      if (actualFile) {
        console.log('Adding item to the basket')
        const itemUUID= generateUuid()
        console.log(itemUUID)

        const basketItem: BasketItem = {
          id: itemUUID,
          name: dataState.fileNameBoxValue,
          material: dataState.printMaterial,
          technique: dataState.printTechnique,
          sizing: dataState.multiplierValue,
          colour: dataState.modelColour
      };
        const uploadedFile: UploadedFile = {
          id: itemUUID,
          file: actualFile
        }
        console.log(uploadedFile)
        console.log(basketItem)
      }
      
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