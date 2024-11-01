import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import * as THREE from "three";
import React, { useRef, useState, useEffect } from 'react';
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { calculateThreeVolume, calculateSize, calculateMaxScaling, calculateMinScaling } from "../../app/utility/utils";
import { setModelVolume, setScales } from "../../services/dataSlice";

const OBJScene = () => {
    const dispatch = useDispatch()
    const [obj, setObj] = useState<THREE.Mesh | null>(null);
    const [measuredObj, setMeasuredObj] = useState<THREE.Mesh | null>(null);
    const objRef = useRef<THREE.Mesh | null>(null);
    const dataState = useSelector(
        (state: RootState) => state.dataState
    )

    useEffect(() => {
    const objLoader = new OBJLoader();
    objLoader.load(
        dataState.selectedFile,
        (object) => {
            object.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    child.geometry.dispose()
                    child.geometry.scale(dataState.multiplierValue, dataState.multiplierValue, dataState.multiplierValue)
                    const measuredVolume = calculateThreeVolume(child, true)
                    dispatch(setModelVolume({modelVolume: measuredVolume}))
                    setMeasuredObj(child)
                }
            });
        },
        undefined,
        (error) => {
            console.error('Error loading OBJ file:', error);
        }
    ); },[dataState.selectedFile, dataState.multiplierValue, dataState.modelColour, dispatch])


    useEffect(() => {
        const loader = new OBJLoader();
        loader.load(
            dataState.selectedFile,
            (loadedObj) => {
                console.log(loadedObj)
                loadedObj.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.rotation.x = -Math.PI/2
                        const measuredSize = calculateSize(child)
                        const maximumScale = calculateMaxScaling(measuredSize)
                        const minimumScale = calculateMinScaling(measuredSize)
                        dispatch(setScales({minScale: minimumScale, maxScale: maximumScale }))
                        child.material = new THREE.MeshStandardMaterial({ color: dataState.modelColour });
                        setObj(child);
                        objRef.current = child;
                    }
                });
            },
            undefined,
            (error) => {
                console.error("Error loading OBJ file:", error);
            }
        );
    }, [dataState.selectedFile, dataState.modelColour, dispatch]);

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



