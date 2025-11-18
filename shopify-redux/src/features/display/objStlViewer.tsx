import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import OBJScene from './objScene';
import STLScene from './stlScene';
import OptionTabs from '../userInterface/optionTabs';
import { useSelector } from 'react-redux';
import { RootState } from '../../app/store';

const OBJSTLViewer = () => {
  const dataState = useSelector((state: RootState) => state.dataState);
  const userInterfaceState = useSelector((state: RootState) => state.userInterfaceState);

  return (
    <div className="App" style={{ width: '100%', height: '500px' }}>
      <Canvas
        camera={{ fov: 50, near: 0.1, far: 1000, position: [5, 5, 5] }}
      >
        <Suspense fallback={null}>
          {/* Choose OBJ or STL */}
          {dataState.selectedFileType.includes('obj') ? <OBJScene /> : <STLScene />}

          {/* Neutral HDRI environment for subtle reflections */}
          <Environment
            files="HdrSkyOvercast001_HDR_2K.exr"
            background={false}   // don't use HDRI as background
            blur={0.5}           // soften reflections
            backgroundIntensity={0.5}      // control HDRI light strength
          />

          {/* Studio-style lights */}
          <ambientLight intensity={0.4} />
          <directionalLight
            position={[5, 10, 7.5]}
            intensity={0.7}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          />
          <directionalLight
            position={[-5, 10, -7.5]}
            intensity={0.4}
          />

          {/* Optional fill lights for soft illumination */}
          <pointLight position={[0, 5, 0]} intensity={0.3} />

          {/* Orbit controls */}
          <OrbitControls
            enableZoom
            enablePan
            enableRotate
            zoomSpeed={0.5}
            panSpeed={0.5}
            rotateSpeed={0.5}
            target={[0, 0, 0]}
          />
        </Suspense>
      </Canvas>

      {!dataState.fulfillMode && userInterfaceState.claimedOrder === null && <OptionTabs />}
    </div>
  );
};

export default OBJSTLViewer;
