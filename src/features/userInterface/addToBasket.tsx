import { Button } from "@mui/material"
import AddIcon from '@mui/icons-material/Add';
import { generateUuid } from "../../app/utility/utils";
import { BasketItem, UploadedFile } from "../../app/utility/interfaces";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { useFile } from '../../services/fileProvider';
import { useUploadedFiles } from "../../services/uploadedFilesProvider";
import { setBasketItems } from "../../services/userInterfaceSlice";
import { resetDataState } from "../../services/dataSlice";

export const AddToBasket = () => {
  const dispatch = useDispatch()
  const dataState = useSelector(
    (state: RootState) => state.dataState
)
  const {actualFile, setActualFile} = useFile()
  const {uploadedFiles, setUploadedFiles} = useUploadedFiles()

    const handleAddToBasket = () => {
      if (actualFile) {
        const itemUUID= generateUuid()
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
        setUploadedFiles((prevFiles) => [...(prevFiles || []), uploadedFile]);
        dispatch(setBasketItems({newBasketItem: basketItem}))
        dispatch(resetDataState())
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