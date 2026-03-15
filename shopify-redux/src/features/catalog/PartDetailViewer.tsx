import React, { useEffect, useState, Suspense, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, useGLTF } from '@react-three/drei';
import { Box, CircularProgress, Typography } from '@mui/material';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import * as THREE from 'three';
import { fetchFile, extractFileInfo, fetchCadFile, isCadFileType } from '../../services/fetchFileUtils';
import { ViewerErrorBoundary } from '../shared/ViewerErrorBoundary';
import logger from '../../app/utility/logger';

interface PartDetailViewerProps {
  taskId: string;
  fileType: string;
  colour: string;
}

/** OBJ/STL scene — loads from blob URL, centers, scales, applies colour */
function ObjStlScene({ fileUrl, fileType, colour }: { fileUrl: string; fileType: string; colour: string }) {
  const [mesh, setMesh] = useState<THREE.Mesh | null>(null);
  const { camera, invalidate } = useThree();

  useEffect(() => {
    if (fileType.includes('obj')) {
      const loader = new OBJLoader();
      loader.load(
        fileUrl,
        (loadedObj) => {
          loadedObj.traverse((child) => {
            if (child instanceof THREE.Mesh) setMesh(child);
          });
        },
        undefined,
        (error) => logger.error('[PartDetailViewer] OBJ load error:', error)
      );
    } else {
      const loader = new STLLoader();
      loader.load(
        fileUrl,
        (geometry) => {
          const mat = new THREE.MeshStandardMaterial({ color: colour, metalness: 0.3, roughness: 0.7 });
          setMesh(new THREE.Mesh(geometry, mat));
        },
        undefined,
        (error) => logger.error('[PartDetailViewer] STL load error:', error)
      );
    }
  }, [fileUrl, fileType, colour]);

  useEffect(() => {
    if (!mesh) return;
    mesh.material = new THREE.MeshStandardMaterial({ color: colour, metalness: 0.3, roughness: 0.7 });
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox!;
    const center = new THREE.Vector3();
    box.getCenter(center);
    mesh.geometry.translate(-center.x, -center.y, -center.z);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const scale = 2 / maxDim;
      mesh.scale.set(scale, scale, scale);
    }
    (camera as THREE.PerspectiveCamera).position.set(3, 2, 3);
    (camera as THREE.PerspectiveCamera).lookAt(0, 0, 0);
    invalidate();
  }, [mesh, colour, camera, invalidate]);

  return mesh ? (
    <primitive object={mesh} />
  ) : null;
}

/** GLTF/GLB scene — loads from blob URL via useGLTF, centers, scales, applies colour */
function GltfScene({ fileUrl, colour }: { fileUrl: string; colour: string }) {
  const { scene } = useGLTF(fileUrl);
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();

  useEffect(() => {
    if (!scene || !groupRef.current) return;

    while (groupRef.current.children.length > 0) {
      groupRef.current.remove(groupRef.current.children[0]);
    }

    const clonedScene = scene.clone();
    const color = new THREE.Color(colour);
    clonedScene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.7 });
      }
    });

    const box = new THREE.Box3().setFromObject(clonedScene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = maxDim > 0 ? 2 / maxDim : 1;

    clonedScene.position.sub(center);
    clonedScene.scale.setScalar(scale);

    groupRef.current.add(clonedScene);

    camera.position.set(3, 2, 3);
    camera.lookAt(0, 0, 0);
  }, [scene, colour, camera]);

  return <group ref={groupRef} />;
}

/** Routes to the correct inner scene based on file type */
function PartScene({ fileUrl, fileType, colour }: { fileUrl: string; fileType: string; colour: string }) {
  if (fileType === 'glb' || fileType === 'gltf') {
    return <GltfScene fileUrl={fileUrl} colour={colour} />;
  }
  return <ObjStlScene fileUrl={fileUrl} fileType={fileType} colour={colour} />;
}

const PartDetailViewer = React.memo(({ taskId, fileType, colour }: PartDetailViewerProps) => {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let blobUrl: string | null = null;

    const loadFile = async () => {
      try {
        if (isCadFileType(fileType)) {
          const cadResult = await fetchCadFile(taskId);
          if (cancelled) return;
          blobUrl = cadResult.fileUrl;
        } else {
          const fileResponse = await fetchFile(taskId);
          if (cancelled) return;
          const fileInfo = extractFileInfo(fileResponse, `${taskId}.${fileType}`);
          blobUrl = fileInfo.fileUrl;
        }
        setFileUrl(blobUrl);
      } catch (err) {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadFile();

    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [taskId, fileType]);

  if (loading) {
    return (
      <Box sx={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(circle at center, #1a2230 0%, #0A0E14 100%)',
        borderRadius: 3,
      }}>
        <CircularProgress size={48} sx={{ color: 'text.secondary', opacity: 0.6 }} />
      </Box>
    );
  }

  if (error || !fileUrl) {
    return (
      <Box sx={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 1,
        background: 'radial-gradient(circle at center, #1a2230 0%, #0A0E14 100%)',
        borderRadius: 3,
      }}>
        <ViewInArIcon sx={{ fontSize: 64, color: 'text.secondary', opacity: 0.4 }} />
        <Typography variant="body2" color="text.secondary">Unable to load model</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{
      width: '100%', height: '100%',
      background: 'radial-gradient(circle at center, #1a2230 0%, #0A0E14 100%)',
      borderRadius: 3, overflow: 'hidden',
    }}>
      <ViewerErrorBoundary>
        <Canvas
          camera={{ fov: 50, near: 0.1, far: 100, position: [3, 2, 3] }}
          style={{ width: '100%', height: '100%' }}
        >
          <Suspense fallback={null}>
            <PartScene fileUrl={fileUrl} fileType={fileType} colour={colour} />
            <OrbitControls enableZoom enablePan enableRotate zoomSpeed={0.5} panSpeed={0.5} rotateSpeed={0.5} target={[0, 0, 0]} />
            <Environment files="HdrSkyOvercast001_HDR_2K.exr" />
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 10]} intensity={0.5} />
          </Suspense>
        </Canvas>
      </ViewerErrorBoundary>
    </Box>
  );
});

PartDetailViewer.displayName = 'PartDetailViewer';

export default PartDetailViewer;
