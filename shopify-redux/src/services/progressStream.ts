import { AppDispatch } from "../app/store";
import { authApi } from "./authApi";
import logger from '../app/utility/logger';
import { setMeshyLoadedPercentage, setMeshyLoading, setMeshyPending, setMeshyQueueItems, setMeshyPreviewTaskId } from "./meshySlice";
import { setCadLoadedPercentage, setCadLoading, setCadPending, setCadStatusMessage, setCadError, setCadOperationType } from "./cadSlice";
import { extractFileInfo, fetchFile } from "./fetchFileUtils";
import { setFileProperties, setFromMeshyOrHistory, setStepMetadata, setModelVolume, setModelDimensions } from "./dataSlice";

const RECONNECT_DELAY = 3000;

export function connectProgressStream(
    portId: string,
    taskType: 'meshy' | 'cad',
    dispatch: AppDispatch,
    setActualFile: React.Dispatch<React.SetStateAction<File | null>>,
): () => void {
    let disposed = false;
    let taskTerminated = false;
    let reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
    const abortController = new AbortController();
    const blobUrls: string[] = [];
    let isFirstMessage = true;

    const cleanup = () => {
        disposed = true;
        if (reconnectTimeoutId !== null) {
            clearTimeout(reconnectTimeoutId);
            reconnectTimeoutId = null;
        }
        abortController.abort();
        blobUrls.forEach(url => URL.revokeObjectURL(url));
        blobUrls.length = 0;
    };

    const connect = async () => {
        if (disposed) return;

        try {
            const response = await fetch(
                `${process.env.REACT_APP_GENERATION_URL}/progress/${portId}`,
                { signal: abortController.signal }
            );

            if (!response.ok || !response.body) {
                throw new Error(`SSE connection failed: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done || disposed) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                // Keep the last (possibly incomplete) line in the buffer
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data:')) continue;
                    const data = line.slice(5).trim();
                    if (!data) continue;

                    if (isFirstMessage) {
                        dispatch(authApi.util.invalidateTags([{ type: 'sessionData' }]));
                        isFirstMessage = false;
                    }

                    if (taskType === 'meshy') {
                        await handleMeshyMessage(data, dispatch, setActualFile, abortController.signal, blobUrls);
                    } else {
                        await handleCadMessage(data, dispatch, setActualFile, abortController.signal, blobUrls, disposed);
                    }

                    // Mark as terminated so we don't reconnect
                    if (data.startsWith('Task Completed') || data.startsWith('Task Failed')) {
                        taskTerminated = true;
                    }
                }
            }
        } catch (err: any) {
            if (disposed || err?.name === 'AbortError') return;
            logger.error(`SSE ${taskType} error:`, err);
        }

        // Stream ended or errored — reconnect unless disposed or task finished
        if (!disposed && !taskTerminated) {
            if (taskType === 'meshy') {
                dispatch(setMeshyLoading({ meshyLoading: false }));
            } else {
                dispatch(setCadLoading({ cadLoading: false }));
            }
            dispatch(authApi.util.invalidateTags([{ type: 'sessionData' }]));

            reconnectTimeoutId = setTimeout(() => {
                isFirstMessage = true;
                connect();
            }, RECONNECT_DELAY);
        }
    };

    connect();
    return cleanup;
}

async function handleMeshyMessage(
    data: string,
    dispatch: AppDispatch,
    setActualFile: React.Dispatch<React.SetStateAction<File | null>>,
    signal: AbortSignal,
    blobUrls: string[],
) {
    const parts = data.split(",");
    if (parts.length !== 3) {
        logger.warn("Unexpected SSE message format:", data);
        return;
    }

    const percentageComplete = parseInt(parts[0], 10);
    const taskId = parts[1];
    const fileName = parts[2];

    if (isNaN(percentageComplete) || !taskId || !fileName) {
        logger.warn("Invalid SSE message data:", data);
        return;
    }

    dispatch(setMeshyLoadedPercentage({ meshyLoadedPercentage: percentageComplete }));
    dispatch(setMeshyPending({ meshyPending: false }));
    dispatch(setMeshyQueueItems({ meshyQueueItems: 0 }));
    dispatch(setMeshyLoading({ meshyLoading: true }));

    if (percentageComplete === 100) {
        try {
            const fileData = await fetchFile(taskId, signal);
            const fileInfo = extractFileInfo(fileData, fileName);
            blobUrls.push(fileInfo.fileUrl);
            setActualFile(fileInfo.file);
            dispatch(setFromMeshyOrHistory({ fromMeshyOrHistory: true }));
            dispatch(setFileProperties({
                selectedFile: fileInfo.fileUrl,
                selectedFileType: 'obj',
                fileNameBoxValue: fileName,
            }));
        } catch (err) {
            logger.error("Error fetching completed file:", err);
        }
        dispatch(setMeshyLoading({ meshyLoading: false }));
        dispatch(setMeshyPreviewTaskId({ meshyPreviewTaskId: taskId }));
    }
}

async function handleCadMessage(
    data: string,
    dispatch: AppDispatch,
    setActualFile: React.Dispatch<React.SetStateAction<File | null>>,
    signal: AbortSignal,
    blobUrls: string[],
    disposed: boolean,
) {
    // Handle failure
    if (data.startsWith("Task Failed")) {
        const errorMsg = data.replace("Task Failed,", "");
        dispatch(setCadError({ cadError: errorMsg }));
        dispatch(setCadLoading({ cadLoading: false }));
        dispatch(setCadPending({ cadPending: false }));
        dispatch(setCadOperationType({ cadOperationType: null }));
        return;
    }

    // Handle validation rejection (refinement caught unwanted changes)
    if (data.startsWith("Refinement Rejected,")) {
        const reason = data.substring("Refinement Rejected,".length);
        dispatch(setCadError({ cadError: `Refinement rejected: ${reason}` }));
        dispatch(setCadLoading({ cadLoading: false }));
        dispatch(setCadPending({ cadPending: false }));
        dispatch(setCadOperationType({ cadOperationType: null }));
        return;
    }

    // Handle clarification request (LLM needs more info from user)
    if (data.startsWith("Clarification Needed,")) {
        const clarification = data.substring("Clarification Needed,".length);
        dispatch(setCadError({ cadError: null }));
        dispatch(setCadLoading({ cadLoading: false }));
        dispatch(setCadPending({ cadPending: false }));
        dispatch(setCadOperationType({ cadOperationType: null }));
        dispatch(setCadStatusMessage({ cadStatusMessage: clarification }));
        return;
    }

    // Handle completion: "Task Completed,{task_id},{name},{job_id}"
    if (data.startsWith("Task Completed")) {
        const parts = data.split(",");
        const cadTaskId = parts[1];
        const fileName = parts[2] || "generated";
        const jobId = parts[3];

        try {
            // Fetch presigned glB preview URL from media_service
            const previewResp = await fetch(
                `${process.env.REACT_APP_MEDIA_URL}/step/${jobId}/preview_url`,
                { signal }
            );
            if (!previewResp.ok) {
                throw new Error(`Preview URL request failed: ${previewResp.status}`);
            }
            const { url: presignedUrl } = await previewResp.json();

            if (!presignedUrl) {
                throw new Error('No presigned URL returned from media_service');
            }

            // Fetch the glB binary from MinIO
            const glbResp = await fetch(presignedUrl, { signal });
            if (!glbResp.ok) {
                throw new Error(`glB fetch failed: ${glbResp.status}`);
            }
            const glbBlob = await glbResp.blob();
            if (glbBlob.size === 0) {
                throw new Error('GLB blob is empty — STEP tessellation may have failed');
            }
            const glbFile = new File([glbBlob], `${fileName}.glb`, { type: "model/gltf-binary" });
            const blobUrl = URL.createObjectURL(glbBlob);
            blobUrls.push(blobUrl);

            setActualFile(glbFile);
            dispatch(setFromMeshyOrHistory({ fromMeshyOrHistory: true }));
            dispatch(setFileProperties({
                selectedFile: blobUrl,
                selectedFileType: 'glb',
                fileNameBoxValue: fileName,
                taskId: cadTaskId,
            }));

            // Set step metadata as complete — we're in the "Task Completed" handler
            // so we know processing finished. Metadata fetch enriches with dimensions.
            dispatch(setStepMetadata({
                jobId,
                processingStatus: 'complete',
            }));

            // Fetch CAD metadata (volume, bounding box) from media_service
            try {
                const metaResp = await fetch(
                    `${process.env.REACT_APP_MEDIA_URL}/step/${jobId}/status`,
                    { signal }
                );
                if (metaResp.ok) {
                    const meta = await metaResp.json();
                    dispatch(setStepMetadata({
                        jobId,
                        processingStatus: 'complete',
                        boundingBox: meta.bounding_box_x != null ? {
                            x: meta.bounding_box_x,
                            y: meta.bounding_box_y,
                            z: meta.bounding_box_z,
                        } : undefined,
                        volumeMm3: meta.volume_mm3,
                        surfaceAreaMm2: meta.surface_area_mm2,
                    }));
                    if (meta.volume_mm3) {
                        dispatch(setModelVolume({ modelVolume: meta.volume_mm3 }));
                    }
                    if (meta.bounding_box_x != null) {
                        const THREE = await import('three');
                        dispatch(setModelDimensions({
                            modelDimensions: new THREE.Vector3(
                                meta.bounding_box_x,
                                meta.bounding_box_y,
                                meta.bounding_box_z,
                            ),
                        }));
                    }
                }
            } catch (metaErr) {
                if (!disposed) {
                    logger.warn("Could not fetch CAD metadata:", metaErr);
                }
            }

            // Fetch geometry metadata (features, faces, edges) from api_service
            try {
                const geoResp = await fetch(
                    `${process.env.REACT_APP_API_URL}/tasks/${cadTaskId}/geometry`,
                    { credentials: 'include', signal }
                );
                if (geoResp.ok) {
                    const { features, faces, edges, suppressed } = await geoResp.json();
                    dispatch(setStepMetadata({ features, faces, edges, suppressed }));
                }

                // Fetch version info for undo/redo
                const versionsResp = await fetch(
                    `${process.env.REACT_APP_API_URL}/tasks/${cadTaskId}/versions`,
                    { credentials: 'include', signal }
                );
                if (versionsResp.ok) {
                    const { total } = await versionsResp.json();
                    dispatch(setStepMetadata({ currentVersion: total + 1, totalVersions: total + 1 }));
                }
            } catch (geoErr) {
                if (!disposed) {
                    logger.warn("Could not fetch geometry metadata:", geoErr);
                }
            }
        } catch (err) {
            if (!disposed) {
                logger.error("Error fetching completed CAD file:", err);
            }
        }
        dispatch(setCadLoading({ cadLoading: false }));
        dispatch(setCadPending({ cadPending: false }));
        dispatch(setCadOperationType({ cadOperationType: null }));
        return;
    }

    // Handle progress: "{percentage},{status_message},{name}"
    const parts = data.split(",");
    if (parts.length >= 2) {
        const percentage = parseInt(parts[0], 10);
        const statusMessage = parts[1];

        if (!isNaN(percentage)) {
            dispatch(setCadLoadedPercentage({ cadLoadedPercentage: percentage }));
            dispatch(setCadStatusMessage({ cadStatusMessage: statusMessage }));
            dispatch(setCadLoading({ cadLoading: true }));
        }
    }
}
