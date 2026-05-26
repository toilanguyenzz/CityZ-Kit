'use client';

import { useState, useEffect, useRef } from 'react';
import { auth, db, onAuthStateChanged } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { updateUserAvatar, updateUserProfile } from '@/lib/firestore';
import { compressAndToBase64 } from '@/lib/imageHelper';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import Badge from '@/components/Badge';
import toast from 'react-hot-toast';

export default function Profile() {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBio, setNewBio] = useState('');
  const [user, setUser] = useState(null);
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
      toast.success('Cập nhật avatar thành công!');
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
      toast.error('Lỗi cập nhật');
    }
  };

  const handleSaveBio = async () => {
    if (!user) return;
    try {
      await updateUserProfile(user.uid, { bio: newBio.trim() });
      setUserData(prev => ({ ...prev, bio: newBio.trim() }));
      setEditingBio(false);
      toast.success('Đã cập nhật bio!');
    } catch (err) {
      toast.error('Lỗi cập nhật');
    }
  };

  const displayName = userData?.name || user?.displayName || user?.email?.split('@')[0] || 'User';
  const initial = displayName.charAt(0).toUpperCase();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8f9fb' }}>
        <Navbar />
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  const hasBadges = userData?.badges && userData.badges.length > 0;

  return (
    <ProtectedRoute>
      <div style={{ minHeight: '100vh', background: '#f8f9fb' }}>
        <Navbar />

        {/* ── Profile Hero ── */}
        <div style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)',
          padding: '2.5rem 1rem 3.5rem',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse 500px 300px at 30% 50%, rgba(59,130,246,0.15), transparent)',
            pointerEvents: 'none',
          }} />
          <div style={{ maxWidth: '700px', margin: '0 auto', position: 'relative', textAlign: 'center' }}>
            {/* Avatar */}
            <div style={{ position: 'relative', display: 'inline-block', marginBottom: '1rem' }}>
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: '100px', height: '100px', borderRadius: '50%',
                  background: userData?.avatarUrl ? `url(${userData.avatarUrl}) center/cover` : 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: userData?.avatarUrl ? 0 : '2.5rem', fontWeight: 800,
                  cursor: 'pointer', border: '4px solid rgba(255,255,255,0.2)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                }}
                onMouseOver={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(59,130,246,0.4)'; }}
                onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)'; }}
              >
                {!userData?.avatarUrl && initial}
              </div>
              {/* Camera badge */}
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  position: 'absolute', bottom: '2px', right: '2px',
                  width: '30px', height: '30px', borderRadius: '50%',
                  background: '#3b82f6', border: '2px solid #1e1b4b',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', fontSize: '0.8rem',
                  transition: 'background 0.2s',
                }}
              >
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
                  background: 'rgba(0,0,0,0.5)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                </div>
              )}
            </div>

            {/* Name */}
            <div style={{ marginBottom: '0.25rem' }}>
              {editingName ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    style={{
                      background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                      color: '#fff', padding: '0.4rem 0.75rem', borderRadius: '0.5rem',
                      fontSize: '1.1rem', fontWeight: 700, textAlign: 'center', outline: 'none',
                    }}
                    autoFocus
                  />
                  <button onClick={handleSaveName} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '0.4rem 0.75rem', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>Lưu</button>
                  <button onClick={() => setEditingName(false)} style={{ background: 'rgba(255,255,255,0.1)', color: '#94a3b8', border: 'none', padding: '0.4rem 0.75rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>Hủy</button>
                </div>
              ) : (
                <h1
                  onClick={() => setEditingName(true)}
                  style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 800, margin: 0, cursor: 'pointer' }}
                  title="Nhấp để sửa tên"
                >
                  {displayName} ✏️
                </h1>
              )}
            </div>

            <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 0.75rem' }}>
              {userData?.email || user?.email}
            </p>

            {/* Bio */}
            {editingBio ? (
              <div style={{ maxWidth: '400px', margin: '0 auto' }}>
                <textarea
                  value={newBio}
                  onChange={(e) => setNewBio(e.target.value)}
                  placeholder="Giới thiệu bản thân..."
                  rows={2}
                  maxLength={150}
                  style={{
                    width: '100%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                    color: '#fff', padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
                    fontSize: '0.85rem', resize: 'none', outline: 'none', fontFamily: 'inherit',
                  }}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '0.4rem' }}>
                  <button onClick={handleSaveBio} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '0.35rem 0.75rem', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>Lưu</button>
                  <button onClick={() => setEditingBio(false)} style={{ background: 'rgba(255,255,255,0.1)', color: '#94a3b8', border: 'none', padding: '0.35rem 0.75rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}>Hủy</button>
                </div>
              </div>
            ) : (
              <p
                onClick={() => setEditingBio(true)}
                style={{
                  color: userData?.bio ? '#94a3b8' : '#475569',
                  fontSize: '0.85rem', margin: 0, cursor: 'pointer',
                  fontStyle: userData?.bio ? 'normal' : 'italic',
                }}
                title="Nhấp để thêm bio"
              >
                {userData?.bio || '+ Thêm giới thiệu bản thân'}
              </p>
            )}
          </div>
        </div>

        {/* ── Content ── */}
        <main style={{ maxWidth: '700px', margin: '-2rem auto 0', padding: '0 1rem 2rem', position: 'relative', zIndex: 2 }}>
          {/* Stats card */}
          <div style={{
            background: '#fff', borderRadius: '1rem', boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            padding: '1.25rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-around',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
                {userData?.badges?.length || 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>Danh hiệu</div>
            </div>
            <div style={{ width: '1px', background: '#f1f5f9' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
                {userData?.role === 'admin' ? '👑' : '🧑‍🎓'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>
                {userData?.role === 'admin' ? 'Admin' : 'Thành viên'}
              </div>
            </div>
            <div style={{ width: '1px', background: '#f1f5f9' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
                {userData?.createdAt ? new Date(userData.createdAt).toLocaleDateString('vi-VN') : '—'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>Tham gia</div>
            </div>
          </div>

          {/* Badges */}
          <div style={{
            background: '#fff', borderRadius: '1rem', boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            padding: '1.25rem',
          }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>
              🏅 Danh hiệu đã đạt được
            </h2>
            {!hasBadges ? (
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', textAlign: 'center', padding: '1.5rem 0' }}>
                Chưa có danh hiệu nào. Hãy tham gia đóng góp để nhận huy hiệu! 🎯
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem' }}>
                {userData.badges.map((badge, idx) => (
                  <Badge key={idx} name={badge.name} icon={badge.icon} />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
