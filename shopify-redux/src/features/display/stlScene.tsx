import { STLLoader } from 'three/examples/jsm/loaders/STLLoader'
import * as THREE from "three";
import React, { useEffect, useState} from 'react';
import { calculateSize, calculateThreeVolume, calculateMaxScaling, calculateMinScaling} from "../../app/utility/utils";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { setFromMeshyOrHistory, setModelDimensions, setModelVolume, setMultiplierValue, setScales } from '../../services/dataSlice';


const STLScene = (
) => {
    const [stl, setStl] = useState<THREE.Mesh | null>(null);
    const [measuredStl, setMeasuredStl] = useState<THREE.Mesh | null>(null)
    const [isMultiplierInitialized, setIsMultiplierInitialized] = useState<boolean>(false);
    const dispatch = useDispatch()
    const dataState = useSelector(
        (state: RootState) => state.dataState
    )

    useEffect(() => {

        const loader = new STLLoader();
        loader.load(dataState.selectedFile, (geometry) => {
            // Create a Mesh from the loaded geometry
            const material = new THREE.MeshStandardMaterial({ color: dataState.modelColour, wireframeLinewidth: 2 });
            const loadedStl = new THREE.Mesh(geometry, material);
            setStl(loadedStl); // Set the Mesh object
            
        }, undefined, (error) => {
            console.error("Error loading STL file:", error);
        });
    }, [dataState.selectedFile, dataState.multiplierValue]);

    useEffect(() => {
        const measuredLoader = new STLLoader();
        measuredLoader.load(dataState.selectedFile, (geometry) => {
            // Create a Mesh from the loaded geometry
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
            console.error("Error loading STL file:", error);
        });
    }, [dataState.selectedFile, dataState.modelColour, dataState.multiplierValue, isMultiplierInitialized, dispatch]);
    
useEffect(() => {
    if (stl && measuredStl) {
        stl.rotation.x = dataState.xFlip
        stl.rotation.y = dataState.yFlip
        stl.rotation.z = dataState.zFlip
        stl.scale.set(1*dataState.multiplierValue,1*dataState.multiplierValue,1*dataState.multiplierValue)
        stl.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.material) {
                mesh.material = new THREE.MeshStandardMaterial({ color: dataState.modelColour, wireframeLinewidth: 2 });
            }
            measuredStl.geometry.scale(1*dataState.multiplierValue,1*dataState.multiplierValue,1*dataState.multiplierValue)
            const measuredVolume = calculateThreeVolume(measuredStl, true)
            dispatch(setModelVolume({modelVolume: measuredVolume}))
            const measuredSize = calculateSize(measuredStl)
            dispatch(setModelDimensions({modelDimensions: measuredSize}))  
        });
    } 
}, [stl, measuredStl, dataState.modelColour, dataState.multiplierValue, dispatch]);

return (
    <>
        {stl && <primitive object={stl} scale={1.0} />}
        <axesHelper args={[150]} />
    </>
);
};

  export default STLScene


