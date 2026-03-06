import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import OBJScene from './objScene';
import { useSelector } from "react-redux";
import { RootState } from "../../app/store";
import STLScene from './stlScene';
import { ViewerErrorBoundary } from '../shared/ViewerErrorBoundary';
import { OrientationControls } from './OrientationControls';

const OBJSTLViewer = () => {
    const dataState = useSelector(
        (state: RootState) => state.dataState
    )

  return (
      <div className="App">
        <ViewerErrorBoundary>
          <Canvas
            style={{ width: '100%', height: '500px', background: 'radial-gradient(circle at center, #1a2230 0%, #0A0E14 100%)' }}
            camera={{ fov: 100, near: 0.1, far: 1000, position: [100, 100, 100] }}
          >
            <Suspense fallback={null}>
              {dataState.selectedFileType.includes("obj") ? (
                <OBJScene />
              ) : (
                <STLScene />
              )}
              <pointLight position={[10, 10, 10]} />
              <OrbitControls
                enableZoom
                enablePan
                enableRotate
                zoomSpeed={0.5}
                panSpeed={0.5}
                rotateSpeed={0.5}
                target={[0, 0, 0]}
              />
              <Environment files="HdrSkyOvercast001_HDR_2K.exr" />
              <ambientLight intensity={0.5} />
              <directionalLight position={[10, 10, 10]} intensity={0.5} />
            </Suspense>
          </Canvas>
        </ViewerErrorBoundary>
        <OrientationControls />
      </div>
  );
};

export default OBJSTLViewer;
