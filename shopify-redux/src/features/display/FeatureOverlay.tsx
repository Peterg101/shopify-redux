import React, { useState, useCallback, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CadFeature, CadFace } from '../../app/utility/interfaces';
import { borderSubtle, borderHover, glowSubtle } from '../../theme';

export type OverlayMode = 'off' | 'features' | 'detailed';

interface FeatureOverlayProps {
  features: CadFeature[];
  faces: CadFace[];
  mode: OverlayMode;
  onTagClick?: (text: string) => void;
  boundingBox?: { x: number; y: number; z: number };
  suppressed?: string[];
}

const featureLabelStyle: React.CSSProperties = {
  background: 'rgba(10, 14, 20, 0.85)',
  border: `1px solid ${borderHover}`,
  borderRadius: 6,
  padding: '4px 8px',
  fontSize: '11px',
  fontFamily: "'Roboto Mono', monospace",
  color: '#00E5FF',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  userSelect: 'none',
  transition: 'all 0.2s ease',
  backdropFilter: 'blur(4px)',
  boxShadow: `0 0 8px ${glowSubtle}`,
  pointerEvents: 'auto' as const,
};

const faceLabelStyle: React.CSSProperties = {
  background: 'rgba(10, 14, 20, 0.7)',
  border: `1px solid ${borderSubtle}`,
  borderRadius: 4,
  padding: '1px 4px',
  fontSize: '8px',
  fontFamily: "'Roboto Mono', monospace",
  color: '#8899AA',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  userSelect: 'none',
  transition: 'all 0.15s ease',
  pointerEvents: 'auto' as const,
};

const dimLabelStyle: React.CSSProperties = {
  background: 'rgba(10, 14, 20, 0.6)',
  borderRadius: 4,
  padding: '2px 6px',
  fontSize: '10px',
  fontFamily: "'Roboto Mono', monospace",
  color: '#8899AA',
  whiteSpace: 'nowrap',
  userSelect: 'none',
};

function formatDimensions(feature: CadFeature): string {
  const dims = feature.dimensions;
  if (!dims) return '';
  if (dims.diameter) return `⌀${dims.diameter}`;
  if (dims.radius) return `R${dims.radius}`;
  if (dims.length && dims.width && dims.height) return `${dims.length}×${dims.width}×${dims.height}`;
  if (dims.length && dims.width) return `${dims.length}×${dims.width}`;
  return '';
}

function faceIcon(faceType: string): string {
  switch (faceType) {
    case 'CYLINDER': return '⊙';
    case 'CONE': return '△';
    case 'SPHERE': return '○';
    case 'TORUS': return '◎';
    default: return '◻';
  }
}

// Screen-space overlap detection — hides labels that are too close in 2D
const MIN_FEATURE_DISTANCE = 60; // pixels between feature labels
const MIN_FACE_DISTANCE = 30;    // pixels between face markers
const FRAME_THROTTLE = 10;       // recompute every N frames

function useVisibleLabels(
  items: { id: string; position: [number, number, number] }[],
  minDistance: number,
) {
  const { camera, size } = useThree();
  const [visibleIds, setVisibleIds] = useState<string[]>(() => items.map(i => i.id));
  const frameCount = useRef(0);
  const vec = useRef(new THREE.Vector3());

  useFrame(() => {
    frameCount.current++;
    if (frameCount.current % FRAME_THROTTLE !== 0) return;
    if (items.length === 0) return;

    const projected: { id: string; x: number; y: number }[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      vec.current.set(item.position[0], item.position[1], item.position[2]);
      vec.current.project(camera);
      projected.push({
        id: item.id,
        x: (vec.current.x * 0.5 + 0.5) * size.width,
        y: (-vec.current.y * 0.5 + 0.5) * size.height,
      });
    }

    // Greedy: keep first non-overlapping label
    const kept: { id: string; x: number; y: number }[] = [];
    for (let i = 0; i < projected.length; i++) {
      const p = projected[i];
      let overlaps = false;
      for (let j = 0; j < kept.length; j++) {
        const dx = p.x - kept[j].x;
        const dy = p.y - kept[j].y;
        if (Math.sqrt(dx * dx + dy * dy) < minDistance) {
          overlaps = true;
          break;
        }
      }
      if (!overlaps) kept.push(p);
    }

    const nextIds = kept.map(k => k.id);
    // Only update state if changed
    if (nextIds.length !== visibleIds.length || nextIds.some((id, i) => visibleIds[i] !== id)) {
      setVisibleIds(nextIds);
    }
  });

  return visibleIds;
}

