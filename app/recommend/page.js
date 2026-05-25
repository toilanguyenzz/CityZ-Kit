'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function RecommendPage() {
  const [budget, setBudget] = useState('');
  const [foodType, setFoodType] = useState('');
  const [district, setDistrict] = useState('');
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [infoMessage, setInfoMessage] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfoMessage('');
    setRecommendations([]);
    setHasSearched(false);
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budget, foodType: foodType.toLowerCase(), district }),
      });
      const data = await res.json();
      if (res.ok) {
        setRecommendations(data.recommendations || []);
        if (data.message) {
          setInfoMessage(data.message);
        }
        setHasSearched(true);
      } else {
        setError(data.error || 'Lỗi khi gọi AI');
      }
    } catch (err) {
      setError('Lỗi kết nối API');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Gợi ý thông minh</h1>
          <p className="text-gray-600 mb-6">Chọn tiêu chí để nhận gợi ý địa điểm phù hợp nhất từ AI</p>
          <div className="bg-white rounded-xl shadow-md p-6 mb-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ngân sách (VND/tháng)</label>
                <select
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Chọn --</option>
                  <option value="<2M">&lt; 2 triệu</option>
                  <option value="2-4M">2 - 4 triệu</option>
                  <option value=">4M">&gt; 4 triệu</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loại ẩm thực yêu thích</label>
                <select
                  value={foodType}
                  onChange={(e) => setFoodType(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Chọn --</option>
                  <option value="Vietnamese">Việt Nam</option>
                  <option value="Japanese">Nhật Bản</option>
                  <option value="Fast Food">Fast Food</option>
                  <option value="Seafood">Hải sản</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quận hiện tại</label>
                <select
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Chọn --</option>
                  <option value="1">Quận 1</option>
                  <option value="3">Quận 3</option>
                  <option value="4">Quận 4</option>
                  <option value="5">Quận 5</option>
                  <option value="7">Quận 7</option>
                  <option value="Binh Thanh">Bình Thạnh</option>
                  <option value="Thu Duc">Thủ Đức</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition disabled:opacity-50"
              >
                {loading ? 'AI đang suy nghĩ...' : 'Nhận gợi ý'}
              </button>
            </form>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {infoMessage && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-center font-medium">
              {infoMessage}
            </div>
          )}

          {hasSearched && recommendations.length === 0 && !infoMessage && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg text-center font-medium">
              Không tìm thấy gợi ý nào phù hợp. Vui lòng thêm địa điểm mới vào hệ thống trước!
            </div>
          )}

          {recommendations.length > 0 && (
            <div className="mt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Gợi ý cho bạn</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {recommendations.map((rec, idx) => (
                  <div key={idx} className="bg-white rounded-xl shadow-md p-5 border-l-4 border-blue-500">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{rec.name}</h3>
                    <p className="text-gray-600">{rec.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
