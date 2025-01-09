import { Button } from "@mui/material"
import AddIcon from '@mui/icons-material/Add';
import { convertFileToBase64WithoutFileReader, createBase64Blob, createFileBlob, generateUuid } from "../../app/utility/utils";
import { BasketItem, UploadedFile, BasketInformationAndFile } from "../../app/utility/interfaces";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { useFile } from '../../services/fileProvider';
import { useUploadedFiles } from "../../services/uploadedFilesProvider";
import { setBasketItems } from "../../services/userInterfaceSlice";
import { resetDataState } from "../../services/dataSlice";
import { postFile } from "../../services/fetchFileUtils";
import { authApi } from "../../services/authApi";

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
        const base64String = await convertFileToBase64WithoutFileReader(actualFile)
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
          file_blob: base64String
        }
        await postFile(basketInformationAndFile)
        dispatch(resetDataState())
        dispatch(authApi.util.invalidateTags([{ type: 'sessionData' }]));        
      }

    }
    return(
        <Button
        component="label"
        role={undefined}
        variant="contained"
        tabIndex={-1}
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