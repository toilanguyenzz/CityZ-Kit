'use client';

import '@/app/styles/admin.css';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import ProtectedRoute from '@/components/ProtectedRoute';
import useUserRole from '@/lib/useUserRole';
import { getPendingLocations, getPendingPosts, moderateItem } from '@/lib/firestore';
import toast from 'react-hot-toast';

export default function AdminPage() {
  const router = useRouter();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [activeTab, setActiveTab] = useState('locations');
  const [pendingLocations, setPendingLocations] = useState([]);
  const [pendingPosts, setPendingPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roleLoading && isAdmin) {
      fetchPendingItems();
    }
  }, [roleLoading, isAdmin]);

  const fetchPendingItems = async () => {
    setLoading(true);
    try {
      const [locations, posts] = await Promise.all([
        getPendingLocations(),
        getPendingPosts(),
      ]);
      setPendingLocations(locations);
      setPendingPosts(posts);
    } catch (error) {
      toast.error('Lỗi khi tải dữ liệu chờ duyệt');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleModerate = async (collectionName, docId, newStatus) => {
    try {
      await moderateItem(collectionName, docId, newStatus);
      toast.success(newStatus === 'approved' ? '✅ Đã duyệt!' : '❌ Đã từ chối!');
      // Remove from local state
      if (collectionName === 'locations') {
        setPendingLocations(prev => prev.filter(l => l.id !== docId));
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

  const currentItems = activeTab === 'locations' ? pendingLocations : pendingPosts;
  const currentCollection = activeTab === 'locations' ? 'locations' : 'posts';

  return (
    <ProtectedRoute>
      <div className="admin-root">
        <Navbar />

        {/* Header */}
        <section className="admin-header">
          <div className="admin-header-inner">
            <h1 className="admin-title">
              <span>🛡️</span> Trang Quản trị
            </h1>
            <p className="admin-subtitle">
              Kiểm duyệt nội dung từ cộng đồng sinh viên
            </p>
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
        </div>

        {/* Content */}
        <div className="admin-content">
          {loading ? (
            <div className="admin-empty">
              <div className="db-spinner" style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'dbSpin 0.8s linear infinite', margin: '0 auto' }}></div>
              <p style={{ marginTop: '1rem', color: '#64748b' }}>Đang tải...</p>
            </div>
          ) : currentItems.length === 0 ? (
            <div className="admin-empty">
              <div className="admin-empty-icon">🎉</div>
              <h3 className="admin-empty-title">Không có nội dung chờ duyệt</h3>
              <p>Tất cả {activeTab === 'locations' ? 'địa điểm' : 'bài viết'} đã được xử lý!</p>
            </div>
          ) : (
            <div>
              {currentItems.map((item) => (
                <div key={item.id} className="admin-item">
                  <div className="admin-item-info">
                    <h3>{activeTab === 'locations' ? item.name : item.title}</h3>
                    <div className="admin-item-meta">
                      {activeTab === 'locations' && (
                        <>
                          <span>🏷️ {getCategoryLabel(item.category)}</span>
                          <span>📍 {item.address}</span>
                        </>
                      )}
                      {activeTab === 'posts' && (
                        <span>✍️ {item.authorName}</span>
                      )}
                      <span>📅 {formatDate(item.createdAt)}</span>
                    </div>
                    <p className="admin-item-preview">
                      {activeTab === 'locations' ? item.description : item.content}
                    </p>
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
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
