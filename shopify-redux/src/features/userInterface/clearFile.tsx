import Button from '@mui/material/Button';
import ClearIcon from '@mui/icons-material/Clear';
import { useDispatch } from 'react-redux';
import { resetDataState } from '../../services/dataSlice';

export const ClearFile = () => {
    const dispatch = useDispatch()

    const handleClearFile = () => {
        dispatch(resetDataState())
    }

    return (
        <Button
            variant="outlined"
            onClick={handleClearFile}
            sx={{
                minWidth: 'auto',
                transition: 'all 0.2s ease',
                '&:hover': {
                    borderColor: 'error.main',
                    color: 'error.main',
                },
            }}
        >
            <ClearIcon />
        </Button>
    );
}
