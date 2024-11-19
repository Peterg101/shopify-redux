import AiTextPrompt from './aiTextPrompt';
import { Box } from '@mui/material';
import { DropArea } from './dropArea';
import { useSelector } from 'react-redux';
import { RootState } from "../../app/store";
import MeshyLoading from './meshyLoading';

export const Dropzone = () => {
  const userInterfaceState = useSelector(
    (state: RootState) => state.userInterfaceState
)
    
    return (
        <div>
        {userInterfaceState.meshyLoading ? <MeshyLoading/> :<DropArea/>}
        <Box sx={{marginTop: 5}}>
        <AiTextPrompt/>
        </Box>
        </div>
      )
    

}