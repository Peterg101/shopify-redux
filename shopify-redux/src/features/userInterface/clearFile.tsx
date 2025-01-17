import { styled } from '@mui/material/styles';
import Button from '@mui/material/Button';
import ClearIcon from '@mui/icons-material/Clear';
import { useDispatch, useSelector } from 'react-redux';
import { resetDataState } from '../../services/dataSlice';
import { RootState } from '../../app/store';


export const ClearFile = () => {
  const dataState = useSelector(
    (state: RootState) => state.dataState
)
    const dispatch = useDispatch()
    const handleClearFile = () => {
        dispatch(resetDataState())
    }
    
    return (
        <Button
          component="label"
          role={undefined}
          variant="contained"
          tabIndex={-1}
          
          // startIcon={}
          onClick={handleClearFile}
        //   disabled = {!statePopulationErrors}
          sx={{
            border:'1px',
            backgroundColor: 'white',
            '&:hover': {
              backgroundColor: 'red', // Change the background color on hover
            }}}
        >
          <ClearIcon sx ={{color: 'black'}} />
        </Button>
      );
}