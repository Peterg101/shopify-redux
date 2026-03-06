import React, { useEffect, useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Box, CircularProgress } from '@mui/material';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import { fetchFile, extractFileInfo } from '../../services/fetchFileUtils';
import ThumbnailScene from './ThumbnailScene';

interface ModelThumbnailProps {
  taskId: string;
  fileType: string;
  colour: string;
  name: string;
}

const ModelThumbnail = React.memo(({ taskId, fileType, colour, name }: ModelThumbnailProps) => {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let blobUrl: string | null = null;

    const loadFile = async () => {
      try {
        const fileResponse = await fetchFile(taskId);
        if (cancelled) return;
        const fileInfo = extractFileInfo(fileResponse, name);
        blobUrl = fileInfo.fileUrl;
        setFileUrl(blobUrl);
      } catch (err) {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadFile();

    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [taskId, name]);

  if (loading) {
    return (
      <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at center, #1a2230 0%, #0A0E14 100%)' }}>
        <CircularProgress size={32} sx={{ color: 'text.secondary', opacity: 0.6 }} />
      </Box>
    );
  }

  if (error || !fileUrl) {
    return (
      <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ViewInArIcon sx={{ fontSize: 64, color: 'text.secondary', opacity: 0.4 }} />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', height: '100%', background: 'radial-gradient(circle at center, #1a2230 0%, #0A0E14 100%)' }}>
      <Canvas
        frameloop="demand"
        camera={{ fov: 50, near: 0.1, far: 100, position: [3, 2, 3] }}
        style={{ width: '100%', height: '100%' }}
      >
        <Suspense fallback={null}>
          <ThumbnailScene fileUrl={fileUrl} fileType={fileType} colour={colour} />
        </Suspense>
      </Canvas>
    </Box>
  );
});

ModelThumbnail.displayName = 'ModelThumbnail';

export default ModelThumbnail;
