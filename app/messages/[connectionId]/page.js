'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { sendBuddyChatMessage, markBuddyChatAsRead, closeBuddyConnection } from '@/lib/firestore';
import Navbar from '@/components/Navbar';
import ProtectedRoute from '@/components/ProtectedRoute';
import useUserRole from '@/lib/useUserRole';
import toast from 'react-hot-toast';

const TYPES = {
  roommate: { label: 'Tìm bạn ở ghép', icon: '🏠', color: 'bg-green-100 text-green-700' },
  study_buddy: { label: 'Tìm bạn cùng học', icon: '📚', color: 'bg-blue-100 text-blue-700' },
  hobby: { label: 'Tìm bạn cùng sở thích', icon: '🎯', color: 'bg-purple-100 text-purple-700' },
  marketplace: { label: 'Mua bán sản phẩm', icon: '🛍️', color: 'bg-orange-100 text-orange-700' },
  direct: { label: 'Trò chuyện trực tiếp', icon: '💬', color: 'bg-teal-100 text-teal-700' },
};

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  if (isNaN(date)) return '';
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return time;
  if (isYesterday) return `Hôm qua ${time}`;
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) + ' ' + time;
}

function formatDateSeparator(timestamp) {
  if (!timestamp) return '';
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  if (isNaN(date)) return '';
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return 'Hôm nay';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Hôm qua';
  return date.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function GlobalChatPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isSuperAdmin } = useUserRole();
  const connectionId = params.connectionId;

  const [connection, setConnection] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingConn, setLoadingConn] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [marketItem, setMarketItem] = useState(null);
  const [otherUserDoc, setOtherUserDoc] = useState(null);
  const [participantDocs, setParticipantDocs] = useState({});

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Access control & computed values
  const isSuperAdminView = isSuperAdmin && connection && !connection.participants?.includes(user?.uid);
  const isParticipant = connection?.participants?.includes(user?.uid) || isSuperAdmin;
  const otherUserId = connection?.participants?.find(id => id !== user?.uid);

  const participantA = connection?.participants?.[0];
  const participantB = connection?.participants?.[1];
  const nameA = connection?.participantNames?.[participantA] || 'User A';
  const nameB = connection?.participantNames?.[participantB] || 'User B';
  const otherUserName = isSuperAdminView
    ? `${nameA} và ${nameB}`
    : (otherUserDoc?.name || connection?.participantNames?.[otherUserId] || 'Người dùng');

  const typeInfo = TYPES[connection?.requestType] || TYPES.roommate;

  // Fetch connection info
  useEffect(() => {
    if (!connectionId) return;
    const fetchConnection = async () => {
      try {
        const connRef = doc(db, 'buddyConnections', connectionId);
        const connSnap = await getDoc(connRef);
        if (connSnap.exists()) {
          setConnection({ id: connSnap.id, ...connSnap.data() });
        } else {
          toast.error('Không tìm thấy cuộc trò chuyện');
          router.push('/messages');
        }
      } catch (err) {
        console.error(err);
        toast.error('Lỗi tải cuộc trò chuyện');
      } finally {
        setLoadingConn(false);
      }
    };
    fetchConnection();
  }, [connectionId, router]);

  // Fetch marketplace product detail if applicable
  useEffect(() => {
    if (connection && connection.requestType === 'marketplace') {
      const fetchMarketItem = async () => {
        try {
          const itemRef = doc(db, 'marketplaceItems', connection.requestId);
          const itemSnap = await getDoc(itemRef);
          if (itemSnap.exists()) {
            setMarketItem({ id: itemSnap.id, ...itemSnap.data() });
          }
        } catch (e) {
          console.error("Error fetching market item details:", e);
        }
      };
      fetchMarketItem();
    }
  }, [connection]);

  // Fetch other participant profile details dynamically
  useEffect(() => {
    if (!otherUserId) return;
    const fetchOtherUser = async () => {
      try {
        const uSnap = await getDoc(doc(db, 'users', otherUserId));
        if (uSnap.exists()) {
          setOtherUserDoc(uSnap.data());
        }
      } catch (err) {
        console.error("Error loading other user doc in chat room:", err);
      }
    };
    fetchOtherUser();
  }, [otherUserId]);

  // Fetch all participant docs dynamically (for admin observation layout)
  useEffect(() => {
    if (!connection?.participants) return;
    const fetchParticipants = async () => {
      try {
        const docsMap = {};
        await Promise.all(
          connection.participants.map(async (uid) => {
            const uSnap = await getDoc(doc(db, 'users', uid));
            if (uSnap.exists()) {
              docsMap[uid] = uSnap.data();
            }
          })
        );
        setParticipantDocs(docsMap);
      } catch (err) {
        console.error("Error loading participant docs:", err);
      }
    };
    fetchParticipants();
  }, [connection?.participants]);

  // Real-time messages listener
  useEffect(() => {
    if (!connectionId) return;
    const messagesRef = collection(db, 'buddyConnections', connectionId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [connectionId]);

  // Mark as read when opening chat
  useEffect(() => {
    if (user && connectionId && connection?.participants?.includes(user?.uid)) {
      markBuddyChatAsRead(connectionId, user.uid).catch(console.error);
    }
  }, [user, connectionId, messages.length, connection]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);



  const handleSend = async (e) => {
    e.preventDefault();
    const text = newMessage.trim();
    if (!text || sending || !user) return;

    setSending(true);
    try {
      await sendBuddyChatMessage(
        connectionId,
        user.uid,
        isSuperAdminView ? '🛡️ Quản trị viên' : (user.displayName || user.email || 'Ẩn danh'),
        text
      );
      setNewMessage('');
      inputRef.current?.focus();
    } catch (err) {
      console.error(err);
      toast.error('Không thể gửi tin nhắn');
    } finally {
      setSending(false);
    }
  };

  const handleCloseChat = async () => {
    if (!window.confirm('Bạn có chắc muốn đóng cuộc trò chuyện này? Bạn sẽ không thể gửi tin nhắn nữa.')) return;
    try {
      await closeBuddyConnection(connectionId);
      toast.success('Đã đóng cuộc trò chuyện');
      setConnection(prev => ({ ...prev, status: 'closed' }));
    } catch (err) {
      toast.error('Lỗi khi đóng cuộc trò chuyện');
    }
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, msg) => {
    const date = msg.createdAt?.toDate ? msg.createdAt.toDate() : new Date(msg.createdAt);
    const dateKey = isNaN(date) ? 'unknown' : date.toDateString();
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(msg);
    return groups;
  }, {});

  if (loadingConn) {
    return (
      <ProtectedRoute>
        <Navbar />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!isParticipant) {
    return (
      <ProtectedRoute>
        <Navbar />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <p className="text-5xl mb-4">🔒</p>
            <p className="text-lg font-semibold text-gray-700">Bạn không có quyền truy cập cuộc trò chuyện này</p>
            <button onClick={() => router.push('/messages')} className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition border-none cursor-pointer">
              Quay lại tin nhắn
            </button>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  const isClosed = connection?.status === 'closed';

  return (
    <ProtectedRoute>
      <Navbar />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto flex flex-col bg-white shadow-sm border-x border-gray-100" style={{ height: 'calc(100vh - 64px)' }}>
          {/* Chat Header */}
          <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
            <button
              onClick={() => router.push('/messages')}
              className="p-2 hover:bg-gray-100 rounded-full transition border-none bg-transparent cursor-pointer"
              title="Quay lại"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="flex-1 min-w-0" onClick={() => setShowInfo(!showInfo)} style={{ cursor: 'pointer' }}>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm overflow-hidden">
                  {isSuperAdminView ? (
                    <span className="text-lg">👥</span>
                  ) : otherUserDoc?.avatarUrl ? (
                    <img src={otherUserDoc.avatarUrl} alt={otherUserName} className="w-full h-full object-cover" />
                  ) : (
                    otherUserName.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <h2 className="font-semibold text-gray-800 truncate text-sm sm:text-base">
                    {isSuperAdminView ? `Trò chuyện: ${nameA} & ${nameB}` : otherUserName}
                  </h2>
                  <div className="flex items-center gap-1.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${typeInfo.color}`}>
                      {typeInfo.icon} {typeInfo.label}
                    </span>
                    {isClosed && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-500">Đã đóng</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowInfo(!showInfo)}
              className="p-2 hover:bg-gray-100 rounded-full transition border-none bg-transparent cursor-pointer"
              title="Thông tin"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>

          {/* Product Summary Header Card (For Marketplace chats) */}
          {connection?.requestType === 'marketplace' && marketItem && (
            <div className="bg-orange-50/50 border-b border-orange-100 px-4 py-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                  {marketItem.imageUrl ? (
                    <img src={marketItem.imageUrl} alt={marketItem.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-lg">🛍️</div>
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="font-semibold text-gray-800 text-xs sm:text-sm truncate">{marketItem.title}</h4>
                  <p className="text-orange-600 font-bold text-xs sm:text-sm">{Number(marketItem.price).toLocaleString('vi-VN')}đ</p>
                </div>
              </div>
              <button
                onClick={() => router.push(`/marketplace`)}
                className="px-3 py-1 bg-white border border-orange-200 hover:bg-orange-50 text-orange-700 text-xs font-semibold rounded-lg transition flex-shrink-0 cursor-pointer"
              >
                Xem Chợ
              </button>
            </div>
          )}

          {/* Info Panel Drawer */}
          {showInfo && (
            <div className="bg-blue-50/70 border-b border-blue-100 px-4 py-3 animate-fadeIn">
              <p className="text-sm text-gray-700 mb-1">
                <span className="font-semibold">Nội dung liên quan:</span> {connection?.requestTitle}
              </p>
              <p className="text-sm text-gray-700 mb-3">
                <span className="font-semibold">Phân loại:</span> {typeInfo.icon} {typeInfo.label}
              </p>
              {!isClosed && (
                <button
                  onClick={handleCloseChat}
                  className="text-xs text-red-500 hover:text-red-700 font-bold transition border-none bg-transparent cursor-pointer"
                >
                  🚫 Đóng cuộc trò chuyện
                </button>
              )}
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 bg-gray-50/30" style={{ scrollBehavior: 'smooth' }}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center mb-4 shadow-sm">
                  <span className="text-4xl">👋</span>
                </div>
                <p className="text-lg font-medium text-gray-600">Bắt đầu cuộc trò chuyện!</p>
                <p className="text-sm mt-1">Hãy gửi lời chào đến {otherUserName}</p>
              </div>
            ) : (
              Object.entries(groupedMessages).map(([dateKey, msgs]) => (
                <div key={dateKey}>
                  {/* Date separator */}
                  <div className="flex items-center justify-center my-4">
                    <div className="bg-gray-200 text-gray-500 text-[10px] sm:text-xs px-3 py-1 rounded-full">
                      {formatDateSeparator(msgs[0]?.createdAt)}
                    </div>
                  </div>

                  {/* Messages */}
                  {msgs.map((msg, idx) => {
                    const isMe = isSuperAdminView
                      ? msg.senderId === participantB
                      : msg.senderId === user?.uid;
                    const showAvatar = !isMe && (idx === 0 || msgs[idx - 1]?.senderId !== msg.senderId);
                    const isLastInGroup = idx === msgs.length - 1 || msgs[idx + 1]?.senderId !== msg.senderId;

                    const senderName = connection?.participantNames?.[msg.senderId] || participantDocs[msg.senderId]?.name || 'Người dùng';
                    const senderAvatar = participantDocs[msg.senderId]?.avatarUrl || (msg.senderId === otherUserId ? otherUserDoc?.avatarUrl : null);

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} ${isLastInGroup ? 'mb-3' : 'mb-0.5'}`}
                      >
                        {isSuperAdminView && (idx === 0 || msgs[idx - 1]?.senderId !== msg.senderId) && (
                          <span className={`text-[10px] text-gray-500 mb-1 block ${isMe ? 'mr-1' : 'ml-10'}`}>
                            {senderName}
                          </span>
                        )}
                        <div className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                          {/* Other user avatar */}
                          {!isMe && (
                            <div className="w-8 mr-2 flex-shrink-0">
                              {showAvatar ? (
                                <div 
                                  className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold overflow-hidden"
                                  title={senderName}
                                >
                                  {senderAvatar ? (
                                    <img src={senderAvatar} alt={senderName} className="w-full h-full object-cover" />
                                  ) : (
                                    senderName.charAt(0).toUpperCase()
                                  )}
                                </div>
                              ) : (
                                <div className="w-8" />
                              )}
                            </div>
                          )}

                          <div className={`max-w-[75%] ${isMe ? 'order-1' : 'order-2'}`}>
                            <div
                              className={`px-3.5 py-2 text-sm leading-relaxed break-words rounded-2xl ${
                                isMe
                                  ? 'bg-blue-600 text-white rounded-br-md shadow-sm'
                                  : 'bg-white text-gray-800 rounded-bl-md shadow-sm border border-gray-100'
                              }`}
                            >
                              {msg.text}
                            </div>
                            {isLastInGroup && (
                              <p className={`text-[10px] text-gray-400 mt-0.5 ${isMe ? 'text-right mr-1' : 'ml-1'}`}>
                                {formatTime(msg.createdAt)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          {isClosed ? (
            <div className="bg-gray-100 border-t border-gray-200 px-4 py-3 text-center">
              <p className="text-sm text-gray-500 font-semibold">🚫 Cuộc trò chuyện này đã được đóng</p>
            </div>
          ) : isSuperAdminView ? null : (
            <form onSubmit={handleSend} className="bg-white border-t border-gray-200 px-4 py-3 flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Nhập tin nhắn..."
                className="flex-1 px-4 py-2.5 bg-gray-100 rounded-full text-sm outline-none focus:bg-gray-50 focus:ring-2 focus:ring-blue-500 transition border-none"
                disabled={sending}
                autoFocus
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || sending}
                className={`p-2.5 rounded-full border-none transition-all flex-shrink-0 cursor-pointer ${
                  newMessage.trim()
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg scale-100'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed scale-95'
                }`}
              >
                {sending ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </ProtectedRoute>
  );
}
