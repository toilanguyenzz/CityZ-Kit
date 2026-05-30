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

export default function ConversationsPage() {
  const router = useRouter();
  const { user } = useUserRole();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'active' | 'closed'

  useEffect(() => {
    if (!user) return;
    const fetchConversations = async () => {
      try {
        const conns = await getBuddyConnections(user.uid);
        setConversations(conns);
      } catch (err) {
        console.error('Error fetching conversations:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchConversations();
  }, [user]);

  const filtered = filter === 'all'
    ? conversations
    : conversations.filter(c => c.status === filter);

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount?.[user?.uid] || 0), 0);

  return (
    <ProtectedRoute>
      <Navbar />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto py-6 px-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/buddy-finder')}
                className="p-2 hover:bg-gray-200 rounded-full transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">💬 Tin nhắn</h1>
                {totalUnread > 0 && (
                  <p className="text-sm text-blue-600 font-medium">{totalUnread} tin nhắn chưa đọc</p>
                )}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-2 mb-4">
            {[
              { key: 'all', label: 'Tất cả', count: conversations.length },
              { key: 'active', label: 'Đang hoạt động', count: conversations.filter(c => c.status === 'active').length },
              { key: 'closed', label: 'Đã đóng', count: conversations.filter(c => c.status === 'closed').length },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                  filter === f.key
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
            <div className="text-center py-20">
              <p className="text-5xl mb-4">💬</p>
              <p className="text-lg font-medium text-gray-500">
                {filter === 'all' ? 'Chưa có cuộc trò chuyện nào' : `Không có cuộc trò chuyện ${filter === 'active' ? 'đang hoạt động' : 'đã đóng'}`}
              </p>
              <p className="text-sm text-gray-400 mt-1">Hãy bấm "Kết nối ngay" trên trang Tìm bạn để bắt đầu!</p>
              <button
                onClick={() => router.push('/buddy-finder')}
                className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
              >
                🤝 Tìm bạn đồng hành
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(conv => {
                const otherUserId = conv.participants?.find(id => id !== user?.uid);
                const otherName = conv.participantNames?.[otherUserId] || 'Người dùng';
                const unread = conv.unreadCount?.[user?.uid] || 0;
                const typeInfo = TYPES[conv.requestType] || TYPES.roommate;
                const isClosed = conv.status === 'closed';

                return (
                  <button
                    key={conv.id}
                    onClick={() => router.push(`/buddy-finder/chat/${conv.id}`)}
                    className={`w-full text-left bg-white rounded-xl p-4 hover:shadow-md transition-all duration-200 border ${
                      unread > 0 ? 'border-blue-200 bg-blue-50/30' : 'border-gray-100'
                    } ${isClosed ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${typeInfo.gradient} flex items-center justify-center text-white font-bold text-base`}>
                          {otherName.charAt(0).toUpperCase()}
                        </div>
                        {unread > 0 && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow">
                            {unread > 9 ? '9+' : unread}
                          </div>
                        )}
                        {isClosed && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-gray-400 text-white text-[8px] rounded-full flex items-center justify-center">✕</div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <h3 className={`font-semibold text-gray-800 truncate ${unread > 0 ? 'text-gray-900' : ''}`}>
                            {otherName}
                          </h3>
                          <span className="text-[11px] text-gray-400 flex-shrink-0 ml-2">
                            {timeAgo(conv.lastMessageAt)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                            {typeInfo.icon} {conv.requestTitle}
                          </span>
                        </div>
                        <p className={`text-sm truncate ${unread > 0 ? 'text-gray-800 font-medium' : 'text-gray-500'}`}>
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
