'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * AnimatedCounter — counts up from 0 to target with easing.
 * Uses IntersectionObserver to trigger on scroll-into-view.
 *
 * @param {object} props
 * @param {number} props.target - target number to count to
 * @param {number} props.duration - animation duration in ms (default: 1200)
 * @param {string} props.suffix - optional suffix (e.g. '+', '%')
 * @param {string} props.prefix - optional prefix (e.g. '#')
 * @param {string} props.className - extra CSS classes
 */
export default function AnimatedCounter({
  target,
  duration = 1200,
  suffix = '',
  prefix = '',
  className = '',
  style = {},
}) {
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasAnimated]);

  useEffect(() => {
    if (!hasAnimated) return;

    const startTime = performance.now();
    const startVal = 0;
    const endVal = target;

    const easeOutExpo = (t) =>
      t === 1 ? 1 : 1 - Math.pow(2, -10 * t);

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutExpo(progress);
      const current = Math.round(startVal + (endVal - startVal) * easedProgress);

      setCount(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [hasAnimated, target, duration]);

  return (
    <span ref={ref} className={className} style={style}>
      {prefix}{count}{suffix}
    </span>
  );
}
