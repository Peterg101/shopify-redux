import { Button } from "@mui/material"
import AddIcon from '@mui/icons-material/Add';
import { createFileBlob, generateUuid } from "../../app/utility/utils";
import { BasketItem, UploadedFile, BasketInformationAndFile } from "../../app/utility/interfaces";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { useFile } from '../../services/fileProvider';
import { useUploadedFiles } from "../../services/uploadedFilesProvider";
import { setBasketItems } from "../../services/userInterfaceSlice";
import { resetDataState } from "../../services/dataSlice";
import { postFile } from "../../services/fetchFileUtils";

export const AddToBasket = () => {
  const dispatch = useDispatch()
  const dataState = useSelector(
    (state: RootState) => state.dataState
)
const userState = useSelector(
  (state: RootState) => state.userInterfaceState
)

  const {actualFile, setActualFile} = useFile()
  const {uploadedFiles, setUploadedFiles} = useUploadedFiles()

    const handleAddToBasket = async () => {
      const itemUUID= generateUuid()
      console.log(userState.userInformation?.user.user_id)
      if (actualFile) {
        const fileBlob = createFileBlob(actualFile)
        const b64 = btoa(fileBlob)
        console.log('this is where ')
        const basketInformationAndFile: BasketInformationAndFile = {
          user_id: userState.userInformation?.user.user_id,
          task_id: itemUUID,
          name: dataState.fileNameBoxValue,
          material: dataState.printMaterial,
          technique: dataState.printTechnique,
          sizing: dataState.multiplierValue,
          colour: dataState.modelColour,
          selected_file: dataState.selectedFile,
          selected_file_type: dataState.selectedFileType,
          quantity: 1,
          file_blob: b64
        }
        console.log(basketInformationAndFile)
        await postFile(basketInformationAndFile)
        
      //   const basketItem: BasketItem = {
      //     id: itemUUID,
      //     name: dataState.fileNameBoxValue,
      //     material: dataState.printMaterial,
      //     technique: dataState.printTechnique,
      //     sizing: dataState.multiplierValue,
      //     colour: dataState.modelColour,
      //     selectedFile: dataState.selectedFile,
      //     selectedFileType: dataState.selectedFileType
      // };
      //   const uploadedFile: UploadedFile = {
      //     id: itemUUID,
      //     file: actualFile
      //   }
      //   setUploadedFiles((prevFiles) => [...(prevFiles || []), uploadedFile]);
      //   dispatch(setBasketItems({newBasketItem: basketItem}))
      //   dispatch(resetDataState())
        
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