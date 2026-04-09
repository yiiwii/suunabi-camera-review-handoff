import { useEffect, useRef, useState } from 'react';
import { IOS_SAFE_AREA_BOTTOM, IOS_SAFE_AREA_TOP } from './device';
import imgUsabilityTestSheet from '../assets/usability-test-question-sheet.jpeg';

const CAMERA_H = 559;
const CAMERA_W = 375;
const MIN_SIZE = 72;
const BRAND_BLUE = '#339bc9';

interface Region {
  id: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

interface Interaction {
  type: 'drag' | 'resize';
  id: number;
  handle?: ResizeHandle;
  startClientX: number;
  startClientY: number;
  startRegion: Region;
}

const INITIAL_REGION: Region = {
  id: 1,
  left: Math.round((CAMERA_W - 320) / 2),
  top: Math.round((CAMERA_H - 120) / 2),
  width: 320,
  height: 120,
};

let nextId = 2;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function overlaps(a: Region, b: Region): boolean {
  return (
    a.left < b.left + b.width &&
    a.left + a.width > b.left &&
    a.top < b.top + b.height &&
    a.top + a.height > b.top
  );
}

function overlapsAny(region: Region, regions: Region[], ignoreId?: number): boolean {
  return regions.some((other) => other.id !== ignoreId && overlaps(region, other));
}

function isWithinBounds(region: Region): boolean {
  return (
    region.left >= 0 &&
    region.top >= 0 &&
    region.left + region.width <= CAMERA_W &&
    region.top + region.height <= CAMERA_H
  );
}

function compareCandidate(a: Region, b: Region, targetLeft: number, targetTop: number): number {
  const aDx = a.left - targetLeft;
  const aDy = a.top - targetTop;
  const bDx = b.left - targetLeft;
  const bDy = b.top - targetTop;
  const aDist = aDx * aDx + aDy * aDy;
  const bDist = bDx * bDx + bDy * bDy;

  if (aDist !== bDist) return aDist - bDist;
  if (Math.abs(aDy) !== Math.abs(bDy)) return Math.abs(aDy) - Math.abs(bDy);
  if (Math.abs(aDx) !== Math.abs(bDx)) return Math.abs(aDx) - Math.abs(bDx);
  if (a.top !== b.top) return a.top - b.top;
  return a.left - b.left;
}

function overlapsHorizontally(a: Region, b: Region): boolean {
  return a.left < b.left + b.width && a.left + a.width > b.left;
}

function overlapsVertically(a: Region, b: Region): boolean {
  return a.top < b.top + b.height && a.top + a.height > b.top;
}

function findNearestValidPlacement(region: Region, regions: Region[]): Region | null {
  let best: Region | null = null;
  const maxLeft = CAMERA_W - region.width;
  const maxTop = CAMERA_H - region.height;

  for (let top = 0; top <= maxTop; top += 1) {
    for (let left = 0; left <= maxLeft; left += 1) {
      const candidate = { ...region, left, top };
      if (overlapsAny(candidate, regions, region.id)) continue;
      if (!best || compareCandidate(candidate, best, region.left, region.top) < 0) {
        best = candidate;
      }
    }
  }

  return best;
}

function findNearestEdgePlacement(region: Region, regions: Region[]): Region | null {
  const maxLeft = CAMERA_W - region.width;
  const maxTop = CAMERA_H - region.height;
  const candidates: Region[] = [];
  const seen = new Set<string>();

  const addCandidate = (left: number, top: number) => {
    if (left < 0 || top < 0 || left > maxLeft || top > maxTop) return;
    const key = `${left}:${top}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ ...region, left, top });
  };

  for (const other of regions) {
    if (other.id === region.id) continue;
    if (!overlaps(region, other)) continue;

    addCandidate(other.left - region.width, region.top);
    addCandidate(other.left + other.width, region.top);
    addCandidate(region.left, other.top - region.height);
    addCandidate(region.left, other.top + other.height);
  }

  let best: Region | null = null;
  for (const candidate of candidates) {
    if (overlapsAny(candidate, regions, region.id)) continue;
    if (!best || compareCandidate(candidate, best, region.left, region.top) < 0) {
      best = candidate;
    }
  }

  return best;
}

function resolveDragRelease(region: Region, regions: Region[], start: Region): Region {
  if (isWithinBounds(region) && !overlapsAny(region, regions, region.id)) {
    return region;
  }

  const dx = region.left - start.left;
  const dy = region.top - start.top;
  const horizontalPreferred = Math.abs(dx) >= Math.abs(dy);
  const candidates: Region[] = [];
  const addCandidate = (left: number, top: number) => {
    const candidate: Region = {
      ...region,
      left: clamp(left, 0, CAMERA_W - region.width),
      top: clamp(top, 0, CAMERA_H - region.height),
    };
    if (!overlapsAny(candidate, regions, region.id)) {
      candidates.push(candidate);
    }
  };

  for (const other of regions) {
    if (other.id === region.id) continue;
    if (horizontalPreferred && overlapsVertically(region, other)) {
      const regionCenter = region.left + region.width / 2;
      const otherCenter = other.left + other.width / 2;
      const touchLeft = regionCenter <= otherCenter ? other.left - region.width : other.left + other.width;
      addCandidate(touchLeft, region.top);
    }
    if (!horizontalPreferred && overlapsHorizontally(region, other)) {
      const regionCenter = region.top + region.height / 2;
      const otherCenter = other.top + other.height / 2;
      const touchTop = regionCenter <= otherCenter ? other.top - region.height : other.top + other.height;
      addCandidate(region.left, touchTop);
    }
  }

  if (!candidates.length) {
    for (const other of regions) {
      if (other.id === region.id) continue;
      if (!horizontalPreferred && overlapsHorizontally(region, other)) {
        const regionCenter = region.top + region.height / 2;
        const otherCenter = other.top + other.height / 2;
        const touchTop = regionCenter <= otherCenter ? other.top - region.height : other.top + other.height;
        addCandidate(region.left, touchTop);
      }
      if (horizontalPreferred && overlapsVertically(region, other)) {
        const regionCenter = region.left + region.width / 2;
        const otherCenter = other.left + other.width / 2;
        const touchLeft = regionCenter <= otherCenter ? other.left - region.width : other.left + other.width;
        addCandidate(touchLeft, region.top);
      }
    }
  }

  if (!candidates.length) return region;
  candidates.sort((a, b) => compareCandidate(a, b, region.left, region.top));
  return candidates[0];
}

function resolveResizeRelease(region: Region, regions: Region[], start: Region, handle: ResizeHandle): Region {
  if (isWithinBounds(region) && !overlapsAny(region, regions, region.id)) {
    return region;
  }

  const candidates: Region[] = [];
  const addCandidate = (left: number, top: number, width: number, height: number) => {
    const candidate: Region = {
      ...region,
      left: clamp(left, 0, CAMERA_W - MIN_SIZE),
      top: clamp(top, 0, CAMERA_H - MIN_SIZE),
      width: clamp(width, MIN_SIZE, CAMERA_W - left),
      height: clamp(height, MIN_SIZE, CAMERA_H - top),
    };
    if (!overlapsAny(candidate, regions, region.id)) {
      candidates.push(candidate);
    }
  };

  for (const other of regions) {
    if (other.id === region.id) continue;
    const regionCenterX = region.left + region.width / 2;
    const regionCenterY = region.top + region.height / 2;
    const otherCenterX = other.left + other.width / 2;
    const otherCenterY = other.top + other.height / 2;

    if ((handle === 'se' || handle === 'ne') && overlapsVertically(region, other)) {
      const touchRight = regionCenterX <= otherCenterX ? other.left : other.left + other.width;
      addCandidate(region.left, region.top, touchRight - region.left, region.height);
    }
    if ((handle === 'sw' || handle === 'nw') && overlapsVertically(region, other)) {
      const touchLeft = regionCenterX <= otherCenterX ? other.left - region.width : other.left + other.width;
      addCandidate(touchLeft, region.top, region.left + region.width - touchLeft, region.height);
    }
    if ((handle === 'se' || handle === 'sw') && overlapsHorizontally(region, other)) {
      const touchBottom = regionCenterY <= otherCenterY ? other.top : other.top + other.height;
      addCandidate(region.left, region.top, region.width, touchBottom - region.top);
    }
    if ((handle === 'ne' || handle === 'nw') && overlapsHorizontally(region, other)) {
      const touchTop = regionCenterY <= otherCenterY ? other.top - region.height : other.top + other.height;
      addCandidate(region.left, touchTop, region.width, region.top + region.height - touchTop);
    }
  }

  if (!candidates.length) return region;
  candidates.sort((a, b) => compareCandidate(a, b, region.left, region.top));
  return candidates[0];
}

function resolveRegionRelease(region: Region, regions: Region[], interaction: Interaction): Region {
  if (interaction.type === 'resize' && interaction.handle) {
    return resolveResizeRelease(region, regions, interaction.startRegion, interaction.handle);
  }

  return resolveDragRelease(region, regions, interaction.startRegion);
}

function resolveLiveDrag(region: Region, start: Region, regions: Region[], ignoreId: number, dx: number, dy: number): Region {
  const maxLeft = CAMERA_W - region.width;
  const maxTop = CAMERA_H - region.height;
  let left = clamp(region.left, 0, maxLeft);
  let top = clamp(region.top, 0, maxTop);

  if (dx > 0) {
    let limit = maxLeft;
    const probe = { ...region, left, top };
    for (const other of regions) {
      if (other.id === ignoreId) continue;
      if (!overlapsVertically(probe, other)) continue;
      if (other.left < start.left + start.width) continue;
      limit = Math.min(limit, other.left - region.width);
    }
    left = Math.min(left, limit);
  } else if (dx < 0) {
    let limit = 0;
    const probe = { ...region, left, top };
    for (const other of regions) {
      if (other.id === ignoreId) continue;
      if (!overlapsVertically(probe, other)) continue;
      if (other.left + other.width > start.left) continue;
      limit = Math.max(limit, other.left + other.width);
    }
    left = Math.max(left, limit);
  }

  const horizontalProbe = { ...region, left, top };
  if (dy > 0) {
    let limit = maxTop;
    for (const other of regions) {
      if (other.id === ignoreId) continue;
      if (!overlapsHorizontally(horizontalProbe, other)) continue;
      if (other.top < start.top + start.height) continue;
      limit = Math.min(limit, other.top - region.height);
    }
    top = Math.min(top, limit);
  } else if (dy < 0) {
    let limit = 0;
    for (const other of regions) {
      if (other.id === ignoreId) continue;
      if (!overlapsHorizontally(horizontalProbe, other)) continue;
      if (other.top + other.height > start.top) continue;
      limit = Math.max(limit, other.top + other.height);
    }
    top = Math.max(top, limit);
  }

  return {
    ...region,
    left: clamp(left, 0, maxLeft),
    top: clamp(top, 0, maxTop),
  };
}

function resolveLiveResize(
  region: Region,
  start: Region,
  regions: Region[],
  ignoreId: number,
  handle: ResizeHandle,
): Region {
  let left = region.left;
  let top = region.top;
  let width = region.width;
  let height = region.height;
  const rightFixed = start.left + start.width;
  const bottomFixed = start.top + start.height;

  if (handle === 'se' || handle === 'sw') {
    const verticalProbe = { ...region, left, top, width, height };
    let boundary = handle === 'se' ? CAMERA_W : 0;
    for (const other of regions) {
      if (other.id === ignoreId) continue;
      if (!overlapsVertically(verticalProbe, other)) continue;
      if (handle === 'se') {
        if (other.left < rightFixed) continue;
        boundary = Math.min(boundary, other.left);
      } else {
        if (other.left + other.width > start.left) continue;
        boundary = Math.max(boundary, other.left + other.width);
      }
    }
    if (handle === 'se') {
      width = Math.min(width, boundary - left);
    } else {
      left = Math.max(left, boundary);
      width = rightFixed - left;
    }
  }

  if (handle === 'se' || handle === 'ne') {
    const horizontalProbe = { ...region, left, top, width, height };
    let boundary = handle === 'se' ? CAMERA_H : 0;
    for (const other of regions) {
      if (other.id === ignoreId) continue;
      if (!overlapsHorizontally(horizontalProbe, other)) continue;
      if (handle === 'se') {
        if (other.top < bottomFixed) continue;
        boundary = Math.min(boundary, other.top);
      } else {
        if (other.top + other.height > start.top) continue;
        boundary = Math.max(boundary, other.top + other.height);
      }
    }
    if (handle === 'se') {
      height = Math.min(height, boundary - top);
    } else {
      top = Math.max(top, boundary);
      height = bottomFixed - top;
    }
  }

  if (handle === 'nw' || handle === 'ne') {
    const verticalProbe = { ...region, left, top, width, height };
    let boundary = handle === 'nw' ? 0 : CAMERA_W;
    for (const other of regions) {
      if (other.id === ignoreId) continue;
      if (!overlapsVertically(verticalProbe, other)) continue;
      if (handle === 'nw') {
        if (other.left + other.width > start.left) continue;
        boundary = Math.max(boundary, other.left + other.width);
      } else {
        if (other.left < rightFixed) continue;
        boundary = Math.min(boundary, other.left);
      }
    }
    if (handle === 'nw') {
      left = Math.max(left, boundary);
      width = rightFixed - left;
    } else {
      width = Math.min(width, boundary - left);
    }
  }

  if (handle === 'nw' || handle === 'sw') {
    const horizontalProbe = { ...region, left, top, width, height };
    let boundary = handle === 'nw' ? 0 : CAMERA_H;
    for (const other of regions) {
      if (other.id === ignoreId) continue;
      if (!overlapsHorizontally(horizontalProbe, other)) continue;
      if (handle === 'nw') {
        if (other.top + other.height > start.top) continue;
        boundary = Math.max(boundary, other.top + other.height);
      } else {
        if (other.top < bottomFixed) continue;
        boundary = Math.min(boundary, other.top);
      }
    }
    if (handle === 'nw') {
      top = Math.max(top, boundary);
      height = bottomFixed - top;
    } else {
      height = Math.min(height, boundary - top);
    }
  }

  return {
    ...region,
    left: clamp(left, 0, CAMERA_W - width),
    top: clamp(top, 0, CAMERA_H - height),
    width: clamp(width, MIN_SIZE, CAMERA_W - left),
    height: clamp(height, MIN_SIZE, CAMERA_H - top),
  };
}

function createNextRegion(regions: Region[]): Region | null {
  const w = 120;
  const h = 120;
  const left = Math.round((CAMERA_W - w) / 2);
  const top = Math.round((CAMERA_H - h) / 2);
  const candidate: Region = { id: nextId++, left, top, width: w, height: h };
  const resolved = overlapsAny(candidate, regions) ? findNearestValidPlacement(candidate, regions) : candidate;
  return resolved ? { ...resolved, id: candidate.id } : null;
}

function roundedRectPath(x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  return [
    `M ${x + r} ${y}`,
    `H ${x + width - r}`,
    `A ${r} ${r} 0 0 1 ${x + width} ${y + r}`,
    `V ${y + height - r}`,
    `A ${r} ${r} 0 0 1 ${x + width - r} ${y + height}`,
    `H ${x + r}`,
    `A ${r} ${r} 0 0 1 ${x} ${y + height - r}`,
    `V ${y + r}`,
    `A ${r} ${r} 0 0 1 ${x + r} ${y}`,
    'Z',
  ].join(' ');
}

function buildCutoutPath(regions: Region[]) {
  const paths = [`M 0 0 H ${CAMERA_W} V ${CAMERA_H} H 0 Z`];
  for (const region of regions) {
    paths.push(roundedRectPath(region.left, region.top, region.width, region.height, 20));
  }
  return paths.join(' ');
}

function CutoutOverlay({ regions }: { regions: Region[] }) {
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 h-full w-full pointer-events-none"
      viewBox={`0 0 ${CAMERA_W} ${CAMERA_H}`}
      preserveAspectRatio="none"
    >
      <path d={buildCutoutPath(regions)} fill="rgba(13,14,18,0.6)" fillRule="evenodd" />
      {regions.map((region) => (
        <rect
          key={region.id}
          x={region.left}
          y={region.top}
          width={region.width}
          height={region.height}
          rx={20}
          ry={20}
          fill="rgba(13,14,18,0.2)"
        />
      ))}
    </svg>
  );
}

function CornerStroke({ color, style }: { color: string; style: React.CSSProperties }) {
  return (
    <svg
      aria-hidden="true"
      className="absolute pointer-events-none"
      style={style}
      width="43"
      height="43"
      viewBox="0 0 46 46"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M44.5 1.5H21.5C10.4543 1.5 1.5 10.4543 1.5 21.5V44.5"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CornerBrackets({ active }: { active: boolean }) {
  const size = 43;
  const off = -1.5;
  const color = active ? BRAND_BLUE : '#ffffff';

  return (
    <>
      <CornerStroke color={color} style={{ left: off, top: off, width: size, height: size }} />
      <CornerStroke color={color} style={{ right: off, top: off, width: size, height: size, transform: 'rotate(180deg) scaleY(-1)', transformOrigin: 'center' }} />
      <CornerStroke color={color} style={{ left: off, bottom: off, width: size, height: size, transform: 'scaleY(-1)', transformOrigin: 'center' }} />
      <CornerStroke color={color} style={{ right: off, bottom: off, width: size, height: size, transform: 'rotate(180deg)', transformOrigin: 'center' }} />
    </>
  );
}

function ReviewToast({ message }: { message: string }) {
  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center pointer-events-none">
      <div
        className="rounded-[8px] bg-[rgba(13,14,18,0.8)] px-[20px] py-[12px] text-center backdrop-blur-[25px]"
        style={{ animation: 'toast-in-out 2.5s ease both', maxWidth: 280 }}
      >
        <p className="font-['Hiragino_Sans',sans-serif] whitespace-pre-line text-[16px] leading-normal text-white">
          {message}
        </p>
      </div>
    </div>
  );
}

function QuestionRegion({
  region,
  index,
  active,
  snapping,
  showRemove,
  showHitAreas,
  onRemove,
  onDragStart,
  onResizeStart,
}: {
  region: Region;
  index: number;
  active: boolean;
  snapping: boolean;
  showRemove: boolean;
  showHitAreas: boolean;
  onRemove: () => void;
  onDragStart: (e: React.PointerEvent) => void;
  onResizeStart: (e: React.PointerEvent, handle: ResizeHandle) => void;
}) {
  const HANDLE = 36;
  const HANDLE_TOP_RIGHT = 28;
  const CLOSE_SIZE = 32;
  const isWideFrame = region.width / region.height >= 1.8;
  const dragSideInset = Math.max(16, Math.min(24, Math.round(region.width * 0.08)));
  const dragTopInset = Math.max(40, Math.min(52, Math.round(region.height * 0.28)));
  const dragBottomInset = Math.max(16, Math.min(22, Math.round(region.height * 0.12)));
  const dragWidth = Math.max(56, region.width - dragSideInset * 2);
  const dragHeight = Math.max(28, region.height - dragTopInset - dragBottomInset);
  const dragTop = dragTopInset;
  const topBandLeft = 74;
  const topBandRight = 62;
  const topBandTop = 12;
  const topBandHeight = 26;
  const topBandWidth = Math.max(48, region.width - topBandLeft - topBandRight);

  return (
    <div
      className="absolute touch-none select-none"
      style={{
        left: region.left,
        top: region.top,
        width: region.width,
        height: region.height,
        transition: active ? 'none' : snapping ? 'left 120ms ease-out, top 120ms ease-out' : 'none',
      }}
    >
      <div
        className="absolute rounded-[16px]"
        style={{ left: '50%', width: dragWidth, height: dragHeight, top: dragTop, cursor: 'grab', transform: 'translateX(-50%)' }}
        onPointerDown={onDragStart}
      />
      {isWideFrame && (
        <div
          className="absolute rounded-[14px]"
          style={{ left: topBandLeft, width: topBandWidth, top: topBandTop, height: topBandHeight, cursor: 'grab' }}
          onPointerDown={onDragStart}
        />
      )}
      {showHitAreas && (
        <div
          className="absolute rounded-[16px] border border-[rgba(52,199,89,0.9)] bg-[rgba(52,199,89,0.22)] pointer-events-none"
          style={{ left: '50%', width: dragWidth, height: dragHeight, top: dragTop, transform: 'translateX(-50%)' }}
        />
      )}
      {showHitAreas && isWideFrame && (
        <div
          className="absolute rounded-[14px] border border-[rgba(52,199,89,0.9)] bg-[rgba(52,199,89,0.22)] pointer-events-none"
          style={{ left: topBandLeft, width: topBandWidth, top: topBandTop, height: topBandHeight }}
        />
      )}

      <CornerBrackets active={active} />

      <div className="absolute flex items-center justify-center rounded-full px-[10px] pointer-events-none" style={{ background: '#339bc9', height: 20, left: 8, top: 8 }}>
        <span className="font-['Rco',sans-serif] text-[12px] leading-none" style={{ color: '#ffffff' }}>
          Q{index + 1}
        </span>
      </div>

      {showRemove && (
        <button onPointerDown={(e) => e.stopPropagation()} onClick={onRemove} className="absolute" style={{ width: CLOSE_SIZE, height: CLOSE_SIZE, right: 8, top: 8 }}>
          <span className="absolute right-[2px] top-[2px] flex items-center justify-center rounded-full font-['Rco',sans-serif] text-[11px] leading-none text-white" style={{ background: 'rgba(13,14,18,0.6)', width: 20, height: 20 }}>
            {'\uE92A'}
          </span>
        </button>
      )}
      {showRemove && showHitAreas && (
        <div className="absolute rounded-full border border-[rgba(255,59,48,0.95)] bg-[rgba(255,59,48,0.24)] pointer-events-none" style={{ width: CLOSE_SIZE, height: CLOSE_SIZE, right: 8, top: 8 }} />
      )}

      <div className="absolute" style={{ left: -HANDLE / 2, top: -HANDLE / 2, width: HANDLE, height: HANDLE, cursor: 'nw-resize' }} onPointerDown={(e) => { e.stopPropagation(); onResizeStart(e, 'nw'); }} />
      <div className="absolute" style={{ right: -(HANDLE_TOP_RIGHT / 2) - 10, top: -(HANDLE_TOP_RIGHT / 2) - 10, width: HANDLE_TOP_RIGHT, height: HANDLE_TOP_RIGHT, cursor: 'ne-resize' }} onPointerDown={(e) => { e.stopPropagation(); onResizeStart(e, 'ne'); }} />
      <div className="absolute" style={{ left: -HANDLE / 2, bottom: -HANDLE / 2, width: HANDLE, height: HANDLE, cursor: 'sw-resize' }} onPointerDown={(e) => { e.stopPropagation(); onResizeStart(e, 'sw'); }} />
      <div className="absolute" style={{ right: -HANDLE / 2, bottom: -HANDLE / 2, width: HANDLE, height: HANDLE, cursor: 'se-resize' }} onPointerDown={(e) => { e.stopPropagation(); onResizeStart(e, 'se'); }} />

      {showHitAreas && (
        <>
          <div className="absolute border border-[rgba(10,132,255,0.95)] bg-[rgba(10,132,255,0.24)] pointer-events-none" style={{ left: -HANDLE / 2, top: -HANDLE / 2, width: HANDLE, height: HANDLE }} />
          <div className="absolute border border-[rgba(10,132,255,0.95)] bg-[rgba(10,132,255,0.24)] pointer-events-none" style={{ right: -(HANDLE_TOP_RIGHT / 2) - 10, top: -(HANDLE_TOP_RIGHT / 2) - 10, width: HANDLE_TOP_RIGHT, height: HANDLE_TOP_RIGHT }} />
          <div className="absolute border border-[rgba(10,132,255,0.95)] bg-[rgba(10,132,255,0.24)] pointer-events-none" style={{ left: -HANDLE / 2, bottom: -HANDLE / 2, width: HANDLE, height: HANDLE }} />
          <div className="absolute border border-[rgba(10,132,255,0.95)] bg-[rgba(10,132,255,0.24)] pointer-events-none" style={{ right: -HANDLE / 2, bottom: -HANDLE / 2, width: HANDLE, height: HANDLE }} />
        </>
      )}
    </div>
  );
}

export function CameraReviewScreen({ showHitAreas }: { showHitAreas: boolean }) {
  const [regions, setRegions] = useState<Region[]>([INITIAL_REGION]);
  const [activeRegionId, setActiveRegionId] = useState<number | null>(null);
  const [snappingRegionIds, setSnappingRegionIds] = useState<Set<number>>(() => new Set());
  const [toast, setToast] = useState<{ key: number; message: string } | null>(null);
  const interactionRef = useRef<Interaction | null>(null);
  const regionsRef = useRef<Region[]>([INITIAL_REGION]);

  const isSingle = regions.length === 1;

  useEffect(() => {
    regionsRef.current = regions;
  }, [regions]);

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const ia = interactionRef.current;
      if (!ia) return;
      const dx = e.clientX - ia.startClientX;
      const dy = e.clientY - ia.startClientY;
      const s = ia.startRegion;

      setRegions((prev) =>
        prev.map((r) => {
          if (r.id !== ia.id) return r;
          if (ia.type === 'drag') {
            return {
              ...r,
              left: clamp(s.left + dx, 0, CAMERA_W - s.width),
              top: clamp(s.top + dy, 0, CAMERA_H - s.height),
            };
          }

          let { left, top, width, height } = s;
          const h = ia.handle!;
          if (h === 'se') {
            width = clamp(s.width + dx, MIN_SIZE, CAMERA_W - s.left);
            height = clamp(s.height + dy, MIN_SIZE, CAMERA_H - s.top);
          } else if (h === 'sw') {
            width = clamp(s.width - dx, MIN_SIZE, s.left + s.width);
            left = s.left + s.width - width;
            height = clamp(s.height + dy, MIN_SIZE, CAMERA_H - s.top);
          } else if (h === 'ne') {
            width = clamp(s.width + dx, MIN_SIZE, CAMERA_W - s.left);
            height = clamp(s.height - dy, MIN_SIZE, s.top + s.height);
            top = clamp(s.top + s.height - height, 0, CAMERA_H - MIN_SIZE);
            height = s.top + s.height - top;
          } else if (h === 'nw') {
            width = clamp(s.width - dx, MIN_SIZE, s.left + s.width);
            left = s.left + s.width - width;
            height = clamp(s.height - dy, MIN_SIZE, s.top + s.height);
            top = clamp(s.top + s.height - height, 0, CAMERA_H - MIN_SIZE);
            height = s.top + s.height - top;
          }

          return { ...r, left, top, width, height };
        }),
      );
    }

    function onUp() {
      const ia = interactionRef.current;
      if (ia) {
        const currentRegions = regionsRef.current;
        const nextRegions = currentRegions.map((region) => {
          if (region.id !== ia.id) return region;
          return resolveRegionRelease(region, currentRegions, ia);
        });
        setRegions(nextRegions);

        const currentRegion = currentRegions.find((region) => region.id === ia.id);
        const resolvedRegion = nextRegions.find((region) => region.id === ia.id);
        const wasSnapped = Boolean(currentRegion && resolvedRegion && (currentRegion.left !== resolvedRegion.left || currentRegion.top !== resolvedRegion.top));
        if (wasSnapped) {
          setSnappingRegionIds((prev) => new Set(prev).add(ia.id));
          setTimeout(() => {
            setSnappingRegionIds((prev) => {
              const nextIds = new Set(prev);
              nextIds.delete(ia.id);
              return nextIds;
            });
          }, 120);
        }
      }
      interactionRef.current = null;
      setActiveRegionId(null);
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  function startDrag(e: React.PointerEvent, id: number) {
    e.preventDefault();
    const region = regions.find((r) => r.id === id)!;
    setActiveRegionId(id);
    interactionRef.current = {
      type: 'drag',
      id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startRegion: { ...region },
    };
  }

  function startResize(e: React.PointerEvent, id: number, handle: ResizeHandle) {
    e.preventDefault();
    const region = regions.find((r) => r.id === id)!;
    setActiveRegionId(id);
    interactionRef.current = {
      type: 'resize',
      id,
      handle,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startRegion: { ...region },
    };
  }

  function showToast(message: string) {
    setToast({ key: Date.now(), message });
    setTimeout(() => setToast(null), 2500);
  }

  function handleAddRegion() {
    const next = createNextRegion(regions);
    if (!next) {
      showToast('これ以上の問題枠を追加できません');
      return;
    }
    setRegions((prev) => [...prev, next]);
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-white">
      <div className="absolute inset-x-0 top-0 overflow-hidden" style={{ height: CAMERA_H }}>
        <img
          src={imgUsabilityTestSheet}
          alt="Usability test question sheet"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: 'center center' }}
        />
        <CutoutOverlay regions={regions} />

        {regions.map((r, i) => (
          <QuestionRegion
            key={r.id}
            region={r}
            index={i}
            active={activeRegionId === r.id}
            snapping={snappingRegionIds.has(r.id)}
            showRemove={regions.length > 1}
            showHitAreas={showHitAreas}
            onRemove={() => setRegions((prev) => prev.filter((item) => item.id !== r.id))}
            onDragStart={(e) => startDrag(e, r.id)}
            onResizeStart={(e, handle) => startResize(e, r.id, handle)}
          />
        ))}

      </div>

      <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center px-[10px]" style={{ top: IOS_SAFE_AREA_TOP + 4, height: 56 }}>
        <button className="pointer-events-auto flex h-[40px] w-[40px] items-center justify-center rounded-full">
          <span className="font-['Rco',sans-serif] text-[24px] leading-none tracking-[0.48px] text-white">{'\uE902'}</span>
        </button>
      </div>

      <div className="absolute inset-x-0 bottom-0 bg-white px-[20px]" style={{ top: CAMERA_H, paddingBottom: IOS_SAFE_AREA_BOTTOM + 10 }}>
        <div className="absolute left-[20px] right-[20px] top-[10px]">
          <p className="truncate font-['Hiragino_Sans',sans-serif] text-[14px] leading-none text-center" style={{ color: 'rgba(13,14,18,0.6)' }}>
            {'1枠につき1問'}
          </p>
        </div>

        <div className="flex h-full flex-col items-center justify-end gap-[10px] pt-[34px]">
          <button onClick={handleAddRegion} className="flex h-[52px] w-full items-center justify-center gap-[6px] rounded-[12px]">
          <span className="font-['Rco',sans-serif] text-[18px] leading-none tracking-[0.36px]" style={{ color: '#0371a4' }}>{'\uE957'}</span>
          <span className="font-['Hiragino_Sans',sans-serif] text-[16px] leading-none" style={{ color: '#0371a4' }}>もう1問追加</span>
        </button>

          <button className="flex h-[56px] w-full items-center justify-center rounded-[12px] border-b-4 font-['Hiragino_Sans',sans-serif] text-[16px] font-bold text-white" style={{ background: '#339bc9', borderColor: '#0371a4' }}>
          確認
        </button>
        </div>
      </div>

      {toast && <ReviewToast key={toast.key} message={toast.message} />}
    </div>
  );
}
