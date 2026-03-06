import React, { useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import * as THREE from 'three';

interface ThumbnailSceneProps {
  fileUrl: string;
  fileType: string;
  colour: string;
}

function ThumbnailScene({ fileUrl, fileType, colour }: ThumbnailSceneProps) {
  const [mesh, setMesh] = useState<THREE.Mesh | null>(null);
  const { camera, invalidate } = useThree();

  useEffect(() => {
    if (fileType.includes('obj')) {
      const loader = new OBJLoader();
      loader.load(
        fileUrl,
        (loadedObj) => {
          loadedObj.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              setMesh(child);
            }
          });
        },
        undefined,
        (error) => console.error('[ThumbnailScene] OBJ load error:', error)
      );
    } else {
      const loader = new STLLoader();
      loader.load(
        fileUrl,
        (geometry) => {
          const material = new THREE.MeshStandardMaterial({ color: colour });
          const loadedMesh = new THREE.Mesh(geometry, material);
          setMesh(loadedMesh);
        },
        undefined,
        (error) => console.error('[ThumbnailScene] STL load error:', error)
      );
    }
  }, [fileUrl, fileType, colour]);

  useEffect(() => {
    if (!mesh) return;

    // Apply colour
    mesh.material = new THREE.MeshStandardMaterial({ color: colour });

    // Center model on origin
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox!;
    const center = new THREE.Vector3();
    box.getCenter(center);
    mesh.geometry.translate(-center.x, -center.y, -center.z);

    // Auto-scale to fit camera
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const scale = 2 / maxDim;
      mesh.scale.set(scale, scale, scale);
    }

    // Position camera
    (camera as THREE.PerspectiveCamera).position.set(3, 2, 3);
    (camera as THREE.PerspectiveCamera).lookAt(0, 0, 0);

    invalidate();
  }, [mesh, colour, camera, invalidate]);

  return mesh ? (
    <>
      <primitive object={mesh} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
    </>
  ) : null;
};

export default ThumbnailScene;
