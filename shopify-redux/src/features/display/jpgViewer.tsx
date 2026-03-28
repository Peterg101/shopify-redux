import { useSelector } from "react-redux"
import { RootState } from "../../app/store";
import Cropper from 'react-cropper';

import "cropperjs/dist/cropper.css";

import CropIcon from '@mui/icons-material/Crop';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useDispatch } from 'react-redux';
import { useState } from "react";
import { Box, Button, Collapse } from "@mui/material";
import { setClearFileDisplay } from "../../services/dataSlice";
import { setMeshyPending } from "../../services/meshySlice";
import { startImageTo3DTask } from "../../services/fetchFileUtils";

import { generateUUID } from "three/src/math/MathUtils";
import { useFile } from '../../services/fileProvider';
import { authApi } from '../../services/authApi';
import { connectProgressStream } from "../../services/progressStream";
import { GenerationSettings } from './GenerationSettings';

export const JpgViewer = () => {
    const dataState = useSelector(
        (state: RootState) => state.dataState
    )
    const userInformation = useSelector(
      (state: RootState) => state.userInterfaceState.userInformation
    )
    const meshyGenerationSettings = useSelector(
      (state: RootState) => state.meshyState.meshyGenerationSettings
    )
    const dispatch = useDispatch()
    const {actualFile, setActualFile} = useFile()
    const [image, setImage] = useState(dataState.selectedFile);

    const [cropData, setCropData] = useState("");
    const [cropper, setCropper] = useState<any>();
    const onChange = (e: any) => {
      e.preventDefault();
      let files;
      if (e.dataTransfer) {
        files = e.dataTransfer.files;
      } else if (e.target) {
        files = e.target.files;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setImage(reader.result as any);
      };
      reader.readAsDataURL(files[0]);
    };
  
    const getCropData = () => {
      if (typeof cropper !== "undefined") {
        setCropData(cropper.getCroppedCanvas().toDataURL());
      }
    };

    const generate3DModelFromImage = async () => {
      setCropData("")
      const portId = generateUUID()
      dispatch(setMeshyPending({meshyPending: true}))
      const settings = meshyGenerationSettings;
      await startImageTo3DTask(
        actualFile,
        userInformation?.user.user_id,
        portId,
        dataState.fileNameBoxValue,
        settings
      )
      setImage("")
      dispatch(setClearFileDisplay())
      dispatch(authApi.util.invalidateTags([{ type: 'sessionData' }]));
      connectProgressStream(portId, 'meshy', dispatch, setActualFile)
    };
  
  
    return (
        <div>
        <div style={{ display: "flex", width: "100%", gap: "20px", marginTop: "30px" }}>
        {/* Cropper Section */}
        <div style={{ width: "50%", display: "flex", flexDirection: "column", alignItems: "center", padding: "20px" }}>
        
          <Cropper
            style={{
              border: "5px dashed",
              height: "500px",
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
            }}
            initialAspectRatio={2}
            src={image}
            viewMode={1}
            minCropBoxHeight={10}
            minCropBoxWidth={10}
            background={true}
            autoCropArea={1}
            zoomable={false}
            checkOrientation={false}
            onInitialized={(instance) => {
              setCropper(instance);
            }}
            guides={true}
          />
        </div>
      
        {/* Cropped Image Section */}
        <div style={{ width: "50%", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <h1 style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
            {/* <span>Cropped Image</span> */}
            
          </h1>
          <div
            className="box"
            style={{
              width: "100%",
              height: "300px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid #ccc",
            }}
          >
            {cropData ? <img style={{ maxWidth: "100%", maxHeight: "100%" }} src={cropData} alt="cropped" /> : "Select the desired section of the image."}
          </div>
        </div>
        
      </div>

<Box
  sx={{
    display: "flex",
    justifyContent: "center",
    gap: 2,
    padding: 2,
    borderTop: "2px solid #ddd",
    marginTop: 2,
  }}
>
  {/* Select Image Button */}
  <input
    type="file"
    id="upload"
    onChange={onChange}
    style={{ display: "none" }}
  />
  <label htmlFor="upload">
    <Button variant="contained" component="span" endIcon={<AddPhotoAlternateIcon/>}>
      Select Image
    </Button>
  </label>

  {/* Crop Image Button */}
  <Button variant="contained" onClick={getCropData} endIcon={<CropIcon/>}>
    Crop Image
  </Button>

  <Button variant="contained" disabled = {!cropData} onClick={generate3DModelFromImage} endIcon={<AutoAwesomeIcon/>}>
  Generate 3D Model
  </Button>
</Box>

<Collapse in={!!cropData}>
  <Box sx={{ px: 2, pb: 2 }}>
    <GenerationSettings mode="image" />
  </Box>
</Collapse>

    </div>
    
    );
  };