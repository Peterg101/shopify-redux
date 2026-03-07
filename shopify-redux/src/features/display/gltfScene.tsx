import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useSelector } from "react-redux";
import { RootState } from "../../app/store";

const GLTFScene = () => {
  const dataState = useSelector((state: RootState) => state.dataState);
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);

  const { scene } = useGLTF(dataState.selectedFile);

  useEffect(() => {
    if (!scene || !groupRef.current) return;

    // Clear previous children
    while (groupRef.current.children.length > 0) {
      groupRef.current.remove(groupRef.current.children[0]);
    }

    const clonedScene = scene.clone();

    // Apply colour
    const color = new THREE.Color(dataState.modelColour);
    clonedScene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = new THREE.MeshStandardMaterial({
          color,
          metalness: 0.3,
          roughness: 0.7,
        });
      }
    });

    // Center and scale
    const box = new THREE.Box3().setFromObject(clonedScene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = (50 * dataState.multiplierValue) / maxDim;

    clonedScene.position.sub(center);
    clonedScene.scale.setScalar(scale);

    // Apply orientation flips
    clonedScene.rotation.set(
      dataState.xFlip * (Math.PI / 2),
      dataState.yFlip * (Math.PI / 2),
      dataState.zFlip * (Math.PI / 2)
    );

    groupRef.current.add(clonedScene);

    // Position camera
    camera.position.set(70, 70, 70);
    camera.lookAt(0, 0, 0);
  }, [scene, dataState.modelColour, dataState.multiplierValue, dataState.xFlip, dataState.yFlip, dataState.zFlip, camera]);

  return <group ref={groupRef} />;
};

export default GLTFScene;
