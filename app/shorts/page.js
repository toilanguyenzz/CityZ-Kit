'use client';

import '@/app/styles/shorts.css';
import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { collection, getDocs, doc, updateDoc, increment } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';

const LocketCameraModal = dynamic(() => import('@/components/LocketCameraModal'), { ssr: false });

const CATEGORY_MAP = {
  Food: { label: 'Ăn uống', emoji: '🍜' },
  Housing: { label: 'Nhà trọ', emoji: '🏠' },
  Cafe: { label: 'Cafe', emoji: '☕' },
  Play: { label: 'Vui chơi', emoji: '🎡' },
  Other: { label: 'Khác', emoji: '🏷️' },
};

function getVideoEmbedInfo(url) {
  if (!url) return { type: 'none' };
  const cleanUrl = url.trim();

  const ytShortsRegex = /youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/i;
  const ytWatchRegex = /youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/i;
  const ytShareRegex = /youtu\.be\/([a-zA-Z0-9_-]+)/i;

  let match = cleanUrl.match(ytShortsRegex) || cleanUrl.match(ytWatchRegex) || cleanUrl.match(ytShareRegex);
  if (match) {
    return {
      type: 'youtube',
      embedUrl: `https://www.youtube.com/embed/${match[1]}?autoplay=1&mute=1&loop=1&playlist=${match[1]}&controls=0&modestbranding=1&rel=0`
    };
  }

  const ttVideoRegex = /tiktok\.com\/@[a-zA-Z0-9_.-]+\/video\/([0-9]+)/i;
  match = cleanUrl.match(ttVideoRegex);
  if (match) {
    return {
      type: 'tiktok-embed',
      embedUrl: `https://www.tiktok.com/embed/v2/${match[1]}`
    };
  }

  if (cleanUrl.includes('tiktok.com')) {
    return {
      type: 'tiktok-link',
      originalUrl: cleanUrl
    };
  }

  return {
    type: 'direct',
    url: cleanUrl
  };
}

