'use client';

import '@/app/styles/admin.css';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import ProtectedRoute from '@/components/ProtectedRoute';
import useUserRole from '@/lib/useUserRole';
import { getPendingLocations, getPendingPosts, getPendingBuddyRequests, moderateItem, getUserProfile, getOnlineUsers, getUserCounts } from '@/lib/firestore';
import toast from 'react-hot-toast';

export default function AdminPage() {
  const router = useRouter();
  const { isAdmin, isSuperAdmin, adminLevel, loading: roleLoading } = useUserRole();
  const [activeTab, setActiveTab] = useState('locations');
  const [pendingLocations, setPendingLocations] = useState([]);
  const [pendingPosts, setPendingPosts] = useState([]);
  const [pendingBuddyRequests, setPendingBuddyRequests] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [userCounts, setUserCounts] = useState({ totalUsers: 0, onlineCount: 0 });
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roleLoading && isAdmin) {
      fetchPendingItems();
    }
  }, [roleLoading, isAdmin]);

  // Auto-refresh online users every 30 seconds when tab is active
  useEffect(() => {
    if (!isSuperAdmin || activeTab !== 'users') return;
    fetchOnlineUsers();
    const interval = setInterval(fetchOnlineUsers, 30000);
    return () => clearInterval(interval);
  }, [isSuperAdmin, activeTab]);

  const fetchOnlineUsers = async () => {
    setLoadingUsers(true);
    try {
      const [users, counts] = await Promise.all([
        getOnlineUsers(),
        getUserCounts(),
      ]);
      setOnlineUsers(users);
      setUserCounts(counts);
    } catch (err) {
      console.error('Error fetching online users:', err);
      toast.error('Lỗi khi tải danh sách users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchPendingItems = async () => {
    setLoading(true);
    try {
      const [locations, posts, buddyReqs] = await Promise.all([
        getPendingLocations(),
        getPendingPosts(),
        getPendingBuddyRequests(),
      ]);

      // Thu thập tất cả userId của người đăng
      const userIds = new Set();
      locations.forEach(loc => {
        if (loc.createdBy) userIds.add(loc.createdBy);
      });
      posts.forEach(post => {
        if (post.userId) userIds.add(post.userId);
      });
      buddyReqs.forEach(req => {
        if (req.userId) userIds.add(req.userId);
      });

      // Tải song song thông tin profile của từng người dùng từ Firestore
      const profileMap = {};
      await Promise.all(
        Array.from(userIds).map(async (uid) => {
          try {
            const profile = await getUserProfile(uid);
            if (profile) {
              profileMap[uid] = profile;
            }
          } catch (err) {
            console.error(`Lỗi tải profile user ${uid}:`, err);
          }
        })
      );

      // Gắn thông tin profile vào từng item chờ duyệt
      const locationsWithAuthor = locations.map(loc => ({
        ...loc,
        authorProfile: profileMap[loc.createdBy] || null
      }));

      const postsWithAuthor = posts.map(post => ({
        ...post,
        authorProfile: profileMap[post.userId] || null
      }));

      const buddyReqsWithAuthor = buddyReqs.map(req => ({
        ...req,
        authorProfile: profileMap[req.userId] || null
      }));

      setPendingLocations(locationsWithAuthor);
      setPendingPosts(postsWithAuthor);
      setPendingBuddyRequests(buddyReqsWithAuthor);
    } catch (error) {
      toast.error('Lỗi khi tải dữ liệu chờ duyệt');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleModerate = async (collectionName, docId, newStatus) => {
    try {
      // Buddy requests sử dụng 'open' thay vì 'approved'
      const finalStatus = (collectionName === 'buddyRequests' && newStatus === 'approved') ? 'open' : newStatus;
      await moderateItem(collectionName, docId, finalStatus);
      toast.success(newStatus === 'approved' ? '✅ Đã duyệt!' : '❌ Đã từ chối!');
      // Remove from local state
      if (collectionName === 'locations') {
        setPendingLocations(prev => prev.filter(l => l.id !== docId));
      } else if (collectionName === 'buddyRequests') {
        // Khi approve buddy request, đổi status thành 'open'
        setPendingBuddyRequests(prev => prev.filter(r => r.id !== docId));
      } else {
        setPendingPosts(prev => prev.filter(p => p.id !== docId));
      }
    } catch (error) {
      toast.error('Lỗi xử lý: ' + error.message);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTimeAgo = (dateInput) => {
    if (!dateInput) return 'Chưa hoạt động';
    const date = dateInput?.toDate ? dateInput.toDate() : new Date(dateInput);
    const now = new Date();
    const diffMs = now - date;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'vừa xong';
    if (mins < 60) return `${mins} phút trước`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} ngày trước`;
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCategoryLabel = (cat) => {
    switch (cat) {
      case 'Food': return '🍜 Ăn uống';
      case 'Housing': return '🏠 Nhà trọ';
      case 'Cafe': return '☕ Cafe';
      case 'Play': return '🎡 Vui chơi';
      case 'Other': return '🏷️ Khác';
      default: return cat;
    }
  };

  // Loading state
  if (roleLoading) {
    return (
      <ProtectedRoute>
        <div className="admin-root">
          <Navbar />
          <div className="db-loading" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="db-spinner" style={{ width: 48, height: 48, border: '4px solid #e2e8f0', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'dbSpin 0.8s linear infinite' }}></div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  // Access denied for non-admin
  if (!isAdmin) {
    return (
      <ProtectedRoute>
        <div className="admin-root">
          <Navbar />
          <div className="admin-denied">
            <div className="admin-denied-icon">🚫</div>
            <h1 className="admin-denied-title">Không có quyền truy cập</h1>
            <p className="admin-denied-desc">
              Trang này chỉ dành cho Admin. Nếu bạn nghĩ đây là lỗi, hãy liên hệ quản trị viên.
            </p>
            <Link href="/dashboard" className="admin-denied-btn">
              ← Quay về Dashboard
            </Link>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  const getBuddyTypeLabel = (type) => {
    switch (type) {
      case 'roommate': return '🏠 Tìm bạn ở ghép';
      case 'study_buddy': return '📚 Tìm bạn cùng học';
      case 'hobby': return '🎯 Tìm bạn cùng sở thích';
      default: return type;
    }
  };

  const currentItems = activeTab === 'locations' ? pendingLocations : activeTab === 'posts' ? pendingPosts : pendingBuddyRequests;
  const currentCollection = activeTab === 'locations' ? 'locations' : activeTab === 'posts' ? 'posts' : 'buddyRequests';

  return (
    <ProtectedRoute>
      <div className="admin-root">
        <Navbar />

        {/* Header */}
        <section className="admin-header">
          <div className="admin-header-inner">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h1 className="admin-title">
                  <span>🛡️</span> Trang Quản trị
                </h1>
                <p className="admin-subtitle">
                  Kiểm duyệt nội dung từ cộng đồng sinh viên
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                <span style={{ background: adminLevel === 1 ? 'linear-gradient(135deg, #f59e0b, #ef4444)' : '#8b5cf6', color: 'white', padding: '4px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 700 }}>
                  {adminLevel === 1 ? '⭐ Super Admin' : '🛡️ Admin'}
                </span>
                {isSuperAdmin && (
                  <span style={{ color: '#c4b5fd', fontSize: '12px' }}>
                    👥 {userCounts.onlineCount} online / {userCounts.totalUsers} users
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Tabs */}
        <div className="admin-tabs">
          <button
            className={`admin-tab ${activeTab === 'locations' ? 'active' : ''}`}
            onClick={() => setActiveTab('locations')}
          >
            📍 Địa điểm
            {pendingLocations.length > 0 && (
              <span className="admin-tab-count">{pendingLocations.length}</span>
            )}
          </button>
          <button
            className={`admin-tab ${activeTab === 'posts' ? 'active' : ''}`}
            onClick={() => setActiveTab('posts')}
          >
            📝 Bài viết
            {pendingPosts.length > 0 && (
              <span className="admin-tab-count">{pendingPosts.length}</span>
            )}
          </button>
          <button
            className={`admin-tab ${activeTab === 'buddy' ? 'active' : ''}`}
            onClick={() => setActiveTab('buddy')}
          >
            🤝 Tìm bạn
            {pendingBuddyRequests.length > 0 && (
              <span className="admin-tab-count">{pendingBuddyRequests.length}</span>
            )}
          </button>
          {isSuperAdmin && (
            <button
              className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              👥 Users Online
              {userCounts.onlineCount > 0 && (
                <span className="admin-tab-count" style={{ background: '#10b981' }}>{userCounts.onlineCount}</span>
              )}
            </button>
          )}
        </div>

        {/* Content */}
        <div className="admin-content">
          {/* ═══ Users Online Tab (Super Admin only) ═══ */}
          {activeTab === 'users' && isSuperAdmin ? (
            <div style={{ padding: '1.5rem 0' }}>
              {/* Stats bar */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '140px', background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', border: '1px solid #a7f3d0', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#059669' }}>{userCounts.onlineCount}</div>
                  <div style={{ fontSize: '12px', color: '#047857', fontWeight: 600 }}>🟢 Đang online</div>
                </div>
                <div style={{ flex: 1, minWidth: '140px', background: 'linear-gradient(135deg, #f0f9ff, #dbeafe)', border: '1px solid #93c5fd', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#2563eb' }}>{userCounts.totalUsers}</div>
                  <div style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: 600 }}>👥 Tổng users</div>
                </div>
                <div style={{ flex: 1, minWidth: '140px', background: 'linear-gradient(135deg, #fdf4ff, #f3e8ff)', border: '1px solid #d8b4fe', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#7c3aed' }}>{userCounts.totalUsers > 0 ? Math.round(userCounts.onlineCount / userCounts.totalUsers * 100) : 0}%</div>
                  <div style={{ fontSize: '12px', color: '#6d28d9', fontWeight: 600 }}>📈 Tỷ lệ online</div>
                </div>
              </div>

              {/* Refresh button */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>👥 Danh sách Users ({onlineUsers.length})</h3>
                <button
                  onClick={fetchOnlineUsers}
                  disabled={loadingUsers}
                  style={{ padding: '6px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, border: '1px solid #e2e8f0', background: loadingUsers ? '#f1f5f9' : '#fff', color: '#64748b', cursor: loadingUsers ? 'wait' : 'pointer', transition: 'all 0.2s' }}
                >
                  {loadingUsers ? 'Đang tải...' : '🔄 Làm mới'}
                </button>
              </div>

              {/* Users list */}
              {loadingUsers && onlineUsers.length === 0 ? (
                <div className="admin-empty">
                  <div className="db-spinner" style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTopColor: '#10b981', borderRadius: '50%', animation: 'dbSpin 0.8s linear infinite', margin: '0 auto' }}></div>
                  <p style={{ marginTop: '1rem', color: '#64748b' }}>Đang tải danh sách users...</p>
                </div>
              ) : onlineUsers.length === 0 ? (
                <div className="admin-empty">
                  <div className="admin-empty-icon">👤</div>
                  <h3 className="admin-empty-title">Chưa có user nào</h3>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '8px' }}>
                  {onlineUsers.map(u => (
                    <div
                      key={u.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '12px 16px', borderRadius: '12px',
                        border: `1px solid ${u.isOnline ? '#a7f3d0' : '#f1f5f9'}`,
                        background: u.isOnline ? '#f0fdf4' : '#fafafa',
                        transition: 'all 0.2s',
                      }}
                    >
                      {/* Avatar */}
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <div style={{
                          width: 42, height: 42, borderRadius: '50%',
                          background: u.avatarUrl ? 'transparent' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'white', fontWeight: 700, fontSize: '16px',
                          overflow: 'hidden', border: `2px solid ${u.isOnline ? '#10b981' : '#e2e8f0'}`,
                        }}>
                          {u.avatarUrl ? (
                            <img src={u.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            (u.name || u.email || '?').charAt(0).toUpperCase()
                          )}
                        </div>
                        {/* Online indicator dot */}
                        <div style={{
                          position: 'absolute', bottom: 0, right: 0,
                          width: 12, height: 12, borderRadius: '50%',
                          background: u.isOnline ? '#10b981' : '#94a3b8',
                          border: '2px solid white',
                        }} />
                      </div>

                      {/* User info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                          <Link
                            href={`/profile?uid=${u.id}`}
                            style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a', textDecoration: 'none' }}
                          >
                            {u.name || u.email || 'User ẩn danh'}
                          </Link>
                          {u.role === 'admin' && (
                            <span style={{
                              fontSize: '10px', fontWeight: 700,
                              background: u.adminLevel === 1 ? 'linear-gradient(135deg, #f59e0b, #ef4444)' : '#8b5cf6',
                              color: 'white', padding: '1px 6px', borderRadius: '999px',
                            }}>
                              {u.adminLevel === 1 ? 'Super Admin' : 'Admin'}
                            </span>
                          )}
                          <span style={{
                            fontSize: '10px', fontWeight: 600,
                            color: u.isOnline ? '#059669' : '#94a3b8',
                          }}>
                            {u.isOnline ? '🟢 Online' : '⚪ Offline'}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {u.email && <span>📧 {u.email}</span>}
                          <span>🕒 {u.lastActive ? formatTimeAgo(u.lastActive) : 'Chưa hoạt động'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Auto-refresh notice */}
              <div style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8', fontSize: '12px' }}>
                🔄 Tự động làm mới mỗi 30 giây
              </div>
            </div>
          ) : loading ? (
            <div className="admin-empty">
              <div className="db-spinner" style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'dbSpin 0.8s linear infinite', margin: '0 auto' }}></div>
              <p style={{ marginTop: '1rem', color: '#64748b' }}>Đang tải...</p>
            </div>
          ) : currentItems.length === 0 ? (
            <div className="admin-empty">
              <div className="admin-empty-icon">🎉</div>
              <h3 className="admin-empty-title">Không có nội dung chờ duyệt</h3>
              <p>Tất cả {activeTab === 'locations' ? 'địa điểm' : activeTab === 'posts' ? 'bài viết' : 'yêu cầu tìm bạn'} đã được xử lý!</p>
            </div>
          ) : (
            <div>
              {currentItems.map((item) => {
                const authorId = activeTab === 'locations' ? item.createdBy : item.userId;
                const authorProfile = item.authorProfile;
                
                // Fallbacks cho avatar và tên hiển thị đối với admin
                const authorName = activeTab === 'locations'
                  ? (authorProfile?.name || item.createdByName || 'Người dùng ẩn danh')
                  : (authorProfile?.name || item.realAuthorName || item.authorName || item.userName || 'Người dùng ẩn danh');
                
                const authorAvatar = activeTab === 'locations'
                  ? (authorProfile?.avatarUrl || item.createdByAvatar)
                  : (authorProfile?.avatarUrl || item.authorAvatar);

                // Buddy request specific info
                const isBuddyTab = activeTab === 'buddy';
                const itemTitle = isBuddyTab
                  ? `🎓 ${item.university || 'Chưa rõ trường'}`
                  : (activeTab === 'locations' ? item.name : item.title);

                return (
                  <div key={item.id} className="admin-item">
                    {/* Auto-moderation flags */}
                    {item.moderationFlags?.length > 0 && (
                      <div style={{ marginBottom: '12px', padding: '10px 14px', background: '#fef3c7', borderRadius: '8px', border: '1px solid #fcd34d' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#92400e', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          🤖 Auto-Moderation đã phát hiện:
                          {item.riskScore && (
                            <span style={{ background: item.riskScore >= 50 ? '#ef4444' : '#f59e0b', color: 'white', padding: '1px 8px', borderRadius: '9999px', fontSize: '11px' }}>
                              Risk: {item.riskScore}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: '#a16207' }}>
                          {item.moderationFlags.map((flag, i) => (
                            <div key={i}>• {flag}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="admin-item-info">
                      <h3>{itemTitle}</h3>
                      <div className="admin-item-meta">
                        {activeTab === 'locations' && (
                          <>
                            <span>🏷️ {getCategoryLabel(item.category)}</span>
                            <span>📍 {item.address}</span>
                          </>
                        )}
                        {activeTab === 'posts' && (
                          <span>
                            ✍️ Hiển thị: {item.authorName}{' '}
                            {item.isAnonymous && (
                              <span style={{ color: '#ef4444', fontWeight: 600 }}>
                                (Ẩn danh)
                              </span>
                            )}
                          </span>
                        )}
                        {isBuddyTab && (
                          <>
                            <span>{getBuddyTypeLabel(item.type)}</span>
                            <span>👤 Bởi: {item.userName || 'Ẩn danh'}</span>
                          </>
                        )}
                        <span>📅 {formatDate(item.createdAt)}</span>
                      </div>
                      {/* Content preview */}
                      {isBuddyTab ? (
                        <>
                          {item.note && <p className="admin-item-preview">📝 "{item.note}"</p>}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                            {(item.habits || []).map(h => <span key={h} style={{ fontSize: '11px', background: '#dbeafe', color: '#2563eb', padding: '2px 8px', borderRadius: '9999px' }}>{h}</span>)}
                            {(item.interests || []).map(i => <span key={i} style={{ fontSize: '11px', background: '#f3e8ff', color: '#7c3aed', padding: '2px 8px', borderRadius: '9999px' }}>{i}</span>)}
                          </div>
                        </>
                      ) : (
                        <p className="admin-item-preview">
                          {activeTab === 'locations' ? item.description : item.content}
                        </p>
                      )}

                      {/* Thông tin người đăng hiển thị cụ thể cho Admin */}
                      {authorId && (
                        <div className="admin-item-author">
                          <div className="admin-author-avatar-wrapper">
                            {authorAvatar ? (
                              <img src={authorAvatar} className="admin-author-avatar" alt="avatar" />
                            ) : (
                              <span>{authorName.charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="admin-author-info">
                            <div className="admin-author-row">
                              <span className="admin-author-label">Người đăng:</span>
                              <Link 
                                href={`/profile?uid=${authorId}`} 
                                className="admin-author-name-link"
                              >
                                {authorName}
                              </Link>
                              {activeTab === 'posts' && item.isAnonymous && (
                                <span className="admin-badge-anon" title="Bài viết này hiển thị ẩn danh với người dùng thông thường">
                                  🕵️ Đăng ẩn danh
                                </span>
                              )}
                            </div>
                            <div className="admin-author-meta">
                              {authorProfile?.email && (
                                <span className="admin-author-email">📧 {authorProfile.email}</span>
                              )}
                              <span className="admin-author-role">
                                🔑 Quyền: {authorProfile?.role === 'admin' ? 'Quản trị viên' : 'Sinh viên'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="admin-actions">
                      <button
                        className="admin-btn admin-btn-approve"
                        onClick={() => handleModerate(currentCollection, item.id, 'approved')}
                      >
                        ✅ Duyệt
                      </button>
                      <button
                        className="admin-btn admin-btn-reject"
                        onClick={() => handleModerate(currentCollection, item.id, 'rejected')}
                      >
                        ❌ Từ chối
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
