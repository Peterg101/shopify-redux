import React, { Suspense} from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import OBJScene from './objScene';
import { useSelector } from "react-redux";
import { RootState } from "../../app/store";
import STLScene from './stlScene';
import OptionTabs from '../userInterface/optionTabs';
import { ClaimMenu } from '../fulfill/claimMenu';


const OBJSTLViewer = () => {
    const dataState = useSelector(
        (state: RootState) => state.dataState
    )

    const userInterfaceState = useSelector(
      (state: RootState) => state.userInterfaceState
  )

  return (
      <div className="App">
        <Canvas
          style={{ width: '100%', height: '500px' }} // Set the size of the canvas
          camera={{ fov: 100, near: 0.1, far: 1000, position: [100, 100, 100] }} // Set camera properties
        >
          <Suspense fallback={null}>
            {
            dataState.selectedFileType.includes("obj") ? (
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
            <Environment files="HdrSkyOvercast001_HDR_2K.exr" backgroundBlurriness={1.0} backgroundIntensity={100} background />
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 10]} intensity={0.5} />
          </Suspense>
        </Canvas>
        {!dataState.fulfillMode && userInterfaceState.claimedOrder === null && <OptionTabs />}
        
      </div>
   
  );
};

export default OBJSTLViewer;
