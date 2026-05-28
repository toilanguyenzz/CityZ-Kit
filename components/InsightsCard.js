'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { computeInsights } from '@/lib/firestore';

/**
 * InsightsCard — Fun facts / personal stats
 */
export default function InsightsCard({ locations, posts, reviews }) {
  const insights = useMemo(
    () => computeInsights(locations || [], posts || [], reviews || []),
    [locations, posts, reviews]
  );

  if (insights.length === 0) return null;

  return (
    <div className="insights-wrap">
      <h2 className="pf-section-title">📊 Thống kê thú vị</h2>
      <div className="insights-grid">
        {insights.map((item, i) => (
          <div
            key={i}
            className="insight-card"
            style={{ animationDelay: `${i * 0.08}s` }}
          >
            <div className="insight-icon">{item.icon}</div>
            <div className="insight-body">
              <span className="insight-label">{item.label}</span>
              <span className="insight-value">
                {item.postId ? (
                  <Link href={`/post/${item.postId}`} className="insight-link">{item.value}</Link>
                ) : (
                  item.value
                )}
              </span>
              <span className="insight-comment">{item.comment}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
