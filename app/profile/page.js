'use client';

import '@/app/styles/profile.css';
import { useState, useEffect, useRef } from 'react';
import { auth, db, onAuthStateChanged } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { updateUserAvatar, updateUserProfile, getUserStats, calculateXPFromStats, getLevelFromXP } from '@/lib/firestore';
import { compressAndToBase64 } from '@/lib/imageHelper';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import toast from 'react-hot-toast';

const ALL_BADGES = [
  { name: 'Explorer', icon: '🧭', desc: 'Thêm ≥1 địa điểm', color: '#3b82f6' },
  { name: 'Helper', icon: '🤝', desc: 'Viết ≥3 đánh giá', color: '#22c55e' },
  { name: 'Influencer', icon: '⭐', desc: 'Đăng ≥1 bài viết', color: '#8b5cf6' },
  { name: 'Trailblazer', icon: '🗺️', desc: 'Thêm ≥5 địa điểm', color: '#f59e0b' },
  { name: 'Critic', icon: '📝', desc: 'Viết ≥10 đánh giá', color: '#ef4444' },
  { name: 'Blogger', icon: '📰', desc: 'Đăng ≥5 bài viết', color: '#06b6d4' },
];

function CountUp({ end, duration = 1000 }) {
  const [value, setValue] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    if (end === 0) { setValue(0); return; }
    let start = 0;
    const startTime = performance.now();
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(Math.round(eased * end));
      if (progress < 1) {
        ref.current = requestAnimationFrame(animate);
      }
    };
    ref.current = requestAnimationFrame(animate);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [end, duration]);

  return <span className="pf-countup">{value}</span>;
}

