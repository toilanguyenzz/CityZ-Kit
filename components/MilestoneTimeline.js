'use client';

import { useMemo, useState } from 'react';
import { computeMilestones } from '@/lib/firestore';

/**
 * MilestoneTimeline — Vertical timeline of memorable achievements
 * `compact` prop: renders inside bento card with smaller dots and toggle
 * `maxItems` prop: limits visible milestones (default all)
 */
export default function MilestoneTimeline({ userData, locations, posts, reviews, compact = false, maxItems }) {
  const milestones = useMemo(
    () => computeMilestones(userData, locations || [], posts || [], reviews || []),
    [userData, locations, posts, reviews]
  );

  const [expanded, setExpanded] = useState(false);

  if (milestones.length === 0) return null;

  const limit = maxItems && !expanded ? maxItems : milestones.length;
  const visibleMilestones = milestones.slice(0, limit);
  const hasMore = maxItems && milestones.length > maxItems;

  if (compact) {
    return (
      <>
        <div className="pf-timeline-compact">
          {visibleMilestones.map((m, i) => (
            <div key={i} className="pf-timeline-item">
              <div className="pf-timeline-dot-col">
                <div className="pf-timeline-dot">{m.icon}</div>
                {i < visibleMilestones.length - 1 && <div className="pf-timeline-line" />}
              </div>
              <div className="pf-timeline-body">
                <span className="pf-timeline-title">{m.title}</span>
                <span className="pf-timeline-desc">{m.desc}</span>
                <span className="pf-timeline-date">
                  {m.date && !isNaN(m.date) ? m.date.toLocaleDateString('vi-VN') : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
        {hasMore && (
          <button className="pf-timeline-toggle" onClick={() => setExpanded(!expanded)}>
            {expanded ? '▲ Thu gọn' : `▼ Xem thêm ${milestones.length - maxItems} mốc`}
          </button>
        )}
      </>
    );
  }

  // Full mode (legacy)
  return (
    <div className="milestone-wrap">
      <h2 className="pf-section-title">🏅 Hành trình của bạn</h2>
      <div className="milestone-timeline">
        {visibleMilestones.map((m, i) => (
          <div
            key={i}
            className="milestone-item"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <div className="milestone-dot-line">
              <div className="milestone-dot">{m.icon}</div>
              {i < visibleMilestones.length - 1 && <div className="milestone-line" />}
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
      {hasMore && (
        <button className="pf-timeline-toggle" onClick={() => setExpanded(!expanded)}>
          {expanded ? '▲ Thu gọn' : `▼ Xem thêm ${milestones.length - maxItems} mốc`}
        </button>
      )}
    </div>
  );
}
