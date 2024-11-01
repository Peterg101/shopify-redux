import React, { Suspense} from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import OBJScene from './objScene';
import { useSelector } from "react-redux";
import { RootState } from "../../app/store";
import STLScene from './stlScene';


const OBJSTLViewer = () => {
    const dataState = useSelector(
        (state: RootState) => state.dataState
    )

  return (
      <div className="App">
        <Canvas
          style={{ width: '100%', height: '500px' }} // Set the size of the canvas
          camera={{ fov: 100, near: 0.1, far: 1000, position: [100, 100, 100] }} // Set camera properties
        >
          <Suspense fallback={null}>
            {
            dataState.selectedFileType === "obj" ? (
            <OBJScene 
            />
          ) : 
            (
            <STLScene/>
            )}
            <pointLight position={[10, 10, 10]} />
            <OrbitControls
              enableZoom // Enable zooming
              enablePan // Enable panning
              enableRotate // Enable orbiting
              zoomSpeed={0.5} // Set zoom speed
              panSpeed={0.5} // Set pan speed
              rotateSpeed={0.5} // Set orbit speed
              target={[0, 0, 0]} // Set orbit target
              // ref={cameraRef} // Reference to the camera
            />
            <Environment preset = "sunset" backgroundBlurriness={1.0} background />
          </Suspense>
        </Canvas>
      </div>
   
  );
};

export default OBJSTLViewer;