export default function Profile() {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBio, setNewBio] = useState('');
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ locationCount: 0, reviewCount: 0, postCount: 0, totalUpvotes: 0 });
  const [xpAnimated, setXpAnimated] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const docRef = doc(db, 'users', u.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserData(data);
            setNewName(data.name || u.displayName || '');
            setNewBio(data.bio || '');
          } else {
            toast.error('Không tìm thấy thông tin tài khoản');
          }

          // Fetch real stats
          const userStats = await getUserStats(u.uid);
          setStats(userStats);

          // Trigger progress bar animation
          setTimeout(() => setXpAnimated(true), 350);
        } catch (error) {
          toast.error('Lỗi khi tải hồ sơ');
          console.error(error);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ảnh quá lớn! Tối đa 5MB');
      return;
    }

    setUploading(true);
    try {
      const base64 = await compressAndToBase64(file, 300, 300, 0.7);
      await updateUserAvatar(user.uid, base64);
      setUserData(prev => ({ ...prev, avatarUrl: base64 }));
      toast.success('Cập nhật ảnh đại diện thành công!');
    } catch (err) {
      toast.error('Lỗi tải ảnh: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSaveName = async () => {
    if (!user || !newName.trim()) return;
    try {
      await updateUserProfile(user.uid, { name: newName.trim() });
      setUserData(prev => ({ ...prev, name: newName.trim() }));
      setEditingName(false);
      toast.success('Đã cập nhật tên!');
    } catch (err) {
      toast.error('Lỗi cập nhật tên');
    }
  };

  const handleSaveBio = async () => {
    if (!user) return;
    try {
      await updateUserProfile(user.uid, { bio: newBio.trim() });
      setUserData(prev => ({ ...prev, bio: newBio.trim() }));
      setEditingBio(false);
      toast.success('Đã cập nhật giới thiệu!');
    } catch (err) {
      toast.error('Lỗi cập nhật giới thiệu');
    }
  };

  const displayName = userData?.name || user?.displayName || user?.email?.split('@')[0] || 'Thành viên';
  const initial = displayName.charAt(0).toUpperCase();

  if (loading) {
    return (
      <div className="pf-root">
        <Navbar />
        <div style={{ display: 'flex', justifyContent: 'center', padding: '6rem 0' }}>
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  const xp = calculateXPFromStats(stats);
  const levelInfo = getLevelFromXP(xp);
  const earnedBadgeNames = (userData?.badges || []).map(b => b.name);

  return (
    <ProtectedRoute>
      <div className="pf-root">
        <Navbar />

        <div className="pf-container">
          {/* Cover Photo */}
          <div className="pf-cover">
            <div className="pf-cover-shimmer" />
          </div>

          {/* Profile Header Block */}
          <div className="pf-header-wrap">
            {/* Avatar Box */}
            <div className="pf-avatar-box">
              <div
                className="pf-avatar"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  backgroundImage: userData?.avatarUrl ? `url(${userData.avatarUrl})` : 'none',
                  fontSize: userData?.avatarUrl ? 0 : undefined,
                }}
              >
                {!userData?.avatarUrl && initial}
              </div>
              <div className="pf-avatar-upload-btn" onClick={() => fileInputRef.current?.click()} title="Đổi ảnh đại diện">
                📷
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                style={{ display: 'none' }}
              />
              {uploading && (
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.4)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                </div>
              )}
            </div>

            {/* Info Section */}
            <div className="pf-info-box">
              <div className="pf-meta-row">
                {editingName ? (
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="pf-edit-input"
                      autoFocus
                    />
                    <button onClick={handleSaveName} className="pf-btn-save">Lưu</button>
                    <button onClick={() => setEditingName(false)} className="pf-btn-cancel">Hủy</button>
                  </div>
                ) : (
                  <h1 className="pf-name" onClick={() => setEditingName(true)} title="Nhấp để đổi tên">
                    {displayName} ✏️
                  </h1>
                )}

                <span className="pf-level-badge" title={`${levelInfo.name} (Đạt được ${xp} XP)`}>
                  {levelInfo.icon} Level {levelInfo.level} ({levelInfo.name})
                </span>

                {!editingName && !editingBio && (
                  <button className="pf-btn-edit" onClick={() => setEditingBio(true)}>
                    Chỉnh sửa tiểu sử
                  </button>
                )}
              </div>

              {/* Stats Row */}
              <ul className="pf-stats-row">
                <li className="pf-stat-item">
                  <span className="pf-stat-val"><CountUp end={stats.locationCount} /></span> địa điểm
                </li>
                <li className="pf-stat-item">
                  <span className="pf-stat-val"><CountUp end={stats.postCount} /></span> bài viết
                </li>
                <li className="pf-stat-item">
                  <span className="pf-stat-val"><CountUp end={stats.reviewCount} /></span> đánh giá
                </li>
                <li className="pf-stat-item" title={`Chi tiết: Địa điểm x50 XP, Bài viết x30 XP, Đánh giá x20 XP, Upvotes x5 XP`}>
                  <span className="pf-stat-val"><CountUp end={xp} /></span> XP tích lũy
                </li>
              </ul>

              {/* Bio Box */}
              <div className="pf-bio-box">
                <div className="pf-email">{userData?.email || user?.email}</div>
                {editingBio ? (
                  <div>
                    <textarea
                      value={newBio}
                      onChange={(e) => setNewBio(e.target.value)}
                      placeholder="Viết một vài mô tả ngắn về bạn..."
                      rows={2}
                      maxLength={150}
                      className="pf-edit-textarea"
                      autoFocus
                    />
                    <div className="pf-edit-actions">
                      <button onClick={handleSaveBio} className="pf-btn-save">Lưu</button>
                      <button onClick={() => setEditingBio(false)} className="pf-btn-cancel">Hủy</button>
                    </div>
                  </div>
                ) : (
                  <p
                    className={`pf-bio-text ${!userData?.bio ? 'pf-bio-placeholder' : ''}`}
                    onClick={() => setEditingBio(true)}
                    title="Nhấp để thêm tiểu sử"
                  >
                    {userData?.bio || '+ Thêm giới thiệu ngắn để mọi người hiểu hơn về bạn'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* XP Progress Bar Section */}
          <div className="pf-xp-section">
            <div className="pf-xp-info">
              {levelInfo.nextLevel ? (
                <>
                  <span>Tiến trình cấp độ: {Math.round(levelInfo.progress)}%</span>
                  <span>Còn {levelInfo.xpToNext} XP đến Level {levelInfo.nextLevel.level}</span>
                </>
              ) : (
                <span>🎉 Bạn đã đạt cấp độ tối đa (Huyền thoại)</span>
              )}
            </div>
            <div className="pf-xp-bar-bg">
              <div
                className="pf-xp-bar-fill"
                style={{
                  width: xpAnimated ? `${levelInfo.progress}%` : '0%',
                }}
              />
            </div>
          </div>

          <div className="pf-section-divider" />

          {/* Badges Story Highlight Section */}
          <div className="pf-badges-wrap">
            <h2 className="pf-section-title">🏆 Danh hiệu cộng đồng ({earnedBadgeNames.length}/{ALL_BADGES.length})</h2>
            <div className="pf-badge-row">
              {ALL_BADGES.map((badge) => {
                const isUnlocked = earnedBadgeNames.includes(badge.name);
                return (
                  <div
                    key={badge.name}
                    className={`pf-badge-item ${isUnlocked ? 'pf-badge-item-unlocked' : 'pf-badge-item-locked'}`}
                    style={{ '--badge-color': badge.color }}
                  >
                    <div className="pf-badge-circle" title={isUnlocked ? `Đã mở khóa: ${badge.desc}` : `Chưa mở khóa: ${badge.desc}`}>
                      <span>{badge.icon}</span>
                      {!isUnlocked && <span className="pf-badge-lock-icon">🔒</span>}
                    </div>
                    <span className="pf-badge-label">{badge.name}</span>
                    <span className="pf-badge-desc">{badge.desc}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Join Date & Meta information */}
          <div className="pf-footer-meta">
            <div className="pf-meta-item">
              <span>📅</span>
              <span>Đã tham gia: <strong>{userData?.createdAt ? new Date(userData.createdAt).toLocaleDateString('vi-VN') : '—'}</strong></span>
            </div>
            <div className="pf-meta-item">
              <span>👤</span>
              <span>Vai trò: <strong>{userData?.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}</strong></span>
            </div>
          </div>

        </div>
      </div>
    </ProtectedRoute>
  );
}
