import { AppDispatch } from "../app/store";
import { authApi } from "./authApi";
import logger from '../app/utility/logger';
import { setCadLoadedPercentage, setCadLoading, setCadPending, setCadStatusMessage, setCadError, setCadOperationType } from "./cadSlice";
import { setFileProperties, setAutoScaleOnLoad, setStepMetadata, setModelVolume, setModelDimensions } from "./dataSlice";

const RECONNECT_DELAY = 3000;
const STALE_THRESHOLD_MS = 30000;

export function connectProgressStream(
    portId: string,
    dispatch: AppDispatch,
    setActualFile: React.Dispatch<React.SetStateAction<File | null>>,
): () => void {
    let disposed = false;
    let taskTerminated = false;
    let reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let currentAbort: AbortController | null = null;
    let lastActivityAt = Date.now();
    const blobUrls: string[] = [];
    let isFirstMessage = true;

    const cleanup = () => {
        disposed = true;
        if (reconnectTimeoutId !== null) {
            clearTimeout(reconnectTimeoutId);
            reconnectTimeoutId = null;
        }
        currentAbort?.abort();
        document.removeEventListener('visibilitychange', handleVisibility);
        blobUrls.forEach(url => URL.revokeObjectURL(url));
        blobUrls.length = 0;
    };

    const handleVisibility = () => {
        if (document.visibilityState !== 'visible') return;
        if (disposed || taskTerminated) return;

        // If a reconnect is pending, fire it now rather than wait for throttled setTimeout.
        if (reconnectTimeoutId !== null) {
            clearTimeout(reconnectTimeoutId);
            reconnectTimeoutId = null;
            isFirstMessage = true;
            connect();
            return;
        }

        // If the active stream has been silent for too long, assume it's dead and restart.
        if (Date.now() - lastActivityAt > STALE_THRESHOLD_MS) {
            currentAbort?.abort();
            isFirstMessage = true;
            connect();
        }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    const connect = async () => {
        if (disposed || taskTerminated) return;

        currentAbort = new AbortController();
        const signal = currentAbort.signal;
        lastActivityAt = Date.now();

        try {
            const response = await fetch(
                `${process.env.REACT_APP_GENERATION_URL}/progress/${portId}`,
                { signal }
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

                lastActivityAt = Date.now();
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data:')) continue;
                    const data = line.slice(5).trim();
                    if (!data) continue;

                    if (isFirstMessage) {
                        dispatch(authApi.util.invalidateTags([{ type: 'sessionData' }]));
                        isFirstMessage = false;
                    }

                    await handleCadMessage(data, dispatch, setActualFile, signal, blobUrls, disposed);

                    if (data.startsWith('Task Completed') || data.startsWith('Task Failed')) {
                        taskTerminated = true;
                        document.removeEventListener('visibilitychange', handleVisibility);
                    }
                }
            }
        } catch (err: any) {
            if (disposed || err?.name === 'AbortError') return;
            logger.error(`SSE cad error:`, err);
        }

        if (!disposed && !taskTerminated) {
            dispatch(setCadLoading({ cadLoading: false }));
            dispatch(authApi.util.invalidateTags([{ type: 'sessionData' }]));

            reconnectTimeoutId = setTimeout(() => {
                reconnectTimeoutId = null;
                isFirstMessage = true;
                connect();
            }, RECONNECT_DELAY);
        }
    };

    connect();
    return cleanup;
}

async function handleCadMessage(
    data: string,
    dispatch: AppDispatch,
    setActualFile: React.Dispatch<React.SetStateAction<File | null>>,
    signal: AbortSignal,
    blobUrls: string[],
    disposed: boolean,
) {
    if (data.startsWith("Task Failed")) {
        const errorMsg = data.replace("Task Failed,", "");
        dispatch(setCadError({ cadError: errorMsg }));
        dispatch(setCadLoading({ cadLoading: false }));
        dispatch(setCadPending({ cadPending: false }));
        dispatch(setCadOperationType({ cadOperationType: null }));
        return;
    }

    if (data.startsWith("Refinement Rejected,")) {
        const reason = data.substring("Refinement Rejected,".length);
        dispatch(setCadError({ cadError: `Refinement rejected: ${reason}` }));
        dispatch(setCadLoading({ cadLoading: false }));
        dispatch(setCadPending({ cadPending: false }));
        dispatch(setCadOperationType({ cadOperationType: null }));
        return;
    }

    if (data.startsWith("Clarification Needed,")) {
        const clarification = data.substring("Clarification Needed,".length);
        dispatch(setCadError({ cadError: null }));
        dispatch(setCadLoading({ cadLoading: false }));
        dispatch(setCadPending({ cadPending: false }));
        dispatch(setCadOperationType({ cadOperationType: null }));
        dispatch(setCadStatusMessage({ cadStatusMessage: clarification }));
        return;
    }

    if (data.startsWith("Task Completed")) {
        const parts = data.split(",");
        const cadTaskId = parts[1];
        const fileName = parts[2] || "generated";
        const jobId = parts[3];

        try {
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
            dispatch(setAutoScaleOnLoad({ autoScaleOnLoad: true }));
            dispatch(setFileProperties({
                selectedFile: blobUrl,
                selectedFileType: 'glb',
                fileNameBoxValue: fileName,
                taskId: cadTaskId,
            }));

            dispatch(setStepMetadata({
                jobId,
                processingStatus: 'complete',
            }));

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

            try {
                const geoResp = await fetch(
                    `${process.env.REACT_APP_API_URL}/tasks/${cadTaskId}/geometry`,
                    { credentials: 'include', signal }
                );
                if (geoResp.ok) {
                    const { features, faces, edges, suppressed } = await geoResp.json();
                    dispatch(setStepMetadata({ features, faces, edges, suppressed }));
                }

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
