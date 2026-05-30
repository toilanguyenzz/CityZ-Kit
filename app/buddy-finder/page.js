'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import Navbar from '@/components/Navbar';
import ProtectedRoute from '@/components/ProtectedRoute';
import toast from 'react-hot-toast';
import useUserRole from '@/lib/useUserRole';
import { updateBuddyRequest, deleteBuddyRequest, createBuddyConnection, getBuddyConnections, autoModerateContent, getUserProfile } from '@/lib/firestore';

const TYPES = [
  { key: 'roommate', label: '🏠 Tìm bạn ở ghép', color: 'bg-green-100 text-green-700' },
  { key: 'study_buddy', label: '📚 Tìm bạn cùng học', color: 'bg-blue-100 text-blue-700' },
  { key: 'hobby', label: '🎯 Tìm bạn cùng sở thích', color: 'bg-purple-100 text-purple-700' },
];

const UNIVERSITIES = [
  'ĐH Bách Khoa TP.HCM', 'ĐH Khoa học Tự nhiên', 'ĐH Công nghệ Thông tin',
  'ĐH Kinh tế TP.HCM', 'ĐH Sư phạm TP.HCM', 'ĐH Ngoại Thương CS2',
  'ĐH Tôn Đức Thắng', 'ĐH FPT TP.HCM', 'ĐH Hoa Sen', 'ĐH RMIT',
  'ĐH Kiến trúc TP.HCM', 'ĐH Y Dược TP.HCM', 'Khác',
];

const HABITS = ['Dậy sớm', 'Thức khuya', 'Gọn gàng', 'Không hút thuốc', 'Yêu động vật', 'Thích yên tĩnh'];
const INTERESTS = ['Game', 'Đọc sách', 'Thể thao', 'Nấu ăn', 'Du lịch', 'Âm nhạc', 'Phim ảnh', 'Công nghệ'];

