import { useSelector } from "react-redux"
import { RootState } from "../../app/store";
import Cropper from 'react-cropper';
import OBJSTLViewer from "./objStlViewer";
import "cropperjs/dist/cropper.css";
import { useRef, useState } from "react";

export const JpgViewer = () => {
    const dataState = useSelector(
        (state: RootState) => state.dataState
    )

    const [image, setImage] = useState(dataState.selectedFile);
    const [cropData, setCropData] = useState("#");
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
  
    return (
        <div style={{ display: "flex", width: "100%", gap: "20px" }}>
        {/* Cropper Section */}
        <div style={{ width: "50%", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <input type="file" onChange={onChange} style={{ marginBottom: "10px" }} />
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
            preview=".img-preview"
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
            <span>Crop</span>
            <button onClick={getCropData}>Crop Image</button>
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
            {cropData ? <img style={{ maxWidth: "100%", maxHeight: "100%" }} src={cropData} alt="cropped" /> : "No crop preview"}
          </div>
        </div>
      </div>
      
    );
  };