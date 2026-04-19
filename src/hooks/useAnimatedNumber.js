import { useEffect, useRef, useState } from 'react';

export function useAnimatedNumber(value, durationMs = 1000) {
  const [display, setDisplay] = useState(() => Number(value) || 0);
  const displayRef = useRef(display);
  displayRef.current = display;
  const raf = useRef(null);

  useEffect(() => {
    const startVal = displayRef.current;
    const endVal = Number(value) || 0;
    let startTs = null;

    const step = (ts) => {
      if (startTs == null) startTs = ts;
      const t = Math.min(1, (ts - startTs) / durationMs);
      const next = Math.round(startVal + (endVal - startVal) * t);
      setDisplay(next);
      if (t < 1) raf.current = requestAnimationFrame(step);
    };

    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [value, durationMs]);

  return display;
}