export default function BuddyFinderPage() {
  const [requests, setRequests] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user, isAdmin } = useUserRole();
  const [filterType, setFilterType] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingRequestId, setEditingRequestId] = useState(null);
  const [connectingId, setConnectingId] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();

  // Tab state for unified "Kết nối" hub
  const [activeConnectTab, setActiveConnectTab] = useState('buddy');

  // Modal connections list states
  const [showConnectionsModal, setShowConnectionsModal] = useState(false);
  const [activeRequestForConnections, setActiveRequestForConnections] = useState(null);
  const [connectedUserProfiles, setConnectedUserProfiles] = useState([]);
  const [connectionsMap, setConnectionsMap] = useState({});
  const [loadingProfiles, setLoadingProfiles] = useState(false);

  // Form states
  const [formType, setFormType] = useState('roommate');
  const [formUniversity, setFormUniversity] = useState('');
  const [formHabits, setFormHabits] = useState([]);
  const [formInterests, setFormInterests] = useState([]);
  const [formNote, setFormNote] = useState('');

  const toggleForm = () => {
    if (showForm) {
      setEditingRequestId(null);
      setFormType('roommate');
      setFormUniversity('');
      setFormHabits([]);
      setFormInterests([]);
      setFormNote('');
    }
    setShowForm(!showForm);
  };

  const startEditing = (req) => {
    setEditingRequestId(req.id);
    setFormType(req.type || 'roommate');
    setFormUniversity(req.university || '');
    setFormHabits(req.habits || []);
    setFormInterests(req.interests || []);
    setFormNote(req.note || '');
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (requestId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa yêu cầu này không?')) return;
    try {
      await deleteBuddyRequest(requestId);
      toast.success('Đã xóa yêu cầu thành công!');
      fetchRequests();
    } catch (error) {
      toast.error('Lỗi khi xóa yêu cầu: ' + error.message);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // Fetch unread count for conversations badge
  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      try {
        const conns = await getBuddyConnections(user.uid);
        const total = conns.reduce((sum, c) => sum + (c.unreadCount?.[user.uid] || 0), 0);
        setUnreadCount(total);
      } catch (err) {
        console.error('Error fetching unread:', err);
      }
    };
    fetchUnread();
  }, [user]);

  // Handle connect button
  const handleConnect = async (req) => {
    if (!user) return toast.error('Bạn cần đăng nhập!');
    if (req.userId === user.uid) return toast.error('Bạn không thể kết nối với chính mình!');
    
    setConnectingId(req.id);
    try {
      const { connectionId, isNew } = await createBuddyConnection(
        req.id,
        req,
        user,
        req.userId
      );
      
      if (isNew) {
        toast.success('Đã kết nối thành công! Đang mở chat...');
      } else {
        toast('Đang mở cuộc trò chuyện...', { icon: '💬' });
      }
      
      router.push(`/buddy-finder/chat/${connectionId}`);
    } catch (err) {
      console.error('Error connecting:', err);
      toast.error('Có lỗi xảy ra khi kết nối. Vui lòng thử lại!');
    } finally {
      setConnectingId(null);
    }
  };

  const handleShowConnectionsModal = async (req) => {
    setActiveRequestForConnections(req);
    setShowConnectionsModal(true);
    setLoadingProfiles(true);
    try {
      const profiles = [];
      const uids = req.connectedBy || [];
      
      await Promise.all(
        uids.map(async (uid) => {
          try {
            const profile = await getUserProfile(uid);
            if (profile) {
              profiles.push({ uid, ...profile });
            } else {
              profiles.push({ uid, name: 'Người dùng ẩn danh', email: '' });
            }
          } catch (err) {
            console.error(err);
            profiles.push({ uid, name: 'Lỗi tải thông tin', email: '' });
          }
        })
      );
      setConnectedUserProfiles(profiles);
      
      const allConns = await getBuddyConnections(user.uid);
      const requestConns = allConns.filter(c => c.requestId === req.id);
      setConnectionsMap(requestConns.reduce((map, c) => {
        const otherId = c.participants.find(id => id !== user.uid);
        map[otherId] = c.id;
        return map;
      }, {}));
      
    } catch (err) {
      toast.error('Lỗi khi tải danh sách kết nối');
    } finally {
      setLoadingProfiles(false);
    }
  };

  const handleSelectBuddy = async (req, selectedUser) => {
    if (!window.confirm(`Bạn có chắc chắn muốn chốt chọn ${selectedUser.name || 'bạn này'} làm bạn đồng hành và đóng yêu cầu tìm kiếm này?`)) return;
    
    try {
      await updateBuddyRequest(req.id, {
        status: 'closed',
        matchedWith: {
          uid: selectedUser.uid,
          name: selectedUser.name || 'Ẩn danh',
          avatarUrl: selectedUser.avatarUrl || null,
        }
      });
      
      toast.success('🎉 Đã chốt bạn đồng hành thành công!');
      setShowConnectionsModal(false);
      fetchRequests();
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi chốt bạn đồng hành');
    }
  };


  const fetchRequests = async () => {
    try {
      const q = query(collection(db, 'buddyRequests'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setRequests(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error('Error fetching buddy requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (list, setList, item) => {
    setList(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return toast.error('Bạn cần đăng nhập!');
    if (!formUniversity) return toast.error('Vui lòng chọn trường đại học!');
    if (formHabits.length === 0 && formInterests.length === 0) return toast.error('Vui lòng chọn ít nhất 1 thói quen hoặc sở thích!');

    setSubmitting(true);
    try {
      const requestData = {
        type: formType,
        university: formUniversity,
        habits: formHabits,
        interests: formInterests,
        note: formNote,
      };

      const modResult = autoModerateContent(formNote);

      if (editingRequestId) {
        // Cập nhật yêu cầu tìm bạn
        // Nếu là admin thì được duyệt luôn (open), còn user thường thì luôn phải chờ duyệt lại (pending)
        const updateData = {
          ...requestData,
          status: isAdmin ? 'open' : 'pending',
          moderationFlags: modResult.flags || [],
          riskScore: modResult.riskScore || 0,
        };
        await updateBuddyRequest(editingRequestId, updateData);
        if (isAdmin) {
          toast.success('Đã cập nhật yêu cầu tìm bạn thành công!');
        } else {
          toast.success('Đã cập nhật! Yêu cầu của bạn đã được chuyển sang trạng thái chờ admin duyệt lại. ⏳', { duration: 5000 });
        }
      } else {
        // Đăng yêu cầu tìm bạn mới
        // Nếu là admin thì được tự động duyệt (open), còn user thường thì luôn đi vào trạng thái chờ duyệt (pending)
        const docData = {
          ...requestData,
          userId: user.uid,
          userName: user.displayName || user.email,
          createdAt: serverTimestamp(),
          status: isAdmin ? 'open' : 'pending',
          moderationFlags: modResult.flags || [],
          riskScore: modResult.riskScore || 0,
          autoApproved: isAdmin,
        };

        await addDoc(collection(db, 'buddyRequests'), docData);

        if (isAdmin) {
          toast.success('Đã đăng yêu cầu tìm bạn!');
        } else {
          toast.success('Đã gửi yêu cầu! Bài viết của bạn đang chờ Admin duyệt để hiển thị công khai. ⏳', {
            duration: 6000,
          });
        }
      }
      
      setShowForm(false);
      setEditingRequestId(null);
      setFormType('roommate');
      setFormUniversity('');
      setFormHabits([]);
      setFormInterests([]);
      setFormNote('');
      fetchRequests();
    } catch (error) {
      console.error(error);
      toast.error('Có lỗi xảy ra, vui lòng thử lại!');
    } finally {
      setSubmitting(false);
    }
  };

  // Chỉ hiển thị yêu cầu đã duyệt (open/closed) + yêu cầu pending của chính user
  const visibleRequests = requests.filter(r => {
    if (r.status === 'open' || r.status === 'approved' || r.status === 'closed') return true;
    if (r.status === 'pending' && user && r.userId === user.uid) return true;
    if (isAdmin) return true; // Admin thấy tất cả
    return false;
  });
  const filtered = filterType ? visibleRequests.filter(r => r.type === filterType) : visibleRequests;
  const typeInfo = (key) => TYPES.find(t => t.key === key) || TYPES[0];

  return (
    <ProtectedRoute>
      <Navbar />
      <div className="min-h-screen bg-gray-50">
        <main className="max-w-6xl mx-auto py-8 px-4">

          {/* ═══ Connect Hub Tab Switcher ═══ */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <div style={{
              display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '0.75rem',
              border: '1px solid #e2e8f0', gap: '2px'
            }}>
              {[
                { key: 'buddy', label: '🏠 Tìm Bạn', count: filtered.length },
                { key: 'market', label: '🛍️ Mua Bán', count: null },
                { key: 'messages', label: '💬 Tin nhắn', count: unreadCount || null },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveConnectTab(tab.key)}
                  style={{
                    padding: '0.55rem 1.1rem', borderRadius: '0.6rem', border: 'none',
                    background: activeConnectTab === tab.key ? '#fff' : 'transparent',
                    color: activeConnectTab === tab.key ? '#1e40af' : '#64748b',
                    fontSize: '0.85rem', fontWeight: activeConnectTab === tab.key ? 700 : 500,
                    cursor: 'pointer', transition: 'all 0.2s',
                    boxShadow: activeConnectTab === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                  }}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span style={{
                      background: activeConnectTab === tab.key ? '#3b82f6' : '#94a3b8',
                      color: '#fff', fontSize: '0.65rem', fontWeight: 700,
                      padding: '1px 6px', borderRadius: '1rem', minWidth: '18px', textAlign: 'center',
                    }}>
                      {tab.count > 99 ? '99+' : tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ═══ TAB: Tìm Bạn ═══ */}
          {activeConnectTab === 'buddy' && (
            <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">🤝 Tìm Bạn Đồng Hành</h1>
              <p className="text-gray-500 mt-1">Kết nối với sinh viên cùng trường, cùng sở thích tại TP.HCM</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveConnectTab('messages')}
                className="relative px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition flex items-center gap-2 text-sm font-medium text-gray-700"
              >
                💬 Tin nhắn
                {unreadCount > 0 && (
                  <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={toggleForm}
                className="btn-primary flex items-center gap-2"
              >
                {showForm ? '✕ Đóng' : editingRequestId ? '✏️ Sửa yêu cầu' : '＋ Đăng yêu cầu'}
              </button>
            </div>
          </div>

          {/* Form */}
          {showForm && (
            <form onSubmit={handleSubmit} className="card p-6 mb-8 border border-blue-100">
              <h2 className="text-xl font-bold mb-4 text-gray-800">{editingRequestId ? '✏️ Chỉnh sửa yêu cầu tìm bạn' : '📝 Tạo yêu cầu tìm bạn'}</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Loại nhu cầu</label>
                  <select value={formType} onChange={e => setFormType(e.target.value)} className="input-field">
                    {TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Trường Đại học</label>
                  <select value={formUniversity} onChange={e => setFormUniversity(e.target.value)} className="input-field">
                    <option value="">-- Chọn trường --</option>
                    {UNIVERSITIES.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Thói quen</label>
                <div className="flex flex-wrap gap-2">
                  {HABITS.map(h => (
                    <button key={h} type="button"
                      onClick={() => toggleItem(formHabits, setFormHabits, h)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${formHabits.includes(h) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >{h}</button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Sở thích</label>
                <div className="flex flex-wrap gap-2">
                  {INTERESTS.map(i => (
                    <button key={i} type="button"
                      onClick={() => toggleItem(formInterests, setFormInterests, i)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${formInterests.includes(i) ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >{i}</button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú thêm</label>
                <textarea value={formNote} onChange={e => setFormNote(e.target.value)} rows={3}
                  className="input-field" placeholder="Ví dụ: Mình đang tìm bạn ở ghép khu Thủ Đức, budget 2-3tr/người..." />
              </div>

              <button type="submit" disabled={submitting} className="btn-primary w-full sm:w-auto">
                {submitting ? 'Đang xử lý...' : editingRequestId ? '💾 Cập nhật' : '🚀 Đăng yêu cầu'}
              </button>
            </form>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button onClick={() => setFilterType(null)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${!filterType ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              🌐 Tất cả
            </button>
            {TYPES.map(t => (
              <button key={t.key} onClick={() => setFilterType(t.key)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition ${filterType === t.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* List */}
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <p className="text-5xl mb-4">🔍</p>
              <p className="text-lg font-medium">Chưa có yêu cầu nào. Hãy là người đầu tiên!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map(req => {
                const info = typeInfo(req.type);
                return (
                  <div key={req.id} className={`card p-6 hover:shadow-lg transition-all duration-300 ${req.status === 'pending' ? 'border border-yellow-200 bg-yellow-50/30' : ''}`}>
                    <div className="flex justify-between items-start mb-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${info.color}`}>
                        {info.label}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        req.status === 'open' ? 'bg-green-50 text-green-600' : 
                        req.status === 'pending' ? 'bg-yellow-50 text-yellow-600' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {req.status === 'open' ? '● Đang tìm' : req.status === 'pending' ? '⏳ Chờ duyệt' : '● Đã đóng'}
                      </span>
                    </div>
                    {req.status === 'pending' && user && req.userId === user.uid && (
                      <div className="mb-3 px-3 py-2 bg-yellow-100 rounded-lg text-xs text-yellow-700">
                        ⚠️ Yêu cầu đang chờ admin kiểm duyệt. Chỉ bạn mới thấy yêu cầu này.
                        {req.moderationFlags?.length > 0 && (
                          <div className="mt-1 text-yellow-600">
                            Lý do: {req.moderationFlags.join(', ')}
                          </div>
                        )}
                      </div>
                    )}
                    <h3 className="text-lg font-bold text-gray-800 mb-1">🎓 {req.university || 'Chưa rõ trường'}</h3>
                    <p className="text-sm text-gray-500 mb-3">Bởi {req.userName || 'Ẩn danh'}</p>
                    {user && (req.userId === user.uid || isAdmin) && (
                      <div className="flex gap-2 mb-3 text-xs font-semibold">
                        <button onClick={() => startEditing(req)} className="text-blue-600 hover:text-blue-800 border-none bg-transparent cursor-pointer">Sửa</button>
                        <span className="text-gray-300">|</span>
                        <button onClick={() => handleDelete(req.id)} className="text-red-600 hover:text-red-800 border-none bg-transparent cursor-pointer">Xóa</button>
                      </div>
                    )}
                    {req.note && <p className="text-sm text-gray-600 mb-3 line-clamp-2 italic">&quot;{req.note}&quot;</p>}

                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {(req.habits || []).map(h => <span key={h} className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full">{h}</span>)}
                      {(req.interests || []).map(i => <span key={i} className="text-xs bg-purple-50 text-purple-600 px-2 py-1 rounded-full">{i}</span>)}
                    </div>

                    {/* Badge đã chốt (hiển thị khi status là closed) */}
                    {req.status === 'closed' && (
                      <div className="mb-4 p-3 bg-green-50 rounded-xl border border-green-100 flex items-center gap-2">
                        <span className="text-base">🎉</span>
                        <div className="min-w-0">
                          <p className="text-[10px] text-green-600 font-bold uppercase tracking-wider">ĐÃ CHỐT BẠN ĐỒNG HÀNH</p>
                        </div>
                      </div>
                    )}

                    {/* Điều khiển các nút hành động */}
                    {user && req.userId === user.uid ? (
                      // Nếu là chủ bài đăng
                      req.status === 'closed' ? (
                        // Đã chốt xong
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleShowConnectionsModal(req)}
                            className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold transition"
                          >
                            👥 Xem kết nối ({req.connectedBy?.length || 0})
                          </button>
                        </div>
                      ) : (
                        // Đang mở tìm kiếm
                        req.connectedBy?.length > 0 ? (
                          <button
                            onClick={() => handleShowConnectionsModal(req)}
                            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition shadow-md hover:shadow-lg active:scale-[0.98]"
                          >
                            👥 Xem kết nối ({req.connectedBy.length})
                          </button>
                        ) : (
                          <button
                            disabled
                            className="w-full py-2.5 bg-gray-100 text-gray-400 rounded-lg text-sm font-semibold cursor-not-allowed"
                          >
                            👥 Chưa có kết nối
                          </button>
                        )
                      )
                    ) : (
                      // Nếu là người xem khác
                      req.status === 'closed' ? (
                        <button
                          disabled
                          className="w-full py-2.5 bg-gray-100 text-gray-400 rounded-lg text-sm font-semibold cursor-not-allowed"
                        >
                          🔒 Yêu cầu đã đóng
                        </button>
                      ) : (
                        <button
                          onClick={() => handleConnect(req)}
                          disabled={connectingId === req.id}
                          className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                            connectingId === req.id
                              ? 'bg-blue-500 text-white cursor-wait'
                              : 'bg-gray-900 hover:bg-gray-800 text-white hover:shadow-lg active:scale-[0.98]'
                          }`}
                        >
                          {connectingId === req.id ? (
                            <span className="flex items-center justify-center gap-2">
                              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Đang kết nối...
                            </span>
                          ) : (
                            '💬 Kết nối ngay'
                          )}
                        </button>
                      )
                    )}

                    {req.status === 'open' && req.connectedBy?.length > 0 && (
                      <p className="text-xs text-gray-400 mt-2 text-center">
                        ✅ {req.connectedBy.length} người đã kết nối
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Connections Modal */}
          {showConnectionsModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowConnectionsModal(false)}>
              <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[70vh] overflow-hidden animate-scaleUp" onClick={(e) => e.stopPropagation()}>
                {/* Modal Header */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-100">
                  <h3 className="text-lg font-bold text-gray-800">🤝 Đã kết nối ({connectedUserProfiles.length})</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Danh sách người đã kết nối với yêu cầu này</p>
                </div>

                {/* Modal Content */}
                <div className="overflow-y-auto max-h-[50vh] p-4">
                  {loadingProfiles ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  ) : connectedUserProfiles.length === 0 ? (
                    <p className="text-center text-gray-400 py-8 text-sm">Chưa có ai kết nối</p>
                  ) : (
                    <div className="space-y-2">
                      {connectedUserProfiles.map((profile, idx) => {
                        const connection = connectionsMap[profile.id];
                        return (
                          <div key={idx} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                              {profile.avatarUrl ? (
                                <img src={profile.avatarUrl} alt={profile.name} className="w-full h-full rounded-full object-cover" />
                              ) : (
                                (profile.name || 'U').charAt(0).toUpperCase()
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-800 truncate">{profile.name || 'Người dùng'}</p>
                              {profile.university && <p className="text-xs text-gray-400 truncate">🎓 {profile.university}</p>}
                            </div>
                            {connection && (
                              <button
                                onClick={() => router.push(`/buddy-finder/conversations?connectionId=${connection.id}`)}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition flex-shrink-0"
                              >
                                💬 Chat
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-6 py-4 flex justify-end border-t border-gray-100">
                  <button 
                    type="button"
                    onClick={() => setShowConnectionsModal(false)}
                    className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-semibold transition"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          )}
            </>
          )}

          {/* ═══ TAB: Mua Bán ═══ */}
          {activeConnectTab === 'market' && (
            <div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h1 className="text-3xl font-bold text-gray-800">🛍️ Chợ Đồ Cũ Sinh Viên</h1>
                  <p className="text-gray-500 mt-1">Mua bán đồ cũ giá rẻ giữa các sinh viên</p>
                </div>
                <Link
                  href="/marketplace"
                  className="btn-primary flex items-center gap-2"
                >
                  🛍️ Mở Chợ đầy đủ →
                </Link>
              </div>

              <div className="card p-8 text-center">
                <div className="text-5xl mb-4">🛍️</div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">Chợ Đồ Cũ Sinh Viên</h3>
                <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
                  Mua bán sách giáo khoa, đồ điện tử, nội thất và nhiều hơn nữa — tất cả từ sinh viên cho sinh viên.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <Link
                    href="/marketplace"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition shadow-sm"
                  >
                    🛒 Xem sản phẩm
                  </Link>
                  <Link
                    href="/marketplace?action=sell"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-semibold transition"
                  >
                    ＋ Đăng bán đồ
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* ═══ TAB: Tin nhắn ═══ */}
          {activeConnectTab === 'messages' && (
            <div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h1 className="text-3xl font-bold text-gray-800">💬 Tin Nhắn</h1>
                  <p className="text-gray-500 mt-1">Quản lý các cuộc hội thoại của bạn</p>
                </div>
              </div>

              <div className="card p-8 text-center">
                <div className="text-5xl mb-4">💬</div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">Hộp Tin Nhắn</h3>
                <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
                  Xem và quản lý tất cả cuộc hội thoại với bạn bè, bạn ở ghép và người mua bán.
                </p>
                <Link
                  href="/buddy-finder/conversations"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition shadow-sm"
                >
                  💬 Mở hộp tin nhắn
                  {unreadCount > 0 && (
                    <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </Link>
              </div>
            </div>
          )}

        </main>
      </div>

      <style jsx global>{`
        @keyframes scaleUp {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-scaleUp {
          animation: scaleUp 0.15s ease-out forwards;
        }
      `}</style>
    </ProtectedRoute>
  );
}
