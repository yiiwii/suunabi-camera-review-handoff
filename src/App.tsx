import { useEffect, useState } from 'react';
import { CameraReviewScreen } from './components/CameraReviewScreen';
import {
  IOS_DEVICE_HEIGHT,
  IOS_DEVICE_WIDTH,
  IOS_DYNAMIC_ISLAND_HEIGHT,
  IOS_DYNAMIC_ISLAND_TOP,
  IOS_DYNAMIC_ISLAND_WIDTH,
  IOS_FRAME_RADIUS,
  IOS_SCREEN_RADIUS,
} from './components/device';

const ARTBOARD_WIDTH = IOS_DEVICE_WIDTH;
const ARTBOARD_HEIGHT = IOS_DEVICE_HEIGHT;

function useIsMobileViewport() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 767px)').matches;
  });

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return isMobile;
}

function useViewportSize() {
  const [size, setSize] = useState(() => ({
    width: typeof window === 'undefined' ? ARTBOARD_WIDTH : window.innerWidth,
    height: typeof window === 'undefined' ? ARTBOARD_HEIGHT : window.innerHeight,
  }));

  useEffect(() => {
    const update = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return size;
}

export default function App() {
  const [showHitAreas, setShowHitAreas] = useState(false);
  const isMobile = useIsMobileViewport();
  const viewport = useViewportSize();

  useEffect(() => {
    if (!isMobile) return;

    const { body, documentElement } = document;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyOverscroll = body.style.overscrollBehavior;
    const prevBodyTouchAction = body.style.touchAction;
    const prevHtmlOverflow = documentElement.style.overflow;
    const prevHtmlOverscroll = documentElement.style.overscrollBehavior;

    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';
    body.style.touchAction = 'none';
    documentElement.style.overflow = 'hidden';
    documentElement.style.overscrollBehavior = 'none';

    return () => {
      body.style.overflow = prevBodyOverflow;
      body.style.overscrollBehavior = prevBodyOverscroll;
      body.style.touchAction = prevBodyTouchAction;
      documentElement.style.overflow = prevHtmlOverflow;
      documentElement.style.overscrollBehavior = prevHtmlOverscroll;
    };
  }, [isMobile]);

  if (isMobile) {
    const scale = Math.min(viewport.width / ARTBOARD_WIDTH, viewport.height / ARTBOARD_HEIGHT);
    const fittedWidth = ARTBOARD_WIDTH * scale;
    const fittedHeight = ARTBOARD_HEIGHT * scale;

    return (
      <div className="flex h-[100dvh] w-full items-center justify-center overflow-hidden bg-black touch-none">
        <div
          className="overflow-hidden"
          style={{
            width: fittedWidth,
            height: fittedHeight,
          }}
        >
          <div
            className="origin-top-left"
            style={{
              width: ARTBOARD_WIDTH,
              height: ARTBOARD_HEIGHT,
              transform: `scale(${scale})`,
            }}
          >
            <CameraReviewScreen showHitAreas={false} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-auto bg-[linear-gradient(180deg,#eef4f8_0%,#f7f9fb_100%)] px-5 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto flex max-w-[980px] items-center justify-center">
        <div className="flex min-h-[calc(100vh-48px)] items-center justify-center rounded-[32px] border border-white/70 bg-[rgba(255,255,255,0.45)] p-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm">
          <div className="relative">
            <div className="absolute right-0 top-[-52px] flex items-center gap-3 rounded-full border border-white/80 bg-white/92 px-4 py-2 shadow-[0_12px_30px_rgba(15,23,42,0.10)] backdrop-blur">
              <span className="text-[12px] font-medium text-slate-600">Hit Areas</span>
              <button
                type="button"
                aria-pressed={showHitAreas}
                onClick={() => setShowHitAreas((value) => !value)}
                className={`relative inline-flex h-[22px] w-10 items-center rounded-full transition-colors ${
                  showHitAreas ? 'bg-[#339bc9]' : 'bg-[rgba(13,14,18,0.18)]'
                }`}
              >
                <span
                  className={`block h-[18px] w-[18px] rounded-full bg-white shadow transition-transform ${
                    showHitAreas ? 'translate-x-[20px]' : 'translate-x-[2px]'
                  }`}
                />
              </button>
            </div>

            <div
              className="relative bg-black p-3 shadow-2xl"
              style={{ width: IOS_DEVICE_WIDTH + 24, borderRadius: IOS_FRAME_RADIUS }}
            >
              <div
                className="relative overflow-hidden bg-white"
                style={{ width: IOS_DEVICE_WIDTH, height: IOS_DEVICE_HEIGHT, borderRadius: IOS_SCREEN_RADIUS }}
              >
                <div
                  className="absolute left-1/2 z-50 -translate-x-1/2 rounded-full bg-black"
                  style={{
                    top: IOS_DYNAMIC_ISLAND_TOP,
                    width: IOS_DYNAMIC_ISLAND_WIDTH,
                    height: IOS_DYNAMIC_ISLAND_HEIGHT,
                  }}
                />
                <div className="h-full w-full overflow-hidden">
                  <CameraReviewScreen showHitAreas={showHitAreas} />
                </div>
              </div>
            </div>

            <div className="absolute -right-1 top-32 h-12 w-1 rounded-l bg-black" />
            <div className="absolute -right-1 top-48 h-20 w-1 rounded-l bg-black" />
            <div className="absolute -left-1 top-40 h-14 w-1 rounded-r bg-black" />
          </div>
        </div>
      </div>
    </div>
  );
}
