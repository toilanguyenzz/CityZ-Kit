'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import Navbar from '@/components/Navbar';
import ProtectedRoute from '@/components/ProtectedRoute';
import toast from 'react-hot-toast';
import useUserRole from '@/lib/useUserRole';
import { updateBuddyRequest, deleteBuddyRequest } from '@/lib/firestore';

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

      if (editingRequestId) {
        await updateBuddyRequest(editingRequestId, requestData);
        toast.success('Đã cập nhật yêu cầu tìm bạn thành công!');
      } else {
        await addDoc(collection(db, 'buddyRequests'), {
          ...requestData,
          userId: user.uid,
          userName: user.displayName || user.email,
          status: 'open',
          createdAt: serverTimestamp(),
        });
        toast.success('Đã đăng yêu cầu tìm bạn!');
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

  const filtered = filterType ? requests.filter(r => r.type === filterType) : requests;
  const typeInfo = (key) => TYPES.find(t => t.key === key) || TYPES[0];

  return (
    <ProtectedRoute>
      <Navbar />
      <div className="min-h-screen bg-gray-50">
        <main className="max-w-6xl mx-auto py-8 px-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">🤝 Tìm Bạn Đồng Hành</h1>
              <p className="text-gray-500 mt-1">Kết nối với sinh viên cùng trường, cùng sở thích tại TP.HCM</p>
            </div>
            <button
              onClick={toggleForm}
              className="btn-primary flex items-center gap-2"
            >
              {showForm ? '✕ Đóng' : editingRequestId ? '✏️ Sửa yêu cầu' : '＋ Đăng yêu cầu'}
            </button>
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
                  <div key={req.id} className="card p-6 hover:shadow-lg transition-all duration-300">
                    <div className="flex justify-between items-start mb-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${info.color}`}>
                        {info.label}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${req.status === 'open' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                        {req.status === 'open' ? '● Đang tìm' : '● Đã đóng'}
                      </span>
                    </div>
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

                    {req.status === 'open' && (
                      <button className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-semibold transition">
                        💬 Kết nối ngay
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
