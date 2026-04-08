import { useEffect, useRef, useState } from 'react';
import { IOS_SAFE_AREA_BOTTOM, IOS_SAFE_AREA_TOP } from './device';

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

function resolveRegionRelease(region: Region, regions: Region[], fallbackRegion?: Region): Region {
  if (isWithinBounds(region) && !overlapsAny(region, regions, region.id)) {
    return region;
  }

  const snapped = isWithinBounds(region) ? findNearestValidPlacement(region, regions) : null;
  if (snapped) return snapped;

  if (fallbackRegion && isWithinBounds(fallbackRegion) && !overlapsAny(fallbackRegion, regions, region.id)) {
    return fallbackRegion;
  }

  return region;
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
      <div className="absolute inset-0 rounded-[20px]" style={{ background: 'rgba(217,217,217,0.45)' }} />

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

      <div className="absolute flex items-center justify-center rounded-full px-[10px] pointer-events-none" style={{ background: active ? '#339bc9' : '#ffffff', height: 20, left: 8, top: 8 }}>
        <span className="font-['Rco',sans-serif] text-[12px] leading-none" style={{ color: active ? '#ffffff' : '#339bc9' }}>
          Q{index + 1}
        </span>
      </div>

      {showRemove && (
        <button onPointerDown={(e) => e.stopPropagation()} onClick={onRemove} className="absolute" style={{ width: CLOSE_SIZE, height: CLOSE_SIZE, right: 8, top: 8 }}>
          <span className="absolute right-[2px] top-[2px] flex items-center justify-center rounded-full font-['Rco',sans-serif] text-[11px] leading-none text-white" style={{ background: 'rgba(13,14,18,0.4)', width: 20, height: 20 }}>
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
          return resolveRegionRelease(region, currentRegions, ia.startRegion);
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
      showToast('当前页面已满。\n无法添加更多选框');
      return;
    }
    setRegions((prev) => [...prev, next]);
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-white">
      <div className="absolute inset-x-0 top-0 overflow-hidden" style={{ height: CAMERA_H }}>
        <div className="absolute inset-0" style={{ background: 'rgba(13,14,18,0.85)' }} />

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

        <div className="absolute inset-x-0 flex items-center justify-center px-[30px]" style={{ top: 510 }}>
          <p className="font-['Hiragino_Sans',sans-serif] text-center text-[16px] leading-normal text-white" style={{ opacity: 0.7 }}>
            {isSingle ? '一個の枠内に1問を配置してください。' : '枠の大きさを調整してください。'}
          </p>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center px-[10px]" style={{ top: IOS_SAFE_AREA_TOP + 4, height: 56 }}>
        <button className="pointer-events-auto flex h-[40px] w-[40px] items-center justify-center rounded-full">
          <span className="font-['Rco',sans-serif] text-[24px] leading-none tracking-[0.48px] text-white">{'\uE902'}</span>
        </button>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-end bg-white px-[20px]" style={{ top: CAMERA_H, paddingBottom: IOS_SAFE_AREA_BOTTOM + 10, gap: 10 }}>
        <button onClick={handleAddRegion} className="flex h-[52px] w-full items-center justify-center gap-[6px] rounded-[12px]">
          <span className="font-['Rco',sans-serif] text-[18px] leading-none tracking-[0.36px]" style={{ color: '#0371a4' }}>{'\uE957'}</span>
          <span className="font-['Hiragino_Sans',sans-serif] text-[16px] leading-none" style={{ color: '#0371a4' }}>もう1問追加</span>
        </button>

        <button className="flex h-[56px] w-full items-center justify-center rounded-[12px] border-b-4 font-['Hiragino_Sans',sans-serif] text-[16px] font-bold text-white" style={{ background: '#339bc9', borderColor: '#0371a4' }}>
          確認
        </button>
      </div>

      {toast && <ReviewToast key={toast.key} message={toast.message} />}
    </div>
  );
}
