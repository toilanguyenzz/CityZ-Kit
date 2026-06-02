'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getBuddyConnections } from '@/lib/firestore';
import Navbar from '@/components/Navbar';
import ProtectedRoute from '@/components/ProtectedRoute';
import useUserRole from '@/lib/useUserRole';

const TYPES = {
  roommate: { label: 'Tìm bạn ở ghép', icon: '🏠', gradient: 'from-green-400 to-emerald-500' },
  study_buddy: { label: 'Tìm bạn cùng học', icon: '📚', gradient: 'from-blue-400 to-indigo-500' },
  hobby: { label: 'Tìm bạn cùng sở thích', icon: '🎯', gradient: 'from-purple-400 to-pink-500' },
  marketplace: { label: 'Mua bán sản phẩm', icon: '🛍️', gradient: 'from-orange-400 to-red-500' },
};

function timeAgo(timestamp) {
  if (!timestamp) return '';
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  if (isNaN(date)) return '';
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút`;
  if (diffHours < 24) return `${diffHours} giờ`;
  if (diffDays < 7) return `${diffDays} ngày`;
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

export default function GlobalConversationsPage() {
  const router = useRouter();
  const { user, isSuperAdmin } = useUserRole();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'closed'
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'buddy' | 'market'

  useEffect(() => {
    if (!user) return;
    const fetchConversations = async () => {
      try {
        const conns = await getBuddyConnections(user.uid, isSuperAdmin);
        setConversations(conns);
      } catch (err) {
        console.error('Error fetching conversations:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchConversations();
  }, [user, isSuperAdmin]);

  // Filter conversations
  const filtered = conversations.filter(c => {
    // 1. Status Filter
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    
    // 2. Type Filter
    if (typeFilter === 'buddy') {
      return ['roommate', 'study_buddy', 'hobby'].includes(c.requestType);
    }
    if (typeFilter === 'market') {
      return c.requestType === 'marketplace';
    }
    return true;
  });

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount?.[user?.uid] || 0), 0);

  return (
    <ProtectedRoute>
      <Navbar />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto py-6 px-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">💬 Tin nhắn của tôi</h1>
              <p className="text-xs text-gray-500 mt-0.5">Hộp thư kết nối và mua bán sản phẩm</p>
            </div>
            {totalUnread > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                {totalUnread} tin nhắn mới
              </span>
            )}
          </div>

          {/* Type Filters */}
          <div className="flex gap-2 mb-4 bg-white p-1 rounded-xl border border-gray-100 shadow-sm">
            {[
              { key: 'all', label: 'Tất cả', emoji: '💬' },
              { key: 'buddy', label: 'Tìm bạn đồng hành', emoji: '🤝' },
              { key: 'market', label: 'Chợ đồ cũ', emoji: '🛍️' },
            ].map(tf => (
              <button
                key={tf.key}
                onClick={() => setTypeFilter(tf.key)}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 border-none cursor-pointer ${
                  typeFilter === tf.key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-transparent text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span>{tf.emoji}</span>
                <span>{tf.label}</span>
              </button>
            ))}
          </div>

          {/* Status Filters */}
          <div className="flex gap-2 mb-4">
            {[
              { key: 'all', label: 'Tất cả', count: conversations.length },
              { key: 'active', label: 'Đang chat', count: conversations.filter(c => c.status === 'active').length },
              { key: 'closed', label: 'Đã đóng', count: conversations.filter(c => c.status === 'closed').length },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition cursor-pointer border-none ${
                  statusFilter === f.key
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>

          {/* Conversations List */}
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
              <p className="text-5xl mb-4">💬</p>
              <p className="text-lg font-semibold text-gray-700">
                Không tìm thấy cuộc trò chuyện nào
              </p>
              <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">
                Hãy kết nối bạn đồng hành hoặc gửi tin nhắn hỏi mua sản phẩm ở Chợ để bắt đầu trò chuyện.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <button
                  onClick={() => router.push('/buddy-finder')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-xs font-semibold border-none cursor-pointer"
                >
                  🤝 Tìm bạn đồng hành
                </button>
                <button
                  onClick={() => router.push('/marketplace')}
                  className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition text-xs font-semibold border-none cursor-pointer"
                >
                  🛒 Ghé thăm Chợ
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {/* SuperAdmin warning header */}
              {isSuperAdmin && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-2">
                    <span>🛡️</span>
                    <div>
                      <p className="font-bold">Chế độ SuperAdmin (Kiểm soát toàn hệ thống)</p>
                      <p className="font-normal text-[10px] text-red-500">Bạn đang xem và quản lý tất cả cuộc trò chuyện của người dùng.</p>
                    </div>
                  </div>
                  <span className="bg-red-200 text-red-800 text-[9px] px-2 py-0.5 rounded-full uppercase font-bold">Quản trị</span>
                </div>
              )}

              {filtered.map(conv => {
                const isSuperAdminView = isSuperAdmin && !conv.participants?.includes(user?.uid);
                const otherUserId = conv.participants?.find(id => id !== user?.uid);
                const otherName = conv.participantNames?.[otherUserId] || 'Người dùng';
                const participantA = conv.participants?.[0];
                const participantB = conv.participants?.[1];
                const nameA = conv.participantNames?.[participantA] || 'User A';
                const nameB = conv.participantNames?.[participantB] || 'User B';
                const displayNameStr = isSuperAdminView ? `${nameA} và ${nameB}` : otherName;

                const unread = conv.unreadCount?.[user?.uid] || 0;
                const typeInfo = TYPES[conv.requestType] || TYPES.roommate;
                const isClosed = conv.status === 'closed';

                return (
                  <button
                    key={conv.id}
                    onClick={() => router.push(`/messages/${conv.id}`)}
                    className={`w-full text-left bg-white rounded-xl p-4 hover:shadow-md transition-all duration-200 border cursor-pointer ${
                      unread > 0 ? 'border-blue-200 bg-blue-50/30' : 'border-gray-100'
                    } ${isClosed ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${isSuperAdminView ? 'from-red-500 to-rose-600' : typeInfo.gradient} flex items-center justify-center text-white font-bold text-base shadow-inner`}>
                          {isSuperAdminView ? '👥' : otherName.charAt(0).toUpperCase()}
                        </div>
                        {unread > 0 && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow">
                            {unread > 9 ? '9+' : unread}
                          </div>
                        )}
                        {isClosed && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-gray-400 text-white text-[8px] rounded-full flex items-center justify-center border border-white">✕</div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <h3 className={`font-semibold text-gray-800 truncate ${unread > 0 ? 'text-gray-900 font-bold' : ''}`}>
                            {displayNameStr}
                          </h3>
                          <span className="text-[11px] text-gray-400 flex-shrink-0 ml-2">
                            {timeAgo(conv.lastMessageAt)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">
                            {typeInfo.icon} {conv.requestTitle}
                          </span>
                          <span className={`text-[9px] px-1 py-0.2 rounded font-bold uppercase ${
                            conv.requestType === 'marketplace' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'
                          }`}>
                            {conv.requestType === 'marketplace' ? 'Chợ đồ cũ' : 'Tìm Bạn'}
                          </span>
                        </div>
                        <p className={`text-sm truncate ${unread > 0 ? 'text-gray-800 font-semibold' : 'text-gray-500'}`}>
                          {conv.lastMessage || 'Chưa có tin nhắn'}
                        </p>
                      </div>

                      {/* Chevron */}
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