const FeatureLabel: React.FC<{
  feature: CadFeature;
  onTagClick?: (text: string) => void;
  isSuppressed?: boolean;
}> = ({ feature, onTagClick, isSuppressed }) => {
  const [hovered, setHovered] = useState(false);
  const [inserted, setInserted] = useState(false);

  const dimStr = formatDimensions(feature);
  const label = dimStr ? `${feature.tag} ${dimStr}` : feature.tag;

  const handleClick = useCallback(() => {
    onTagClick?.(feature.tag);
    setInserted(true);
    setTimeout(() => setInserted(false), 600);
  }, [feature.tag, onTagClick]);

  return (
    <Html
      position={feature.position}
      center
      sprite
      distanceFactor={120}
      zIndexRange={[20, 0]}
    >
      <div
        style={{
          ...featureLabelStyle,
          ...(isSuppressed ? {
            borderStyle: 'dashed',
            borderColor: '#667788',
            color: '#667788',
            opacity: 0.5,
            boxShadow: 'none',
            cursor: 'default',
          } : {
            borderColor: inserted ? '#69F0AE' : hovered ? '#00E5FF' : featureLabelStyle.borderColor,
            boxShadow: inserted
              ? '0 0 12px rgba(105, 240, 174, 0.4)'
              : hovered
                ? '0 0 16px rgba(0, 229, 255, 0.4)'
                : featureLabelStyle.boxShadow,
            transform: hovered ? 'scale(1.06)' : 'scale(1)',
          }),
        }}
        title={isSuppressed ? 'Feature suppressed' : 'Click to insert into refinement'}
        onMouseEnter={() => !isSuppressed && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => !isSuppressed && handleClick()}
      >
        {!isSuppressed && hovered && !inserted && <span style={{ opacity: 0.5, marginRight: 3 }}>⊕</span>}
        {!isSuppressed && inserted && <span style={{ color: '#69F0AE', marginRight: 3 }}>✓</span>}
        {isSuppressed && <span style={{ marginRight: 3 }}>⊘</span>}
        {label}
      </div>
    </Html>
  );
};

export const FeatureOverlay: React.FC<FeatureOverlayProps> = ({
  features,
  faces,
  mode,
  onTagClick,
  boundingBox,
  suppressed = [],
}) => {
  const suppressedSet = new Set(suppressed);
  const featureItems = features.map(f => ({ id: f.tag, position: f.position }));
  const faceItems = faces.map(f => ({ id: f.id, position: f.center }));

  const visibleFeatures = useVisibleLabels(featureItems, MIN_FEATURE_DISTANCE);
  const visibleFaces = useVisibleLabels(faceItems, MIN_FACE_DISTANCE);

  if (mode === 'off') return null;

  return (
    <group>
      {/* Feature tags — always shown in features/detailed mode */}
      {features.map((f) => (
        visibleFeatures.includes(f.tag) && (
          <FeatureLabel key={f.tag} feature={f} onTagClick={onTagClick} isSuppressed={suppressedSet.has(f.tag)} />
        )
      ))}

      {/* Face markers — only in detailed mode */}
      {mode === 'detailed' && faces.map((f) => (
        visibleFaces.includes(f.id) && (
          <Html
            key={f.id}
            position={f.center}
            center
            sprite
            distanceFactor={300}
            zIndexRange={[10, 0]}
          >
            <div
              style={faceLabelStyle}
              title="Click to insert face reference"
              onClick={() => onTagClick?.(`${f.type.toLowerCase()} face at (${f.center.join(', ')})`)}
            >
              {faceIcon(f.type)} {f.id}
            </div>
          </Html>
        )
      ))}

      {/* Bounding box dimension labels */}
      {boundingBox && (
        <>
          <Html position={[boundingBox.x / 2, 0, 0]} center sprite distanceFactor={180} zIndexRange={[5, 0]}>
            <div style={dimLabelStyle}>{boundingBox.x.toFixed(1)}mm</div>
          </Html>
          <Html position={[0, boundingBox.y / 2, 0]} center sprite distanceFactor={180} zIndexRange={[5, 0]}>
            <div style={dimLabelStyle}>{boundingBox.y.toFixed(1)}mm</div>
          </Html>
          <Html position={[0, 0, boundingBox.z / 2]} center sprite distanceFactor={180} zIndexRange={[5, 0]}>
            <div style={dimLabelStyle}>{boundingBox.z.toFixed(1)}mm</div>
          </Html>
        </>
      )}
    </group>
  );
};
