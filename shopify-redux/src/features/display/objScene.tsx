import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import * as THREE from "three";
import React, { useRef, useState, useEffect } from 'react';
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import logger from '../../app/utility/logger';
import { calculateThreeVolume, calculateSize, calculateMaxScaling, calculateMinScaling } from "../../app/utility/utils";
import { setAutoScaleOnLoad, setModelDimensions, setModelVolume, setMultiplierValue, setScales } from "../../services/dataSlice";

const OBJScene = () => {
    const dispatch = useDispatch()
    const [obj, setObj] = useState<THREE.Mesh | null>(null);
    const [measuredObj, setMeasuredObj] = useState<THREE.Mesh | null>(null);
    const [isMultiplierInitialized] = useState<boolean>(false);
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
                        child.geometry.computeBoundingBox();
                        const center = new THREE.Vector3();
                        child.geometry.boundingBox!.getCenter(center);
                        child.geometry.translate(-center.x, -center.y, -center.z);
                        setObj(child);
                    }
                });
            },
            undefined,
            (error) => {
                logger.error("[OBJScene] Error loading OBJ file:", error);
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
                        const measuredSize = calculateSize(child)
                        const maximumScale = calculateMaxScaling(measuredSize)
                        const minimumScale = calculateMinScaling(measuredSize)
                        dispatch(setScales({minScale: minimumScale, maxScale: maximumScale }))
                        if (dataState.autoScaleOnLoad) {
                            dispatch(setMultiplierValue({ multiplierValue: maximumScale }));
                            dispatch(setAutoScaleOnLoad({autoScaleOnLoad: false}))
                        }
                    }
                });
            },
            undefined,
            (error) => {
                logger.error('Error loading OBJ file:', error);
            }
        ); },[dataState.selectedFile, dataState.autoScaleOnLoad, dispatch, isMultiplierInitialized])


        useEffect(() => {
            if (obj && measuredObj) {
                obj.rotation.x = dataState.xFlip
                obj.rotation.y = dataState.yFlip
                obj.rotation.z = dataState.zFlip
                obj.scale.set(dataState.multiplierValue, dataState.multiplierValue, dataState.multiplierValue)
                obj.traverse((child) => {
                    const mesh = child as THREE.Mesh;
                    mesh.material = new THREE.MeshStandardMaterial({ color: dataState.modelColour });
                });

                // Compute volume & dimensions from unscaled geometry, apply multiplier mathematically
                const baseVolume = calculateThreeVolume(measuredObj, true)
                const scale3 = Math.pow(dataState.multiplierValue, 3)
                dispatch(setModelVolume({modelVolume: baseVolume * scale3}))
                const baseSize = calculateSize(measuredObj)
                const scaledSize = new THREE.Vector3(
                    baseSize.x * dataState.multiplierValue,
                    baseSize.y * dataState.multiplierValue,
                    baseSize.z * dataState.multiplierValue
                )
                dispatch(setModelDimensions({modelDimensions: scaledSize}))
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



