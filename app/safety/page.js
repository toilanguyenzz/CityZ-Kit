'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import Navbar from '@/components/Navbar';
import ProtectedRoute from '@/components/ProtectedRoute';
import toast from 'react-hot-toast';
import useUserRole from '@/lib/useUserRole';
import { updateWarningZone, deleteWarningZone } from '@/lib/firestore';
import dynamic from 'next/dynamic';

const SafetyMap = dynamic(() => import('@/components/SafetyMap'), { ssr: false });

const WARNING_TYPES = [
  { key: 'scam', label: '🚫 Lừa đảo', color: 'bg-red-50 text-red-600 border border-red-200' },
  { key: 'unsafe', label: '⚠️ Không an toàn', color: 'bg-yellow-50 text-yellow-600 border border-yellow-200' },
  { key: 'theft', label: '🔒 Trộm cắp', color: 'bg-orange-50 text-orange-600 border border-orange-200' },
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
  const [reportLat, setReportLat] = useState(10.7769);
  const [reportLng, setReportLng] = useState(106.7009);

  const toggleReport = () => {
    if (showReport) {
      setEditingZoneId(null);
      setReportType('scam');
      setReportAddress('');
      setReportDesc('');
      setReportLat(10.7769);
      setReportLng(106.7009);
    }
    setShowReport(!showReport);
  };

  const startEditing = (zone) => {
    setEditingZoneId(zone.id);
    setReportType(zone.warningType || 'scam');
    setReportAddress(zone.address || '');
    setReportDesc(zone.description || '');
    setReportLat(zone.latitude || 10.7769);
    setReportLng(zone.longitude || 106.7009);
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

  const handleUpvote = async (zoneId) => {
    if (!user) return toast.error('Bạn cần đăng nhập để xác thực cảnh báo!');
    const zone = zones.find(z => z.id === zoneId);
    if (!zone) return;

    const upvotedBy = zone.upvotedBy || [];
    const hasUpvoted = upvotedBy.includes(user.uid);
    let newUpvotedBy;
    let newUpvotes;

    if (hasUpvoted) {
      newUpvotedBy = upvotedBy.filter(uid => uid !== user.uid);
      newUpvotes = Math.max(0, (zone.upvotes || 0) - 1);
    } else {
      newUpvotedBy = [...upvotedBy, user.uid];
      newUpvotes = (zone.upvotes || 0) + 1;
    }

    try {
      setZones(prev => prev.map(z => z.id === zoneId ? { ...z, upvotes: newUpvotes, upvotedBy: newUpvotedBy } : z));
      
      const { doc: fsDoc, updateDoc } = await import('firebase/firestore');
      const docRef = fsDoc(db, 'warningZones', zoneId);
      await updateDoc(docRef, {
        upvotes: newUpvotes,
        upvotedBy: newUpvotedBy
      });
      
      toast.success(hasUpvoted ? 'Đã hủy xác nhận!' : 'Cảm ơn bạn đã xác nhận cảnh báo!');
    } catch (error) {
      console.error(error);
      toast.error('Có lỗi xảy ra!');
      fetchZones();
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
        latitude: reportLat,
        longitude: reportLng,
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
          upvotedBy: [],
          verified: false,
          createdAt: serverTimestamp(),
        });
        toast.success('Đã gửi báo cáo! Cảm ơn bạn đã cảnh báo cộng đồng.');
      }
      
      setShowReport(false);
      setEditingZoneId(null);
      setReportType('scam'); setReportAddress(''); setReportDesc('');
      setReportLat(10.7769); setReportLng(106.7009);
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
      <div className="min-h-screen bg-gray-50/50">
        <main className="max-w-6xl mx-auto py-8 px-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-extrabold text-gray-800 tracking-tight flex items-center gap-2">
                🛡️ Cảnh Báo An Toàn
              </h1>
              <p className="text-gray-500 mt-1 text-sm font-medium">Bản đồ nhiệt tương tác phòng tránh lừa đảo và nguy hiểm của sinh viên</p>
            </div>
            <button onClick={toggleReport} className="btn-primary flex items-center gap-2 shadow-sm rounded-xl font-bold">
              {showReport ? '✕ Đóng' : editingZoneId ? '✏️ Sửa báo cáo' : '📢 Báo cáo vùng nguy hiểm'}
            </button>
          </div>

          {/* Report Form */}
          {showReport && (
            <form onSubmit={handleReport} className="card p-6 mb-8 border border-red-100 shadow-lg rounded-3xl bg-white">
              <h2 className="text-lg font-extrabold mb-4 text-gray-800">{editingZoneId ? '✏️ Chỉnh sửa báo cáo' : '📢 Báo cáo vùng nguy hiểm'}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-4">
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Loại cảnh báo</label>
                    <select value={reportType} onChange={e => setReportType(e.target.value)} className="input-field rounded-xl text-sm">
                      {WARNING_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Địa chỉ / Khu vực *</label>
                    <input value={reportAddress} onChange={e => setReportAddress(e.target.value)}
                      className="input-field rounded-xl text-sm" placeholder="Ví dụ: Ngã tư Thủ Đức, gần chợ..." required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Mô tả tình huống *</label>
                    <textarea value={reportDesc} onChange={e => setReportDesc(e.target.value)} rows={3}
                      className="input-field rounded-xl text-sm" placeholder="Mô tả chi tiết sự việc..." required />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Xác định vị trí trên bản đồ (Kéo marker hoặc click map) *</label>
                  <SafetyMap 
                    mode="select" 
                    selectedCoords={{ lat: reportLat, lng: reportLng }} 
                    onChangeCoords={(lat, lng) => {
                      setReportLat(lat);
                      setReportLng(lng);
                    }} 
                  />
                  <p className="text-[10px] text-gray-400 mt-1 font-semibold">Tọa độ: {reportLat.toFixed(5)}, {reportLng.toFixed(5)}</p>
                </div>
              </div>
              
              <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
                <button type="button" onClick={toggleReport} className="btn-secondary rounded-xl text-sm font-semibold">Hủy</button>
                <button type="submit" disabled={submitting} className="btn-primary rounded-xl text-sm font-bold shadow-sm">
                  {submitting ? 'Đang xử lý...' : editingZoneId ? '💾 Cập nhật' : '📤 Gửi báo cáo'}
                </button>
              </div>
            </form>
          )}

          {/* Safety split-screen panel */}
          <div className="safety-split">
            {/* Map Column */}
            <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                  <span className="flex h-2 w-2 rounded-full bg-red-500 live-dot-ping"></span>
                  Bản đồ an toàn sinh viên (Leaflet Map)
                </h3>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">Hồ Chí Minh</span>
              </div>
              <SafetyMap zones={zones} mode="view" />
            </div>

            {/* List Column */}
            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col">
              <h2 className="text-sm font-bold mb-4 text-gray-800 uppercase tracking-wider">📢 Tin báo cáo mới nhất</h2>
              {loading ? (
                <div className="flex justify-center py-10">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                </div>
              ) : zones.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <p className="text-4xl mb-3">✅</p>
                  <p className="text-sm font-medium">Chưa có cảnh báo nào được báo cáo!</p>
                </div>
              ) : (
                <div className="space-y-3 safety-zones-scroll">
                  {zones.map(z => {
                    const info = typeInfo(z.warningType);
                    const hasUpvoted = z.upvotedBy?.includes(user?.uid);
                    return (
                      <div key={z.id} className="flex flex-col gap-2.5 p-4 rounded-2xl border border-gray-100 hover:border-gray-200 transition bg-slate-50/30">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${info.color}`}>
                            {info.label}
                          </span>
                          {z.verified && <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">✓ Xác thực</span>}
                        </div>
                        
                        <div className="min-w-0">
                          <p className="font-extrabold text-sm text-gray-800">📍 {z.address || 'Chưa rõ địa chỉ'}</p>
                          <p className="text-xs text-gray-500 mt-1 leading-relaxed">{z.description}</p>
                          <p className="text-[10px] text-gray-400 mt-2 font-medium">Đăng bởi: {z.reporterName || 'Ẩn danh'}</p>
                        </div>

                        <div className="flex items-center justify-between border-t border-gray-100 pt-2.5 mt-1">
                          <button 
                            onClick={() => handleUpvote(z.id)}
                            className={`safety-upvote-btn ${hasUpvoted ? 'safety-upvote-btn--active' : ''}`}
                          >
                            👍 {hasUpvoted ? 'Đã xác nhận' : 'Xác nhận gặp tình huống này'} ({z.upvotes || 0})
                          </button>

                          {user && (z.reportedBy === user.uid || isAdmin) && (
                            <div className="flex gap-2 text-[10px] font-bold">
                              <button onClick={() => startEditing(z)} className="text-blue-600 hover:text-blue-800 border-none bg-transparent cursor-pointer">Sửa</button>
                              <span className="text-gray-200">|</span>
                              <button onClick={() => handleDelete(z.id)} className="text-red-600 hover:text-red-800 border-none bg-transparent cursor-pointer">Xóa</button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
