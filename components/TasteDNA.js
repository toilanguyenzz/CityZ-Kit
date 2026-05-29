'use client';

import { useMemo } from 'react';
import { computeTasteDNA, TASTE_CATEGORIES } from '@/lib/firestore';

/**
 * TasteDNA — Radar/Spider Chart + Personality Title + Taste Tags
 * All rendering is pure SVG, zero external chart libraries.
 * `compact` prop: renders smaller radar chart + title only (no tags, no wrapper padding)
 */
export default function TasteDNA({ locations, posts, reviews, allLocations, compact = false }) {
  const dna = useMemo(
    () => computeTasteDNA(locations || [], posts || [], reviews || [], allLocations || []),
    [locations, posts, reviews, allLocations]
  );

  if (dna.total === 0) {
    return (
      <div className={compact ? '' : 'taste-dna-wrap'}>
        {!compact && <h2 className="pf-section-title">🧬 Taste DNA</h2>}
        <div className="taste-dna-empty">
          <span className="taste-dna-empty-icon">🌱</span>
          <p>Hãy khám phá và đánh giá thêm để hệ thống hiểu gu của bạn!</p>
        </div>
      </div>
    );
  }

  // Radar chart config
  const chartSize = compact ? 180 : 240;
  const cx = chartSize / 2;
  const cy = chartSize / 2;
  const maxR = compact ? 65 : 90;
  const levels = 4;
  const cats = TASTE_CATEGORIES;
  const angleStep = (2 * Math.PI) / cats.length;
  const startAngle = -Math.PI / 2; // top

  // Build polygon points for the data
  const dataPoints = cats.map((cat, i) => {
    const angle = startAngle + i * angleStep;
    const r = maxR * (dna.scores[cat.key] || 0);
    // Ensure minimum visible radius when score > 0
    const visR = dna.scores[cat.key] > 0 ? Math.max(r, 12) : 0;
    const labelDist = compact ? maxR + 22 : maxR + 28;
    return {
      x: cx + visR * Math.cos(angle),
      y: cy + visR * Math.sin(angle),
      labelX: cx + labelDist * Math.cos(angle),
      labelY: cy + labelDist * Math.sin(angle),
      cat,
      score: dna.scores[cat.key],
    };
  });

  const polygonPoints = dataPoints.map(p => `${p.x},${p.y}`).join(' ');

  // Grid polygons
  const gridPolygons = Array.from({ length: levels }, (_, li) => {
    const r = maxR * ((li + 1) / levels);
    return cats.map((_, i) => {
      const angle = startAngle + i * angleStep;
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
    }).join(' ');
  });

  return (
    <div className={compact ? '' : 'taste-dna-wrap'}>
      {!compact && <h2 className="pf-section-title">🧬 Taste DNA</h2>}

      {/* Personality Title */}
      <div className="taste-dna-title-row">
        <span className="taste-dna-personality">{dna.personalityTitle}</span>
      </div>

      <div className={compact ? '' : 'taste-dna-content'} style={compact ? { display: 'flex', justifyContent: 'center' } : undefined}>
        {/* Radar Chart */}
        <div className="taste-dna-chart" style={compact ? { width: chartSize, height: chartSize } : undefined}>
          <svg viewBox={`0 0 ${chartSize} ${chartSize}`} className="taste-dna-svg">
            {/* Grid levels */}
            {gridPolygons.map((pts, i) => (
              <polygon
                key={i}
                points={pts}
                fill="none"
                stroke="rgba(99,102,241,0.12)"
                strokeWidth="1"
              />
            ))}

            {/* Axis lines */}
            {cats.map((_, i) => {
              const angle = startAngle + i * angleStep;
              return (
                <line
                  key={i}
                  x1={cx}
                  y1={cy}
                  x2={cx + maxR * Math.cos(angle)}
                  y2={cy + maxR * Math.sin(angle)}
                  stroke="rgba(99,102,241,0.1)"
                  strokeWidth="1"
                />
              );
            })}

            {/* Data polygon */}
            <polygon
              points={polygonPoints}
              fill="rgba(99,102,241,0.18)"
              stroke="rgba(99,102,241,0.7)"
              strokeWidth="2"
              className="taste-dna-polygon"
            />

            {/* Data points */}
            {dataPoints.map((p, i) => (
              p.score > 0 && (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r="4"
                  fill="#6366f1"
                  stroke="#fff"
                  strokeWidth="2"
                  className="taste-dna-dot"
                />
              )
            ))}

            {/* Category labels */}
            {dataPoints.map((p, i) => (
              <text
                key={i}
                x={p.labelX}
                y={p.labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                className="taste-dna-label"
                fontSize={compact ? '9' : '11'}
                fill="#4b5563"
              >
                {p.cat.icon} {p.cat.label}
              </text>
            ))}
          </svg>
        </div>

        {/* Taste Tags — only in full mode */}
        {!compact && (
          <div className="taste-dna-tags">
            {dna.tasteTags.map(tag => (
              <div key={tag.key} className="taste-tag">
                <span className="taste-tag-icon">{tag.icon}</span>
                <div className="taste-tag-info">
                  <span className="taste-tag-label">{tag.label}</span>
                  <div className="taste-tag-bar-bg">
                    <div
                      className="taste-tag-bar-fill"
                      style={{ width: `${Math.round(tag.score * 100)}%` }}
                    />
                  </div>
                  <span className="taste-tag-pct">{Math.round(tag.score * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
