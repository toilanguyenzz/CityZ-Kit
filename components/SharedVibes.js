'use client';

import { useMemo } from 'react';
import { computeSharedVibes } from '@/lib/firestore';

/**
 * SharedVibes — "Điểm chung" card shown when viewing someone else's profile
 */
export default function SharedVibes({ myData, theirData, theirName }) {
  const vibes = useMemo(
    () => computeSharedVibes(myData || {}, theirData || {}),
    [myData, theirData]
  );

  if (!myData || !theirData) return null;

  return (
    <div className="shared-vibes-wrap">
      <div className="shared-vibes-card">
        <div className="shared-vibes-header">
          <span className="shared-vibes-icon">🤝</span>
          <h3 className="shared-vibes-title">
            {vibes.length > 0
              ? `Bạn và ${theirName} có ${vibes.length} điểm chung`
              : `Chưa tìm thấy điểm chung với ${theirName}`}
          </h3>
        </div>

        {vibes.length > 0 ? (
          <div className="shared-vibes-list">
            {vibes.map((vibe, i) => (
              <div key={i} className="shared-vibe-item" style={{ animationDelay: `${i * 0.1}s` }}>
                <span className="shared-vibe-emoji">{vibe.icon}</span>
                <span className="shared-vibe-text">{vibe.text}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="shared-vibes-empty">
            Hãy khám phá thêm địa điểm và chia sẻ trải nghiệm để tìm điểm chung! 🌱
          </p>
        )}
      </div>
    </div>
  );
}
