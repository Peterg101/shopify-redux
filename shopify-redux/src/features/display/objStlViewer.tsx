import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import OBJScene from './objScene';
import { useSelector } from "react-redux";
import { RootState } from "../../app/store";
import STLScene from './stlScene';
import { ViewerErrorBoundary } from '../shared/ViewerErrorBoundary';
import { OrientationControls } from './OrientationControls';

interface OBJSTLViewerProps {
  hideOrientationControls?: boolean;
}

const OBJSTLViewer = ({ hideOrientationControls = false }: OBJSTLViewerProps) => {
    const dataState = useSelector(
        (state: RootState) => state.dataState
    )

  return (
      <div className="App" style={{ width: '100%', height: '100%', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <ViewerErrorBoundary>
          <Canvas
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'radial-gradient(circle at center, #1a2230 0%, #0A0E14 100%)' }}
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
        </div>
        {!hideOrientationControls && <OrientationControls />}
      </div>
  );
};

export default OBJSTLViewer;
