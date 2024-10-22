import {useState, useEffect} from 'react';
import { styled } from '@mui/material/styles';
import Button from '@mui/material/Button';
import PublishIcon from '@mui/icons-material/Publish';
import { UploadedFile } from '../../app/utility/interfaces';

// import { useUploadFilesMutation } from '../store/postApi';
// import toast, {Toaster} from 'react-hot-toast';
// import { BasketItem } from '../store/postApi';
// import { ToastContainer, toast } from 'react-toastify';


const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

// interface submitFileProps{
//   actualFile: File
//   clearFiles: () => void
//   basketItems: BasketItem[]
// }

const SubmitFile: React.FC<{uploadedFiles: UploadedFile[]}> = ({ uploadedFiles }) => {

const handleFilePost = (uploadedFiles: UploadedFile[]) => {
    console.log('Remember to implement all the relevant things in the store for this to work')
    console.log(uploadedFiles)
}
//   const [postFile, { isLoading, isError, isSuccess, error }] = useUploadFilesMutation();

//   // useEffect(() => {
//   //   if(isSuccess){
//   //     console.log(actualFile.name)
//   //     toast.success(`${actualFile.name} successfully posted!!!`)
//   //     // clearFiles()
//   //   }
//   // }, [isSuccess]);


//   const handleFilePost = async () => {
//     console.log('clicked bitch')
    
//     try{
  
//       // const uploadData = new FormData();
//       // uploadData.append('file', actualFile);
//       // uploadData.append('name', 'vern');
//       // uploadData.append('metadata', {'Ibs': 'bad'})
      
//       console.log(basketItems)
//       await postFile(basketItems)
//       console.log('file posted')
//       clearFiles()
      
//     } catch (error) {
//       toast.error('Error posting file:', error);
//     }
//   };

  return (
    <Button
      role={undefined}
      variant="contained"
      tabIndex={-1}
      disabled={false}
      startIcon={<PublishIcon />}
      onClick={() => handleFilePost(uploadedFiles)}
    >
      Submit
      <VisuallyHiddenInput type="file" />
    </Button>
    
  );
};

export default SubmitFile;

