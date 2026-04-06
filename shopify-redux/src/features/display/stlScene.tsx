import { STLLoader } from 'three/examples/jsm/loaders/STLLoader'
import * as THREE from "three";
import React, { useEffect, useState} from 'react';
import { calculateSize, calculateThreeVolume, calculateMaxScaling, calculateMinScaling} from "../../app/utility/utils";
import logger from '../../app/utility/logger';
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { setFromMeshyOrHistory, setModelDimensions, setModelVolume, setMultiplierValue, setScales } from '../../services/dataSlice';


const STLScene = (
) => {
    const [stl, setStl] = useState<THREE.Mesh | null>(null);
    const [measuredStl, setMeasuredStl] = useState<THREE.Mesh | null>(null)
    const [isMultiplierInitialized] = useState<boolean>(false);
    const dispatch = useDispatch()
    const dataState = useSelector(
        (state: RootState) => state.dataState
    )

    useEffect(() => {
        const loader = new STLLoader();
        loader.load(dataState.selectedFile, (geometry) => {
            // Center geometry on origin so model appears where camera is looking
            geometry.computeBoundingBox();
            const center = new THREE.Vector3();
            geometry.boundingBox!.getCenter(center);
            geometry.translate(-center.x, -center.y, -center.z);
            // Create a Mesh from the loaded geometry
            const material = new THREE.MeshStandardMaterial({ color: dataState.modelColour, wireframeLinewidth: 2 });
            const loadedStl = new THREE.Mesh(geometry, material);
            setStl(loadedStl); // Set the Mesh object

        }, undefined, (error) => {
            logger.error("[STLScene] Error loading STL file:", error);
        });
    }, [dataState.selectedFile, dataState.multiplierValue, dataState.modelColour]);

    useEffect(() => {
        const measuredLoader = new STLLoader();
        measuredLoader.load(dataState.selectedFile, (geometry) => {
            const material = new THREE.MeshStandardMaterial({ color: dataState.modelColour, wireframeLinewidth: 2 });
            const otherLoadedStl = new THREE.Mesh(geometry, material);
            setMeasuredStl(otherLoadedStl)
            const measuredSize = calculateSize(otherLoadedStl)
            const maximumScale = calculateMaxScaling(measuredSize)
            const minimumScale = calculateMinScaling(measuredSize)
            dispatch(setScales({minScale: minimumScale, maxScale: maximumScale }))
            if (dataState.fromMeshyOrHistory) {
                dispatch(setMultiplierValue({ multiplierValue: maximumScale }));
                dispatch(setFromMeshyOrHistory({fromMeshyOrHistory: false}))
            }
        }, undefined, (error) => {
            logger.error("Error loading STL file:", error);
        });
    }, [dataState.selectedFile, dataState.fromMeshyOrHistory, isMultiplierInitialized, dispatch]);

useEffect(() => {
    if (stl && measuredStl) {
        stl.rotation.x = dataState.xFlip
        stl.rotation.y = dataState.yFlip
        stl.rotation.z = dataState.zFlip
        stl.scale.set(dataState.multiplierValue, dataState.multiplierValue, dataState.multiplierValue)
        stl.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.material) {
                mesh.material = new THREE.MeshStandardMaterial({ color: dataState.modelColour, wireframeLinewidth: 2 });
            }
        });

        // Compute volume & dimensions from unscaled geometry, apply multiplier mathematically
        const baseVolume = calculateThreeVolume(measuredStl, true)
        const scale3 = Math.pow(dataState.multiplierValue, 3)
        dispatch(setModelVolume({modelVolume: baseVolume * scale3}))
        const baseSize = calculateSize(measuredStl)
        const scaledSize = new THREE.Vector3(
            baseSize.x * dataState.multiplierValue,
            baseSize.y * dataState.multiplierValue,
            baseSize.z * dataState.multiplierValue
        )
        dispatch(setModelDimensions({modelDimensions: scaledSize}))
    }
}, [stl, measuredStl, dataState.modelColour, dataState.multiplierValue, dataState.xFlip, dataState.yFlip, dataState.zFlip, dispatch]);

return (
    <>
        {stl && <primitive object={stl} scale={1.0} />}
        <axesHelper args={[150]} />
    </>
);
};

  export default STLScene


