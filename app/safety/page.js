'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import Navbar from '@/components/Navbar';
import ProtectedRoute from '@/components/ProtectedRoute';
import toast from 'react-hot-toast';
import useUserRole from '@/lib/useUserRole';
import { updateWarningZone, deleteWarningZone } from '@/lib/firestore';



const WARNING_TYPES = [
  { key: 'scam', label: '🚫 Lừa đảo', color: 'bg-red-100 text-red-700' },
  { key: 'unsafe', label: '⚠️ Không an toàn', color: 'bg-yellow-100 text-yellow-700' },
  { key: 'theft', label: '🔒 Trộm cắp', color: 'bg-orange-100 text-orange-700' },
];

export default function SafetyPage() {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, isAdmin } = useUserRole();
  const [showReport, setShowReport] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingZoneId, setEditingZoneId] = useState(null);

  // Report form states
  const [reportType, setReportType] = useState('scam');
  const [reportAddress, setReportAddress] = useState('');
  const [reportDesc, setReportDesc] = useState('');

  const toggleReport = () => {
    if (showReport) {
      setEditingZoneId(null);
      setReportType('scam');
      setReportAddress('');
      setReportDesc('');
    }
    setShowReport(!showReport);
  };

  const startEditing = (zone) => {
    setEditingZoneId(zone.id);
    setReportType(zone.warningType || 'scam');
    setReportAddress(zone.address || '');
    setReportDesc(zone.description || '');
    setShowReport(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (zoneId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa báo cáo này không?')) return;
    try {
      await deleteWarningZone(zoneId);
      toast.success('Đã xóa báo cáo thành công!');
      fetchZones();
    } catch (error) {
      toast.error('Lỗi khi xóa báo cáo: ' + error.message);
    }
  };

  useEffect(() => {
    fetchZones();
  }, []);

  const fetchZones = async () => {
    try {
      const q = query(collection(db, 'warningZones'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setZones(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error('Error fetching warning zones:', error);
    } finally {
      setLoading(false);
    }
  };



  const handleReport = async (e) => {
    e.preventDefault();
    if (!user) return toast.error('Bạn cần đăng nhập!');
    if (!reportAddress.trim()) return toast.error('Vui lòng nhập địa chỉ!');
    if (!reportDesc.trim()) return toast.error('Vui lòng mô tả tình huống!');

    setSubmitting(true);
    try {
      const zoneData = {
        warningType: reportType,
        address: reportAddress.trim(),
        description: reportDesc.trim(),
      };

      if (editingZoneId) {
        await updateWarningZone(editingZoneId, zoneData);
        toast.success('Đã cập nhật báo cáo thành công!');
      } else {
        await addDoc(collection(db, 'warningZones'), {
          ...zoneData,
          reportedBy: user.uid,
          reporterName: user.displayName || user.email,
          upvotes: 0,
          verified: false,
          createdAt: serverTimestamp(),
        });
        toast.success('Đã gửi báo cáo! Cảm ơn bạn đã cảnh báo cộng đồng.');
      }
      
      setShowReport(false);
      setEditingZoneId(null);
      setReportType('scam'); setReportAddress(''); setReportDesc('');
      fetchZones();
    } catch (error) {
      console.error(error);
      toast.error('Có lỗi xảy ra!');
    } finally {
      setSubmitting(false);
    }
  };

  const typeInfo = (key) => WARNING_TYPES.find(t => t.key === key) || WARNING_TYPES[0];

  return (
    <ProtectedRoute>
      <Navbar />
      <div className="min-h-screen bg-gray-50">
        <main className="max-w-6xl mx-auto py-8 px-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">🛡️ An Toàn & Cảnh Báo</h1>
              <p className="text-gray-500 mt-1">Bảo vệ cộng đồng sinh viên khỏi lừa đảo và nguy hiểm</p>
            </div>
             <button onClick={toggleReport} className="btn-primary flex items-center gap-2">
              {showReport ? '✕ Đóng' : editingZoneId ? '✏️ Sửa báo cáo' : '📢 Báo cáo vùng nguy hiểm'}
            </button>
          </div>

          {/* Report Form */}
          {showReport && (
            <form onSubmit={handleReport} className="card p-6 mb-8 border border-yellow-200">
              <h2 className="text-xl font-bold mb-4 text-gray-800">{editingZoneId ? '✏️ Chỉnh sửa báo cáo' : '📢 Báo cáo vùng nguy hiểm'}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Loại cảnh báo</label>
                  <select value={reportType} onChange={e => setReportType(e.target.value)} className="input-field">
                    {WARNING_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ / Khu vực *</label>
                  <input value={reportAddress} onChange={e => setReportAddress(e.target.value)}
                    className="input-field" placeholder="Ví dụ: Ngã tư Thủ Đức, gần chợ..." required />
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả tình huống *</label>
                <textarea value={reportDesc} onChange={e => setReportDesc(e.target.value)} rows={3}
                  className="input-field" placeholder="Mô tả chi tiết sự việc để cảnh báo cộng đồng..." required />
              </div>
              <button type="submit" disabled={submitting} className="btn-primary w-full sm:w-auto">
                {submitting ? 'Đang xử lý...' : editingZoneId ? '💾 Cập nhật' : '📤 Gửi báo cáo'}
              </button>
            </form>
          )}

          {/* Warning Zones List */}
          <div className="card p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800">📍 Các vùng cảnh báo gần đây</h2>
            {loading ? (
              <div className="flex justify-center py-10">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : zones.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <p className="text-4xl mb-3">✅</p>
                <p>Chưa có báo cáo cảnh báo nào. Khu vực an toàn!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {zones.map(z => {
                  const info = typeInfo(z.warningType);
                  return (
                    <div key={z.id} className="flex items-start gap-4 p-4 rounded-lg border border-gray-100 hover:bg-gray-50 transition">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${info.color}`}>
                        {info.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800">{z.address || 'Chưa rõ địa chỉ'}</p>
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{z.description}</p>
                        <p className="text-xs text-gray-400 mt-1">Báo cáo bởi {z.reporterName || 'Ẩn danh'}</p>
                        {user && (z.reportedBy === user.uid || isAdmin) && (
                          <div className="flex gap-2 mt-2 text-xs font-semibold">
                            <button onClick={() => startEditing(z)} className="text-blue-600 hover:text-blue-800 border-none bg-transparent cursor-pointer">Sửa</button>
                            <span className="text-gray-300">|</span>
                            <button onClick={() => handleDelete(z.id)} className="text-red-600 hover:text-red-800 border-none bg-transparent cursor-pointer">Xóa</button>
                          </div>
                        )}
                      </div>
                      {z.verified && <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded-full font-medium">✓ Đã xác thực</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
