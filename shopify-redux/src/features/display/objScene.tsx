import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import * as THREE from "three";
import React, { useRef, useState, useEffect } from 'react';
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { calculateThreeVolume, calculateSize, calculateMaxScaling, calculateMinScaling } from "../../app/utility/utils";
import { setFromMeshyOrHistory, setModelDimensions, setModelVolume, setMultiplierValue, setScales } from "../../services/dataSlice";

const OBJScene = () => {
    const dispatch = useDispatch()
    const [obj, setObj] = useState<THREE.Mesh | null>(null);
    const [measuredObj, setMeasuredObj] = useState<THREE.Mesh | null>(null);
    const [isMultiplierInitialized, setIsMultiplierInitialized] = useState<boolean>(false);
    const objRef = useRef<THREE.Mesh | null>(null);
    const dataState = useSelector(
        (state: RootState) => state.dataState
    )

    useEffect(() => {
        const loader = new OBJLoader();
        loader.load(
            dataState.selectedFile,
            (loadedObj) => {
                loadedObj.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.geometry.dispose()
                        setObj(child);
                    }
                });
            },
            undefined,
            (error) => {
                console.error("Error loading OBJ file:", error);
            }
        );
    }, [dataState.selectedFile, dispatch]);

    useEffect(() => {
        const measuredLoader = new OBJLoader();
        measuredLoader.load(
            dataState.selectedFile,
            (object) => {
                object.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.geometry.dispose()
                        setMeasuredObj(child)
                        console.log(dataState.multiplierValue)
                        const measuredSize = calculateSize(child)
                        const maximumScale = calculateMaxScaling(measuredSize)
                        const minimumScale = calculateMinScaling(measuredSize)
                        dispatch(setScales({minScale: minimumScale, maxScale: maximumScale }))
                        if (dataState.fromMeshyOrHistory) {
                            console.log('MULTIO(P')
                            console.log(isMultiplierInitialized)
                            dispatch(setMultiplierValue({ multiplierValue: maximumScale }));
                            dispatch(setFromMeshyOrHistory({fromMeshyOrHistory: false}))
                        }
                    }
                });
            },
            undefined,
            (error) => {
                console.error('Error loading OBJ file:', error);
            }
        ); },[dataState.selectedFile, dataState.multiplierValue, dataState.modelColour, dispatch, isMultiplierInitialized])
    
    
        useEffect(() => {
            if (obj && measuredObj) {
                obj.rotation.x = dataState.xFlip
                obj.rotation.y = dataState.yFlip
                obj.rotation.z = dataState.zFlip
                obj.scale.set(1*dataState.multiplierValue,1*dataState.multiplierValue,1*dataState.multiplierValue)
                obj.traverse((child) => {
                    const mesh = child as THREE.Mesh;
                    mesh.material = new THREE.MeshStandardMaterial({ color: dataState.modelColour });
                    
                    measuredObj.geometry.scale(1*dataState.multiplierValue,1*dataState.multiplierValue,1*dataState.multiplierValue)
                    const measuredVolume = calculateThreeVolume(measuredObj, true)
                    dispatch(setModelVolume({modelVolume: measuredVolume}))
                    const measuredSize = calculateSize(measuredObj)
                    dispatch(setModelDimensions({modelDimensions: measuredSize}))     
                });
            } 
        }, [obj, measuredObj, dataState.modelColour, dataState.multiplierValue, dataState.xFlip, dataState.yFlip, dataState.zFlip, dispatch]);

    useEffect(() => {
        if (objRef.current) {
            (objRef.current.material as THREE.MeshStandardMaterial).color.set(dataState.modelColour);
        }
    }, [dataState.modelColour]);

    useEffect(() => {
        if (objRef.current) {
            objRef.current.scale.set(dataState.multiplierValue, dataState.multiplierValue, dataState.multiplierValue);
        }
    }, [dataState.multiplierValue]);  
    

        return (
        <>
            {obj && <primitive object={obj} scale={1.0} />}
            <axesHelper args={[100]} />
        </>
    );
};



export default OBJScene



