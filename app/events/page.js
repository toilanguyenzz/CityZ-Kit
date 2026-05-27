'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import Navbar from '@/components/Navbar';
import ProtectedRoute from '@/components/ProtectedRoute';

const FILTERS = [
  { key: null, label: 'Tất cả', emoji: '🌐' },
  { key: 'academic', label: 'Học thuật', emoji: '📚' },
  { key: 'entertainment', label: 'Giải trí', emoji: '🎉' },
  { key: 'volunteer', label: 'Tình nguyện', emoji: '💚' },
  { key: 'career', label: 'Việc làm', emoji: '💼' },
];

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState(null);
  const [filterUni, setFilterUni] = useState(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const q = query(collection(db, 'events'), orderBy('date', 'asc'));
      const snap = await getDocs(q);
      setEvents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateField) => {
    if (!dateField) return 'Chưa xác định';
    try {
      const d = dateField.toDate ? dateField.toDate() : new Date(dateField);
      return d.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return 'Chưa xác định';
    }
  };

  const formatTime = (dateField) => {
    if (!dateField) return '';
    try {
      const d = dateField.toDate ? dateField.toDate() : new Date(dateField);
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const isUpcoming = (dateField) => {
    try {
      const d = dateField?.toDate ? dateField.toDate() : new Date(dateField);
      return d >= new Date();
    } catch {
      return true;
    }
  };

  // Get unique universities from events for filtering
  const universities = [...new Set(events.map(e => e.university).filter(Boolean))];

  const filtered = events.filter(e => {
    if (filterCat && e.category !== filterCat) return false;
    if (filterUni && e.university !== filterUni) return false;
    return true;
  });

  const catInfo = (key) => FILTERS.find(f => f.key === key) || FILTERS[0];

  return (
    <ProtectedRoute>
      <Navbar />
      <div className="min-h-screen bg-gray-50">
        <main className="max-w-6xl mx-auto py-8 px-4">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-800">📅 Lịch Sự Kiện Sinh Viên</h1>
            <p className="text-gray-500 mt-1">Cập nhật sự kiện từ các trường ĐH tại TP.HCM</p>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex flex-wrap gap-2">
              {FILTERS.map(f => (
                <button key={f.key || 'all'} onClick={() => setFilterCat(f.key)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${filterCat === f.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {f.emoji} {f.label}
                </button>
              ))}
            </div>
            {universities.length > 0 && (
              <select value={filterUni || ''} onChange={e => setFilterUni(e.target.value || null)}
                className="input-field max-w-xs">
                <option value="">🎓 Tất cả trường</option>
                {universities.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            )}
          </div>

          {/* Events Grid */}
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <p className="text-5xl mb-4">📭</p>
              <p className="text-lg font-medium">Chưa có sự kiện nào sắp diễn ra.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filtered.map(e => {
                const upcoming = isUpcoming(e.date);
                const info = catInfo(e.category);
                return (
                  <div key={e.id} className={`card p-6 hover:shadow-lg transition-all duration-300 ${!upcoming ? 'opacity-60' : ''}`}>
                    <div className="flex justify-between items-start mb-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${upcoming ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                        {info.emoji} {info.label}
                      </span>
                      {!upcoming && <span className="text-xs bg-gray-100 text-gray-400 px-2 py-1 rounded">Đã diễn ra</span>}
                    </div>
                    {e.university && (
                      <p className="text-xs font-bold text-indigo-600 uppercase mb-1">🎓 {e.university}</p>
                    )}
                    <h3 className="text-lg font-bold text-gray-800 mb-2">{e.title}</h3>
                    {e.description && <p className="text-sm text-gray-600 mb-4 line-clamp-3">{e.description}</p>}

                    <div className="space-y-1.5 text-sm text-gray-500 mb-4">
                      <div className="flex items-center gap-2">
                        <span>📅</span>
                        <span>{formatDate(e.date)}</span>
                        {formatTime(e.date) && <span className="font-medium text-gray-700">• {formatTime(e.date)}</span>}
                      </div>
                      {e.location && (
                        <div className="flex items-center gap-2">
                          <span>📍</span>
                          <span>{e.location}</span>
                        </div>
                      )}
                    </div>

                    {upcoming && e.registrationLink && (
                      <a href={e.registrationLink} target="_blank" rel="noopener noreferrer"
                        className="inline-block w-full text-center py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition">
                        📝 Đăng ký tham gia →
                      </a>
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
