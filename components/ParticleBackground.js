'use client';

import { useEffect, useRef, useCallback } from 'react';

/**
 * ParticleBackground — Animated particle/rain/constellation effect
 * Pure canvas, zero dependencies.
 *
 * Variants:
 *   "constellation" — floating dots connected by lines (default, for dark hero backgrounds)
 *   "rain"          — neon rain streaks falling (cyberpunk feel)
 *   "firefly"       — warm glowing dots floating (cozy/ambient feel)
 *   "snow"          — soft snowfall (gentle feel)
 *   "aurora"        — flowing aurora wave bands (premium look)
 */
export default function ParticleBackground({
  variant = 'constellation',
  opacity = 1,
  color,
  particleCount,
  speed = 1,
  className = '',
  style = {},
  interactive = true,
}) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const particlesRef = useRef([]);
  const dimensionsRef = useRef({ w: 0, h: 0 });

  // ----- Variant config defaults -----
  const getConfig = useCallback(() => {
    switch (variant) {
      case 'rain':
        return {
          count: particleCount || 120,
          baseColor: color || 'rgba(99,102,241,0.6)',
          glowColor: color || 'rgba(139,92,246,0.3)',
        };
      case 'firefly':
        return {
          count: particleCount || 40,
          baseColor: color || 'rgba(251,191,36,0.8)',
          glowColor: color || 'rgba(251,191,36,0.25)',
        };
      case 'snow':
        return {
          count: particleCount || 80,
          baseColor: color || 'rgba(255,255,255,0.8)',
          glowColor: color || 'rgba(255,255,255,0.15)',
        };
      case 'aurora':
        return {
          count: particleCount || 5,
          baseColor: color || null,
          glowColor: color || null,
        };
      case 'constellation':
      default:
        return {
          count: particleCount || 60,
          baseColor: color || 'rgba(255,255,255,0.7)',
          glowColor: color || 'rgba(99,102,241,0.35)',
          lineColor: color || 'rgba(99,102,241,0.12)',
        };
    }
  }, [variant, color, particleCount]);

  // ----- Init particles -----
  const initParticles = useCallback((w, h) => {
    const cfg = getConfig();
    const particles = [];

    if (variant === 'aurora') {
      // Aurora bands
      for (let i = 0; i < cfg.count; i++) {
        particles.push({
          y: h * 0.2 + (h * 0.5 * i) / cfg.count,
          phase: Math.random() * Math.PI * 2,
          amplitude: 30 + Math.random() * 40,
          frequency: 0.002 + Math.random() * 0.003,
          speed: 0.003 + Math.random() * 0.004,
          hue: 200 + i * 30,
          alpha: 0.06 + Math.random() * 0.06,
        });
      }
    } else if (variant === 'rain') {
      for (let i = 0; i < cfg.count; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          length: 10 + Math.random() * 25,
          speedY: 3 + Math.random() * 6,
          speedX: -0.5 + Math.random() * 0.3,
          alpha: 0.15 + Math.random() * 0.5,
          width: 1 + Math.random() * 1.5,
        });
      }
    } else if (variant === 'firefly') {
      for (let i = 0; i < cfg.count; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          radius: 1.5 + Math.random() * 3,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          pulsePhase: Math.random() * Math.PI * 2,
          pulseSpeed: 0.015 + Math.random() * 0.025,
          alpha: 0.3 + Math.random() * 0.7,
        });
      }
    } else if (variant === 'snow') {
      for (let i = 0; i < cfg.count; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          radius: 1 + Math.random() * 3,
          speedY: 0.3 + Math.random() * 1.2,
          drift: (Math.random() - 0.5) * 0.5,
          wobblePhase: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.01 + Math.random() * 0.03,
          alpha: 0.3 + Math.random() * 0.6,
        });
      }
    } else {
      // constellation
      for (let i = 0; i < cfg.count; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          radius: 1 + Math.random() * 2,
          vx: (Math.random() - 0.5) * 0.5 * speed,
          vy: (Math.random() - 0.5) * 0.5 * speed,
          alpha: 0.3 + Math.random() * 0.5,
        });
      }
    }

    return particles;
  }, [variant, getConfig, speed]);

  // ----- Draw frame -----
  const draw = useCallback((ctx, w, h, particles, time) => {
    const cfg = getConfig();
    ctx.clearRect(0, 0, w, h);

    if (variant === 'aurora') {
      particles.forEach((band) => {
        band.phase += band.speed * speed;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 4) {
          const y =
            band.y +
            Math.sin(x * band.frequency + band.phase) * band.amplitude +
            Math.sin(x * band.frequency * 0.5 + band.phase * 1.3) * band.amplitude * 0.5;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        // draw thick gradient band
        for (let x = w; x >= 0; x -= 4) {
          const y =
            band.y +
            40 +
            Math.sin(x * band.frequency + band.phase + 0.5) * band.amplitude * 0.6 +
            Math.sin(x * band.frequency * 0.4 + band.phase * 1.1) * band.amplitude * 0.3;
          ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = `hsla(${band.hue}, 80%, 60%, ${band.alpha})`;
        ctx.fill();
      });
      return;
    }

    if (variant === 'rain') {
      particles.forEach((p) => {
        p.y += p.speedY * speed;
        p.x += p.speedX * speed;
        if (p.y > h + p.length) {
          p.y = -p.length;
          p.x = Math.random() * w;
        }
        if (p.x < -10) p.x = w + 10;

        // draw streak
        const grad = ctx.createLinearGradient(p.x, p.y - p.length, p.x, p.y);
        grad.addColorStop(0, 'rgba(99,102,241,0)');
        grad.addColorStop(1, cfg.baseColor.replace(/[\d.]+\)$/, `${p.alpha})`));
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - p.length);
        ctx.lineTo(p.x + p.speedX * 2, p.y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = p.width;
        ctx.lineCap = 'round';
        ctx.stroke();

        // glow dot at tip
        ctx.beginPath();
        ctx.arc(p.x + p.speedX * 2, p.y, p.width * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = cfg.glowColor.replace(/[\d.]+\)$/, `${p.alpha * 0.6})`);
        ctx.fill();
      });
      return;
    }

    if (variant === 'firefly') {
      particles.forEach((p) => {
        p.pulsePhase += p.pulseSpeed;
        const pulse = 0.4 + 0.6 * Math.abs(Math.sin(p.pulsePhase));
        p.x += p.vx * speed;
        p.y += p.vy * speed;

        // gentle attraction to mouse
        if (interactive) {
          const dx = mouseRef.current.x - p.x;
          const dy = mouseRef.current.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 200 && dist > 0) {
            p.vx += (dx / dist) * 0.005;
            p.vy += (dy / dist) * 0.005;
          }
        }

        // dampen speed
        p.vx *= 0.998;
        p.vy *= 0.998;

        // wrap
        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20;
        if (p.y > h + 20) p.y = -20;

        // glow
        const glowR = p.radius * 4 * pulse;
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
        grad.addColorStop(0, cfg.baseColor.replace(/[\d.]+\)$/, `${p.alpha * pulse})`));
        grad.addColorStop(0.4, cfg.glowColor.replace(/[\d.]+\)$/, `${p.alpha * pulse * 0.4})`));
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // core dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * pulse, 0, Math.PI * 2);
        ctx.fillStyle = cfg.baseColor.replace(/[\d.]+\)$/, `${p.alpha * pulse})`);
        ctx.fill();
      });
      return;
    }

    if (variant === 'snow') {
      particles.forEach((p) => {
        p.wobblePhase += p.wobbleSpeed;
        p.y += p.speedY * speed;
        p.x += p.drift + Math.sin(p.wobblePhase) * 0.5;

        if (p.y > h + 10) {
          p.y = -10;
          p.x = Math.random() * w;
        }
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;

        // soft dot
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 2.5);
        grad.addColorStop(0, cfg.baseColor.replace(/[\d.]+\)$/, `${p.alpha})`));
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = cfg.baseColor.replace(/[\d.]+\)$/, `${p.alpha * 0.9})`);
        ctx.fill();
      });
      return;
    }

    // ---- CONSTELLATION (default) ----
    const connectionDist = 120;

    // draw lines first (behind dots)
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < connectionDist) {
          const lineAlpha = (1 - dist / connectionDist) * 0.15;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = (cfg.lineColor || 'rgba(99,102,241,0.12)').replace(
            /[\d.]+\)$/,
            `${lineAlpha})`
          );
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }

      // mouse connection
      if (interactive) {
        const mdx = mouseRef.current.x - particles[i].x;
        const mdy = mouseRef.current.y - particles[i].y;
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mdist < 160) {
          const mAlpha = (1 - mdist / 160) * 0.25;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(mouseRef.current.x, mouseRef.current.y);
          ctx.strokeStyle = `rgba(139,92,246,${mAlpha})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
    }

    // draw dots
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;

      // bounce at edges
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;

      // glow
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 4);
      grad.addColorStop(0, cfg.glowColor.replace(/[\d.]+\)$/, `${p.alpha * 0.6})`));
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * 4, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // core
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = cfg.baseColor.replace(/[\d.]+\)$/, `${p.alpha})`);
      ctx.fill();
    });
  }, [variant, getConfig, speed, interactive]);

  // ----- Setup -----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.scale(dpr, dpr);
      dimensionsRef.current = { w: rect.width, h: rect.height };
      particlesRef.current = initParticles(rect.width, rect.height);
    };

    resize();
    window.addEventListener('resize', resize);

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };
    const handleMouseLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 };
    };

    if (interactive) {
      canvas.addEventListener('mousemove', handleMouseMove);
      canvas.addEventListener('mouseleave', handleMouseLeave);
    }

    let time = 0;
    const animate = () => {
      const { w, h } = dimensionsRef.current;
      if (w === 0 || h === 0) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }
      time++;
      draw(ctx, w, h, particlesRef.current, time);
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', resize);
      if (interactive) {
        canvas.removeEventListener('mousemove', handleMouseMove);
        canvas.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, [initParticles, draw, interactive]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: interactive ? 'auto' : 'none',
        opacity,
        zIndex: 1,
        ...style,
      }}
    />
  );
}
