import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import React, { useRef, useState, useEffect } from 'react';
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { useFile } from "../../services/fileProvider";
import { calculateThreeVolume, calculateSize, calculateMaxScaling, calculateMinScaling } from "../../app/utility/utils";
import { setModelVolume, setScales } from "../../services/dataSlice";

// interface OBJSceneProps {
//     filename: string; // Assuming selectedFile is a string representing the file name
//     modelColour: string;
//     setModelVolume: React.Dispatch<React.SetStateAction<number>>
//     setModelDimensions: React.Dispatch<React.SetStateAction<THREE.Vector3>>
//     multiplierValue: number
//     maxScale: number
//     setMaxScale: React.Dispatch<React.SetStateAction<number>>
//     minScale: number
//     setMinScale: React.Dispatch<React.SetStateAction<number>>
// }

const OBJScene = ({ 
    // filename, 
    // modelColour, 
    // setModelVolume, 
    // setModelDimensions, 
    // multiplierValue,
    // maxScale,
    // setMaxScale,
    // minScale,
    // setMinScale
}) => {
    const dispatch = useDispatch()
    const [obj, setObj] = useState<THREE.Mesh | null>(null);
    const {actualFile, setActualFile} = useFile()
    const [measuredObj, setMeasuredObj] = useState<THREE.Mesh | null>(null);
    const objRef = useRef<THREE.Mesh | null>(null);
    const dataState = useSelector(
        (state: RootState) => state.dataState
    )

    useEffect(() => {
    const objLoader = new OBJLoader();
    objLoader.load(
        dataState.fileNameBoxValue,
        (object) => {
            // Object is a group of meshes, traverse and add to scene
            object.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    // Optionally assign materials here if not already assigned
                    child.geometry.dispose()
                    child.geometry.scale(dataState.multiplierValue, dataState.multiplierValue, dataState.multiplierValue)
                    const measuredVolume = calculateThreeVolume(child, true)
                    const measuredSize = calculateSize(child)
                    setModelDimensions(measuredSize);
                    dispatch(setModelVolume({modelVolume: measuredVolume}))
                    setMeasuredObj(child)
                    // 
                }
            });
        },
        undefined,
        (error) => {
            console.error('Error loading OBJ file:', error);
        }
    ); },[dataState.fileNameBoxValue, dataState.multiplierValue, dataState.modelColour])


    useEffect(() => {
        const loader = new OBJLoader();
        loader.load(
            dataState.fileNameBoxValue,
            (loadedObj) => {
                
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
    }, [dataState.fileNameBoxValue]);

    // Update the object's color
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



