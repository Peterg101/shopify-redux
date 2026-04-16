import React, { Suspense, lazy, useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import OBJScene from './objScene';
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../../app/store";
import STLScene from './stlScene';
import { ViewerErrorBoundary } from '../shared/ViewerErrorBoundary';
import { OrientationControls } from './OrientationControls';
import { FeatureOverlay, OverlayMode } from './FeatureOverlay';
import { Box, IconButton, Tooltip } from '@mui/material';
import LabelOffIcon from '@mui/icons-material/LabelOff';
import LabelIcon from '@mui/icons-material/Label';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import { borderSubtle, bgHighlight, bgPaper, bgDefault } from '../../theme';

const GLTFScene = lazy(() => import('./gltfScene'));

const OVERLAY_MODES: OverlayMode[] = ['off', 'features', 'detailed'];
const OVERLAY_LABELS: Record<OverlayMode, string> = {
  off: 'Labels off',
  features: 'Feature tags',
  detailed: 'Detailed (faces)',
};
const OVERLAY_ICONS: Record<OverlayMode, React.ReactNode> = {
  off: <LabelOffIcon fontSize="small" />,
  features: <LabelIcon fontSize="small" />,
  detailed: <AccountTreeIcon fontSize="small" />,
};

interface OBJSTLViewerProps {
  hideOrientationControls?: boolean;
  onTagClick?: (text: string) => void;
}

const OBJSTLViewer = ({ hideOrientationControls = false, onTagClick }: OBJSTLViewerProps) => {
    const dataState = useSelector(
        (state: RootState) => state.dataState
    )
    const [overlayMode, setOverlayMode] = useState<OverlayMode>('off');

    const features = dataState.stepMetadata?.features ?? [];
    const faces = dataState.stepMetadata?.faces ?? [];
    const boundingBox = dataState.stepMetadata?.boundingBox;
    const suppressed = dataState.stepMetadata?.suppressed ?? [];
    const hasGeometry = features.length > 0 || faces.length > 0;

    const cycleOverlayMode = useCallback(() => {
      const idx = OVERLAY_MODES.indexOf(overlayMode);
      setOverlayMode(OVERLAY_MODES[(idx + 1) % OVERLAY_MODES.length]);
    }, [overlayMode]);

  return (
      <div className="App" style={{ width: '100%', height: '100%', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <ViewerErrorBoundary>
          <Canvas
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: `radial-gradient(circle at center, ${bgPaper} 0%, ${bgDefault} 100%)` }}
            camera={{ fov: 100, near: 0.1, far: 1000, position: [100, 100, 100] }}
          >
            <Suspense fallback={null}>
              {dataState.selectedFileType.includes("obj") ? (
                <OBJScene />
              ) : dataState.selectedFileType === "glb" || dataState.selectedFileType === "gltf" ? (
                <GLTFScene key={dataState.selectedFile} />
              ) : (
                <STLScene />
              )}
              {/* 3-point lighting for CAD model visibility */}
              <ambientLight intensity={0.4} />
              <directionalLight position={[60, 80, 50]} intensity={0.7} />   {/* Key light */}
              <directionalLight position={[-40, 20, -30]} intensity={0.3} /> {/* Fill light */}
              <directionalLight position={[0, -20, 60]} intensity={0.2} />   {/* Rim light */}
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
              {/* Feature overlay */}
              <FeatureOverlay
                features={features}
                faces={faces}
                mode={overlayMode}
                onTagClick={onTagClick}
                boundingBox={boundingBox}
                suppressed={suppressed}
              />
            </Suspense>
          </Canvas>
        </ViewerErrorBoundary>

        {/* Overlay toggle button */}
        {hasGeometry && (
          <Box sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 20,
          }}>
            <Tooltip title={OVERLAY_LABELS[overlayMode]} placement="left">
              <IconButton
                size="small"
                onClick={cycleOverlayMode}
                sx={{
                  border: `1px solid ${overlayMode === 'off' ? borderSubtle : '#00E5FF'}`,
                  backgroundColor: overlayMode === 'off' ? bgHighlight : 'rgba(0, 229, 255, 0.1)',
                  color: overlayMode === 'off' ? 'text.secondary' : 'primary.main',
                  backdropFilter: 'blur(4px)',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 229, 255, 0.15)',
                    borderColor: '#00E5FF',
                  },
                }}
              >
                {OVERLAY_ICONS[overlayMode]}
              </IconButton>
            </Tooltip>
          </Box>
        )}
        </div>
        {!hideOrientationControls && <OrientationControls />}
      </div>
  );
};

export default OBJSTLViewer;