function ShortItem({ location }) {
  const [reactions, setReactions] = useState(location.reactions || { fire: 0, yummy: 0, cheap: 0, like: 0 });
  const [flyingEmojis, setFlyingEmojis] = useState([]);

  const handleReaction = async (type) => {
    const emojiMap = { fire: '🔥', yummy: '🤤', cheap: '💸', like: '👍' };
    const char = emojiMap[type];
    const id = Date.now() + Math.random();

    setFlyingEmojis(prev => [...prev, { id, char, left: Math.random() * 60 + 20 }]);
    setTimeout(() => {
      setFlyingEmojis(prev => prev.filter(e => e.id !== id));
    }, 1000);

    setReactions(prev => ({ ...prev, [type]: (prev[type] || 0) + 1 }));

    try {
      const locRef = doc(db, 'locations', location.id);
      await updateDoc(locRef, {
        [`reactions.${type}`]: increment(1)
      });
    } catch (err) {
      console.error('Error updating reaction:', err);
    }
  };

  const cat = CATEGORY_MAP[location.category] || CATEGORY_MAP.Other;

  return (
    <div className="short-item">
      {/* 1:1 Camera Viewport / Locket Widget Frame */}
      <div className="locket-viewport">
        {/* Locket Live Capture badge */}
        <div className="locket-badge">
          {location.createdByAvatar ? (
            <img src={location.createdByAvatar} alt={location.createdByName} className="locket-badge-avatar" />
          ) : (
            <div className="locket-badge-placeholder">
              {(location.createdByName || 'U').charAt(0).toUpperCase()}
            </div>
          )}
          <span>⚡ Live from {location.createdByName || 'Sinh viên'}</span>
        </div>

        <img
          src={location.imageUrl}
          alt={location.name}
          className="short-video"
          style={{ objectFit: 'cover' }}
        />

        {/* Flying emojis animation stream overlay */}
        {flyingEmojis.map(fe => (
          <span
            key={fe.id}
            className="flying-emoji"
            style={{ left: `${fe.left}%` }}
          >
            {fe.char}
          </span>
        ))}

        {/* Locket capsule tags display */}
        {location.tags && location.tags.length > 0 && (
          <div className="locket-tags-container">
            {location.tags.map((tag, idx) => (
              <span key={idx} className="locket-tag-capsule">{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* User Caption */}
      {location.description && (
        <div className="locket-caption-text">
          <span className="caption-author">@{location.createdByName || 'Sinh viên'}:</span> {location.description}
        </div>
      )}

      {/* Locket Live Emoji Reactions Tool-bar */}
      <div className="locket-reactions-bar">
        <button onClick={() => handleReaction('fire')} className="locket-reaction-btn">
          <span>🔥</span> <span className="locket-reaction-count">{reactions.fire || 0}</span>
        </button>
        <button onClick={() => handleReaction('yummy')} className="locket-reaction-btn">
          <span>🤤</span> <span className="locket-reaction-count">{reactions.yummy || 0}</span>
        </button>
        <button onClick={() => handleReaction('cheap')} className="locket-reaction-btn">
          <span>💸</span> <span className="locket-reaction-count">{reactions.cheap || 0}</span>
        </button>
        <button onClick={() => handleReaction('like')} className="locket-reaction-btn">
          <span>👍</span> <span className="locket-reaction-count">{reactions.like || 0}</span>
        </button>
      </div>

      {/* Share / Details actions */}
      <div className="short-actions">
        <button
          className="short-action-btn"
          onClick={() => {
            navigator.clipboard.writeText(`${window.location.origin}/location/${location.id}`);
            toast.success('Đã sao chép link!');
          }}
        >
          <div className="short-action-icon">🔗</div>
          <span className="short-action-label">Chia sẻ</span>
        </button>
      </div>

      {/* Bottom Spot information */}
      <div className="short-info">
        <div className="short-location-meta">
          <span className="short-cat-badge">{cat.emoji} {cat.label}</span>
          {(location.averageRating || 0) > 0 && (
            <span className="short-rating">⭐ {location.averageRating?.toFixed(1)}</span>
          )}
        </div>
        <Link href={`/location/${location.id}`} className="short-location-tag">
          <span className="slt-pin">📍</span>
          <span className="slt-name">{location.name} (Xem Review & Bản đồ) ›</span>
        </Link>
      </div>
    </div>
  );
}

function TikTokShortItem({ location, isActive }) {
  const videoRef = useRef(null);
  const [paused, setPaused] = useState(false);
  const [showHeart, setShowHeart] = useState(false);
  const [progress, setProgress] = useState(0);
  const lastTapRef = useRef(0);

  const [reactions, setReactions] = useState(location.reactions || { fire: 0, yummy: 0, cheap: 0, like: 0 });
  const [flyingEmojis, setFlyingEmojis] = useState([]);
  const [videoError, setVideoError] = useState(false);

  const embedInfo = useMemo(() => {
    return getVideoEmbedInfo(location.videoUrl);
  }, [location.videoUrl]);

  // Auto play/pause video based on active item state (direct mp4 links only)
  useEffect(() => {
    if (embedInfo.type !== 'direct') return;
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;

    if (isActive) {
      video.currentTime = 0;
      video.play().catch(() => {});
      setPaused(false);
    } else {
      video.pause();
    }
  }, [isActive, embedInfo.type]);

  // Video progress bar
  useEffect(() => {
    if (embedInfo.type !== 'direct') return;
    const video = videoRef.current;
    if (!video) return;

    const updateProgress = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };

    video.addEventListener('timeupdate', updateProgress);
    return () => video.removeEventListener('timeupdate', updateProgress);
  }, [embedInfo.type]);

  const handleTap = () => {
    if (embedInfo.type !== 'direct') return;
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      handleDoubleTap();
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
      setTimeout(() => {
        if (lastTapRef.current !== 0) {
          togglePlay();
        }
      }, 300);
    }
  };

  const togglePlay = () => {
    if (embedInfo.type !== 'direct') return;
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      setPaused(false);
    } else {
      video.pause();
      setPaused(true);
    }
  };

  const handleDoubleTap = () => {
    setShowHeart(true);
    setTimeout(() => setShowHeart(false), 800);
    handleReaction('like');
  };

  const handleReaction = async (type) => {
    const emojiMap = { fire: '🔥', yummy: '🤤', cheap: '💸', like: '👍' };
    const char = emojiMap[type];
    const id = Date.now() + Math.random();

    setFlyingEmojis(prev => [...prev, { id, char, left: Math.random() * 60 + 20 }]);
    setTimeout(() => {
      setFlyingEmojis(prev => prev.filter(e => e.id !== id));
    }, 1000);

    setReactions(prev => ({ ...prev, [type]: (prev[type] || 0) + 1 }));

    try {
      const locRef = doc(db, 'locations', location.id);
      await updateDoc(locRef, {
        [`reactions.${type}`]: increment(1)
      });
    } catch (err) {
      console.error('Error updating reaction:', err);
    }
  };

  const cat = CATEGORY_MAP[location.category] || CATEGORY_MAP.Other;

  return (
    <div className="short-item">
      {/* 9:16 vertical TikTok Viewport */}
      <div className="tiktok-viewport">
        {embedInfo.type === 'youtube' && (
          <iframe
            className="tiktok-video"
            src={isActive ? embedInfo.embedUrl : 'about:blank'}
            style={{ border: 'none', width: '100%', height: '100%' }}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        )}

        {embedInfo.type === 'tiktok-embed' && (
          <iframe
            className="tiktok-video"
            src={isActive ? embedInfo.embedUrl : 'about:blank'}
            style={{ border: 'none', width: '100%', height: '100%' }}
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        )}

        {embedInfo.type === 'tiktok-link' && (
          <div style={{
            position: 'relative', width: '100%', height: '100%',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: '#050505', padding: '1.5rem', textAlign: 'center'
          }}>
            {location.imageUrl && (
              <img
                src={location.imageUrl}
                alt={location.name}
                style={{
                  position: 'absolute', inset: 0, width: '100%', height: '100%',
                  objectFit: 'cover', opacity: 0.25, filter: 'blur(4px)'
                }}
              />
            )}
            <div style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #ff0050, #00f2fe)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(255,0,80,0.3)'
              }}>
                <span style={{ fontSize: '1.8rem', color: '#fff' }}>🎬</span>
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#fff' }}>Video TikTok</h3>
              <p style={{ fontSize: '0.78rem', color: '#ccc', margin: 0, maxWidth: '240px', lineHeight: 1.4 }}>
                Trình duyệt không thể phát trực tiếp link chia sẻ TikTok. Bấm nút dưới để xem clip.
              </p>
              <a
                href={embedInfo.originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                  background: 'linear-gradient(135deg, #ff0050, #00f2fe)',
                  color: '#fff', padding: '0.65rem 1.25rem', borderRadius: '2rem',
                  fontSize: '0.82rem', fontWeight: 700, textDecoration: 'none',
                  boxShadow: '0 4px 12px rgba(255,0,80,0.4)',
                  transition: 'transform 0.15s'
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                ▶ Xem trên TikTok
              </a>
            </div>
          </div>
        )}

        {embedInfo.type === 'direct' && !videoError && (
          <video
            ref={videoRef}
            className="tiktok-video"
            src={embedInfo.url}
            loop
            muted
            playsInline
            preload="metadata"
            onClick={handleTap}
            poster={location.imageUrl || undefined}
            onError={() => setVideoError(true)}
          />
        )}

        {embedInfo.type === 'direct' && videoError && (
          <div style={{
            position: 'relative', width: '100%', height: '100%',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: '#050505', padding: '1.5rem', textAlign: 'center'
          }}>
            {location.imageUrl && (
              <img
                src={location.imageUrl}
                alt={location.name}
                style={{
                  position: 'absolute', inset: 0, width: '100%', height: '100%',
                  objectFit: 'cover', opacity: 0.3, filter: 'blur(4px)'
                }}
              />
            )}
            <div style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.2)', border: '2px solid #ef4444',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <span style={{ fontSize: '1.8rem', color: '#ef4444' }}>⚠️</span>
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#fff' }}>Không thể tải video</h3>
              <p style={{ fontSize: '0.78rem', color: '#ccc', margin: 0, maxWidth: '240px', lineHeight: 1.4 }}>
                Định dạng video không được hỗ trợ hoặc không thể truy cập.
              </p>
              <a
                href={embedInfo.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                  background: '#222', border: '1px solid #444',
                  color: '#fff', padding: '0.65rem 1.25rem', borderRadius: '2rem',
                  fontSize: '0.82rem', fontWeight: 700, textDecoration: 'none',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#333'}
                onMouseOut={(e) => e.currentTarget.style.background = '#222'}
              >
                Mở liên kết video
              </a>
            </div>
          </div>
        )}

        {/* Double-tap heart anim */}
        {showHeart && <div className="short-heart-anim">❤️</div>}

        {/* Flying emojis */}
        {flyingEmojis.map(fe => (
          <span
            key={fe.id}
            className="flying-emoji"
            style={{ left: `${fe.left}%` }}
          >
            {fe.char}
          </span>
        ))}

        {/* Play/Pause icon overlay */}
        <div className="short-play-overlay">
          <div className={`short-play-icon ${paused ? 'visible' : ''}`}>
            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>

        {/* TikTok Bottom Info Overlay */}
        <div className="tiktok-overlay-bottom">
          <div className="tiktok-author-row">
            {location.createdByAvatar ? (
              <img src={location.createdByAvatar} alt={location.createdByName} className="tiktok-avatar" />
            ) : (
              <div className="tiktok-avatar bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                {(location.createdByName || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <span className="tiktok-author-name">@{location.createdByName || 'Sinh viên'}</span>
            <span className="bg-indigo-600/80 text-[10px] px-2.5 py-0.5 rounded-full font-bold">
              {cat.emoji} {cat.label}
            </span>
          </div>

          <Link href={`/location/${location.id}`} className="tiktok-location-tag">
            <span>📍</span> {location.name} (Xem Review) ›
          </Link>

          {location.description && (
            <p className="tiktok-caption">
              {location.description}
            </p>
          )}
        </div>

        {/* TikTok Right Sidebar Reactions */}
        <div className="tiktok-overlay-right">
          <button onClick={() => handleReaction('fire')} className="tiktok-action-button">
            <div className="tiktok-action-icon-circle">🔥</div>
            <span className="tiktok-action-count">{reactions.fire || 0}</span>
          </button>
          <button onClick={() => handleReaction('yummy')} className="tiktok-action-button">
            <div className="tiktok-action-icon-circle">🤤</div>
            <span className="tiktok-action-count">{reactions.yummy || 0}</span>
          </button>
          <button onClick={() => handleReaction('cheap')} className="tiktok-action-button">
            <div className="tiktok-action-icon-circle">💸</div>
            <span className="tiktok-action-count">{reactions.cheap || 0}</span>
          </button>
          <button onClick={() => handleReaction('like')} className="tiktok-action-button">
            <div className="tiktok-action-icon-circle">👍</div>
            <span className="tiktok-action-count">{reactions.like || 0}</span>
          </button>

          {/* Share Action */}
          <button
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/location/${location.id}`);
              toast.success('Đã sao chép link!');
            }}
            className="tiktok-action-button"
          >
            <div className="tiktok-action-icon-circle">🔗</div>
            <span className="tiktok-action-count" style={{ fontSize: '0.62rem' }}>Share</span>
          </button>
        </div>

        {/* Video progress bar overlay */}
        {embedInfo.type === 'direct' && (
          <div className="short-progress" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10 }}>
            <div className="short-progress-bar" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function ShortsPage() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('locket'); // 'locket' | 'tiktok'
  const [showCameraModal, setShowCameraModal] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'locations'));
      let locs = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(l => (l.status === 'approved' || !l.status) && (l.videoUrl || l.imageUrl));

      // Sort by newest check-ins at the top
      locs.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return dateB - dateA;
      });

      setLocations(locs);
    } catch (error) {
      console.error('Error fetching locations:', error);
      toast.error('Không thể tải video');
    } finally {
      setLoading(false);
    }
  };

  // Reset activeIndex when tab changes
  useEffect(() => {
    setActiveIndex(0);
  }, [activeTab]);

  // IntersectionObserver for tracking swipe position
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = parseInt(entry.target.dataset.index, 10);
            if (!isNaN(idx)) setActiveIndex(idx);
          }
        });
      },
      { root: container, threshold: 0.6 }
    );

    const items = container.querySelectorAll('.short-item-wrap');
    items.forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, [activeTab, locations]);

  const locketLocations = locations.filter(l => l.imageUrl && !l.videoUrl);
  const tiktokLocations = locations.filter(l => l.videoUrl);
  const activeLocations = activeTab === 'locket' ? locketLocations : tiktokLocations;

  if (loading) {
    return (
      <div className="shorts-root">
        <Navbar />
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 64px)' }}>
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white"></div>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="shorts-root" style={{ overflow: 'hidden', height: '100vh', position: 'relative' }}>
        <Navbar />

        {/* Tab Switcher */}
        <div style={{ display: 'flex', justifyContent: 'center', margin: '0.85rem 0 0.5rem', zIndex: 10, position: 'relative' }}>
          <div style={{ display: 'flex', background: 'rgba(30, 41, 59, 0.6)', padding: '4px', borderRadius: '2rem', border: '1px solid #334155' }}>
            <button
              onClick={() => setActiveTab('locket')}
              style={{
                padding: '0.5rem 1.25rem',
                borderRadius: '1.75rem',
                border: 'none',
                background: activeTab === 'locket' ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : 'transparent',
                color: '#fff',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <span>⚡</span> Locket Check-in ({locketLocations.length})
            </button>
            <button
              onClick={() => setActiveTab('tiktok')}
              style={{
                padding: '0.5rem 1.25rem',
                borderRadius: '1.75rem',
                border: 'none',
                background: activeTab === 'tiktok' ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : 'transparent',
                color: '#fff',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <span>🎬</span> TikTok Video ({tiktokLocations.length})
            </button>
          </div>
        </div>

        {/* Floating Quick Snap / Check-in Button */}
        <button
          onClick={() => setShowCameraModal(true)}
          style={{
            position: 'absolute', right: '1.25rem', bottom: '6.5rem',
            width: '56px', height: '56px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
            border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
            boxShadow: '0 8px 24px rgba(79, 70, 229, 0.4)',
            transition: 'transform 0.2s, box-shadow 0.2s'
          }}
          onMouseOver={(e) => { e.currentTarget.style.transform = 'scale(1.08) translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 28px rgba(79, 70, 229, 0.5)'; }}
          onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1) translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(79, 70, 229, 0.4)'; }}
          title="⚡ Check-in nhanh"
        >
          ⚡
        </button>

        {activeLocations.length === 0 ? (
          <div className="shorts-empty">
            <div className="shorts-empty-icon">🎬</div>
            <h2>Chưa có bài đăng nào</h2>
            <p>Bấm Check-in nhanh để là người đầu tiên chia sẻ!</p>
            <button onClick={() => setShowCameraModal(true)} className="shorts-add-btn">
              ➕ Check-in nhanh ngay
            </button>
          </div>
        ) : (
          <div className="shorts-container" ref={containerRef} key={activeTab}>
            {activeLocations.map((loc, idx) => (
              <div key={loc.id} className="short-item-wrap" data-index={idx}>
                {activeTab === 'locket' ? (
                  <ShortItem
                    location={loc}
                    isActive={idx === activeIndex}
                  />
                ) : (
                  <TikTokShortItem
                    location={loc}
                    isActive={idx === activeIndex}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Locket Live Camera capture modal */}
        {showCameraModal && (
          <LocketCameraModal
            onClose={() => setShowCameraModal(false)}
            onUploadSuccess={fetchLocations}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}
