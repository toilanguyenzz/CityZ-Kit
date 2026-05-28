'use client';

import { useMemo } from 'react';
import { computeMilestones } from '@/lib/firestore';

/**
 * MilestoneTimeline — Vertical timeline of memorable achievements
 */
export default function MilestoneTimeline({ userData, locations, posts, reviews }) {
  const milestones = useMemo(
    () => computeMilestones(userData, locations || [], posts || [], reviews || []),
    [userData, locations, posts, reviews]
  );

  if (milestones.length === 0) return null;

  return (
    <div className="milestone-wrap">
      <h2 className="pf-section-title">🏅 Hành trình của bạn</h2>
      <div className="milestone-timeline">
        {milestones.map((m, i) => (
          <div
            key={i}
            className="milestone-item"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <div className="milestone-dot-line">
              <div className="milestone-dot">{m.icon}</div>
              {i < milestones.length - 1 && <div className="milestone-line" />}
            </div>
            <div className="milestone-content">
              <span className="milestone-title">{m.title}</span>
              <span className="milestone-desc">{m.desc}</span>
              <span className="milestone-date">
                {m.date && !isNaN(m.date) ? m.date.toLocaleDateString('vi-VN') : ''}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
