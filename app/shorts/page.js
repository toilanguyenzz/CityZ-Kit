'use client';

import '@/app/styles/shorts.css';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { collection, getDocs, query, where, doc, updateDoc, increment, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import toast from 'react-hot-toast';

const CATEGORY_MAP = {
  Food: { label: 'Ăn uống', emoji: '🍜' },
  Housing: { label: 'Nhà trọ', emoji: '🏠' },
  Cafe: { label: 'Cafe', emoji: '☕' },
  Play: { label: 'Vui chơi', emoji: '🎡' },
  Other: { label: 'Khác', emoji: '🏷️' },
};

// Sample vertical videos for demo (royalty-free from Mixkit)
const SAMPLE_VIDEOS = [
  'https://assets.mixkit.co/videos/52537/52537-720.mp4',
  'https://assets.mixkit.co/videos/44521/44521-720.mp4',
  'https://assets.mixkit.co/videos/34487/34487-720.mp4',
  'https://assets.mixkit.co/videos/42141/42141-720.mp4',
];

function ShortItem({ location, isActive, onLike }) {
  const videoRef = useRef(null);
  const [paused, setPaused] = useState(false);
  const [showHeart, setShowHeart] = useState(false);
  const [progress, setProgress] = useState(0);
  const lastTapRef = useRef(0);

  const user = auth.currentUser;
  const isLiked = location.likedBy?.includes(user?.uid);
  const likeCount = location.likes || 0;

  // Auto play/pause based on visibility
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      video.currentTime = 0;
      video.play().catch(() => {});
      setPaused(false);
    } else {
      video.pause();
    }
  }, [isActive]);

  // Progress bar
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateProgress = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };

    video.addEventListener('timeupdate', updateProgress);
    return () => video.removeEventListener('timeupdate', updateProgress);
  }, []);

  const handleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Double tap → like
      handleDoubleTap();
      lastTapRef.current = 0;
    } else {
      // Single tap → play/pause
      lastTapRef.current = now;
      setTimeout(() => {
        if (lastTapRef.current !== 0) {
          togglePlay();
        }
      }, 300);
    }
  };

  const togglePlay = () => {
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
    if (!isLiked) {
      onLike(location.id);
    }
  };

  const cat = CATEGORY_MAP[location.category] || CATEGORY_MAP.Other;

  return (
    <div className="short-item">
      {/* Progress bar */}
      <div className="short-progress">
        <div className="short-progress-bar" style={{ width: `${progress}%` }} />
      </div>

      {/* Gradient overlays */}
      <div className="short-gradient-top" />
      <div className="short-gradient-bottom" />

      {/* Video */}
      <video
        ref={videoRef}
        className="short-video"
        src={location.videoUrl}
        loop
        muted
        playsInline
        preload="metadata"
        onClick={handleTap}
        poster={location.imageUrl || undefined}
      />

      {/* Play/Pause indicator */}
      <div className="short-play-overlay">
        <div className={`short-play-icon ${paused ? 'visible' : ''}`}>
          <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        </div>
      </div>

      {/* Double-tap heart */}
      {showHeart && <div className="short-heart-anim">❤️</div>}

      {/* Side actions */}
      <div className="short-actions">
        <button className="short-action-btn" onClick={() => onLike(location.id)}>
          <div className={`short-action-icon ${isLiked ? 'liked' : ''}`}>
            {isLiked ? '❤️' : '🤍'}
          </div>
          <span className="short-action-label">{likeCount}</span>
        </button>

        <Link href={`/location/${location.id}`} className="short-action-btn">
          <div className="short-action-icon">💬</div>
          <span className="short-action-label">{location.reviewCount || 0}</span>
        </Link>

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

      {/* Bottom info */}
      <div className="short-info">
        <h3 className="short-location-name">{location.name}</h3>
        <div className="short-location-meta">
          <span className="short-cat-badge">{cat.emoji} {cat.label}</span>
          {(location.averageRating || 0) > 0 && (
            <span className="short-rating">⭐ {location.averageRating?.toFixed(1)}</span>
          )}
        </div>
        {location.description && (
          <p className="short-desc">{location.description}</p>
        )}
        <Link href={`/location/${location.id}`} className="short-location-tag">
          <span className="slt-pin">📍</span>
          <span className="slt-name">{location.name} (Xem Review & Bản đồ)</span>
          <span className="slt-arrow">›</span>
        </Link>
      </div>
    </div>
  );
}

export default function ShortsPage() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef(null);

  useEffect(() => {
    fetchLocationsWithVideo();
  }, []);

  const fetchLocationsWithVideo = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'locations'));
      let locs = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(l => (l.status === 'approved' || !l.status) && l.videoUrl);

      // If no locations have video, seed some sample videos to existing locations
      if (locs.length === 0) {
        const allLocs = snapshot.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(l => l.status === 'approved' || !l.status);

        // Assign sample videos to existing locations for demo
        locs = allLocs.slice(0, SAMPLE_VIDEOS.length).map((loc, i) => ({
          ...loc,
          videoUrl: SAMPLE_VIDEOS[i % SAMPLE_VIDEOS.length],
        }));
      }

      setLocations(locs);
    } catch (error) {
      console.error('Error fetching locations:', error);
      toast.error('Không thể tải video');
    } finally {
      setLoading(false);
    }
  };

  // IntersectionObserver for detecting active video
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

    const items = container.querySelectorAll('.short-item');
    items.forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, [locations]);

  const handleLike = async (locationId) => {
    const user = auth.currentUser;
    if (!user) return toast.error('Vui lòng đăng nhập');

    try {
      const locRef = doc(db, 'locations', locationId);
      const locSnap = await getDoc(locRef);
      const data = locSnap.data();
      const alreadyLiked = data.likedBy?.includes(user.uid);

      if (alreadyLiked) {
        await updateDoc(locRef, {
          likes: increment(-1),
          likedBy: arrayRemove(user.uid),
        });
      } else {
        await updateDoc(locRef, {
          likes: increment(1),
          likedBy: arrayUnion(user.uid),
        });
      }

      // Update local state
      setLocations(prev => prev.map(l => {
        if (l.id !== locationId) return l;
        const wasLiked = l.likedBy?.includes(user.uid);
        return {
          ...l,
          likes: (l.likes || 0) + (wasLiked ? -1 : 1),
          likedBy: wasLiked
            ? (l.likedBy || []).filter(uid => uid !== user.uid)
            : [...(l.likedBy || []), user.uid],
        };
      }));
    } catch (err) {
      console.error(err);
    }
  };

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
      <div className="shorts-root">
        <Navbar />

        {locations.length === 0 ? (
          <div className="shorts-empty">
            <div className="shorts-empty-icon">🎬</div>
            <h2>Chưa có Shorts nào</h2>
            <p>Thêm video ngắn khi tạo địa điểm mới để xuất hiện tại đây!</p>
            <Link href="/add-location" className="shorts-add-btn">
              ➕ Thêm địa điểm với video
            </Link>
          </div>
        ) : (
          <div className="shorts-container" ref={containerRef}>
            {locations.map((loc, idx) => (
              <div key={loc.id} data-index={idx}>
                <ShortItem
                  location={loc}
                  isActive={idx === activeIndex}
                  onLike={handleLike}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
