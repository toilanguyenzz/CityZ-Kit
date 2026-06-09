'use client';

import { useRef, useCallback, useEffect, useState } from 'react';

/**
 * useTilt3D — 3D tilt effect hook for cards
 * Tracks mouse position and applies perspective transform
 * with smooth lerp for natural, responsive feel.
 *
 * @param {object} options
 * @param {number} options.maxTilt - Max tilt angle in degrees (default: 8)
 * @param {number} options.perspective - CSS perspective value (default: 800)
 * @param {number} options.scale - Scale on hover (default: 1.02)
 * @param {number} options.glareOpacity - Max glare opacity (default: 0.12)
 * @param {boolean} options.disabled - Disable the effect
 * @returns {{ ref, style, glareStyle, isHovered }}
 */
export default function useTilt3D({
  maxTilt = 8,
  perspective = 800,
  scale = 1.02,
  glareOpacity = 0.12,
  disabled = false,
} = {}) {
  const ref = useRef(null);
  const [isHovered, setIsHovered] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0, glareX: 50, glareY: 50 });
  const animRef = useRef(null);
  const targetRef = useRef({ x: 0, y: 0, glareX: 50, glareY: 50 });
  const currentRef = useRef({ x: 0, y: 0, glareX: 50, glareY: 50 });

  const handleMouseMove = useCallback((e) => {
    if (disabled) return;
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const percentX = (e.clientX - centerX) / (rect.width / 2);
    const percentY = (e.clientY - centerY) / (rect.height / 2);

    targetRef.current = {
      x: -percentY * maxTilt,
      y: percentX * maxTilt,
      glareX: ((e.clientX - rect.left) / rect.width) * 100,
      glareY: ((e.clientY - rect.top) / rect.height) * 100,
    };
  }, [maxTilt, disabled]);

  const handleMouseEnter = useCallback(() => {
    if (disabled) return;
    setIsHovered(true);
  }, [disabled]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    targetRef.current = { x: 0, y: 0, glareX: 50, glareY: 50 };
  }, []);

  // Smooth animation loop with lerp
  useEffect(() => {
    const lerp = (start, end, factor) => start + (end - start) * factor;

    const animate = () => {
      const t = targetRef.current;
      const c = currentRef.current;

      currentRef.current = {
        x: lerp(c.x, t.x, 0.12),
        y: lerp(c.y, t.y, 0.12),
        glareX: lerp(c.glareX, t.glareX, 0.12),
        glareY: lerp(c.glareY, t.glareY, 0.12),
      };

      setTilt({ ...currentRef.current });
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  // Attach events
  useEffect(() => {
    const el = ref.current;
    if (!el || disabled) return;

    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('mouseenter', handleMouseEnter);
    el.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('mouseenter', handleMouseEnter);
      el.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [handleMouseMove, handleMouseEnter, handleMouseLeave, disabled]);

  const style = {
    transform: `perspective(${perspective}px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale3d(${isHovered ? scale : 1}, ${isHovered ? scale : 1}, 1)`,
    transition: isHovered ? 'none' : 'transform 0.5s cubic-bezier(0.23, 1, 0.32, 1)',
    transformStyle: 'preserve-3d',
    willChange: 'transform',
  };

  const glareStyle = {
    position: 'absolute',
    inset: 0,
    borderRadius: 'inherit',
    pointerEvents: 'none',
    zIndex: 2,
    opacity: isHovered ? 1 : 0,
    transition: 'opacity 0.4s ease',
    background: `radial-gradient(circle at ${tilt.glareX}% ${tilt.glareY}%, rgba(255,255,255,${glareOpacity}), transparent 60%)`,
  };

  return { ref, style, glareStyle, isHovered };
}
