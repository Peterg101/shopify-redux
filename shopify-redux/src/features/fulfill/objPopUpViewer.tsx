import React, { Suspense } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { OrbitControls, Stage } from "@react-three/drei";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";

interface ObjPopUpViewerProps {
  url: string;
}

// Loader component wrapped in Suspense boundary
const ObjModel: React.FC<{ url: string }> = ({ url }) => {
  const obj = useLoader(OBJLoader, url);
  return <primitive object={obj} scale={0.01} />;
};

export const ObjPopUpViewer: React.FC<ObjPopUpViewerProps> = ({ url }) => {
  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
      <ambientLight intensity={0.5} />
      <Suspense fallback={null}>
        <Stage>
          <ObjModel url={url} />
        </Stage>
      </Suspense>
      <OrbitControls />
    </Canvas>
  );
};