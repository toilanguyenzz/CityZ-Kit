'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { addLocation } from '@/lib/firestore';
import { auth } from '@/lib/firebase';
import useUserRole from '@/lib/useUserRole';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';

const MapComponent = dynamic(() => import('@/components/MapComponent'), { ssr: false });

export default function AddLocation() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    category: 'Food',
    address: '',
    description: '',
    videoUrl: '',
  });
  const [coords, setCoords] = useState({ lat: 10.7769, lng: 106.7009 }); // Mặc định TT TP.HCM
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [debounceTimeout, setDebounceTimeout] = useState(null);

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const { role, isAdmin } = useUserRole();

  // Đóng danh sách gợi ý khi bấm ra ngoài
  useEffect(() => {
    const handleOutsideClick = () => {
      setShowSuggestions(false);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAddressChange = (e) => {
    const value = e.target.value;
    setFormData({ ...formData, address: value });
    setShowSuggestions(true);

    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }

    setDebounceTimeout(
      setTimeout(() => {
        fetchAddressSuggestions(value);
      }, 600)
    );
  };

  const fetchAddressSuggestions = async (queryText) => {
    if (!queryText || queryText.length < 3) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(queryText)}&countrycodes=vn`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.map(item => ({
          display_name: item.display_name,
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon)
        })));
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  const handleSelectSuggestion = (suggestion) => {
    setFormData({ ...formData, address: suggestion.display_name });
    setCoords({ lat: suggestion.lat, lng: suggestion.lon });
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleMapLocationChange = async (lat, lng) => {
    setCoords({ lat, lng });
    try {
      setGeocoding(true);
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.display_name) {
          setFormData(prev => ({ ...prev, address: data.display_name }));
        }
      }
    } catch (error) {
      console.error('Error reverse geocoding:', error);
    } finally {
      setGeocoding(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) {
      toast.error('Vui lòng đăng nhập');
      return;
    }
    setLoading(true);
    try {
      await addLocation({
        ...formData,
        latitude: coords.lat,
        longitude: coords.lng
      }, imageFile, user.uid, role);
      toast.success(isAdmin ? 'Đã thêm địa điểm thành công!' : 'Đã gửi! Địa điểm đang chờ kiểm duyệt từ Admin.');
      router.push('/dashboard');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50">
        <Navbar />
        <main className="max-w-3xl mx-auto px-4 py-12">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-3">
              Thêm Địa Điểm Mới
            </h1>
            <p className="text-gray-600 text-lg">
              Chia sẻ những địa điểm tuyệt vời của bạn với cộng đồng sinh viên.
            </p>
          </div>

          <div className="bg-white rounded-3xl shadow-xl shadow-indigo-100/50 border border-indigo-50 overflow-hidden">
            <div className="p-8 md:p-12">
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Left Column: Basic Info */}
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2 ml-1">
                        Tên địa điểm
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </div>
                        <input
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          required
                          placeholder="Ví dụ: Cơm tấm Bụi"
                          className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none placeholder-gray-400"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2 ml-1">
                        Danh mục
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.539 0 .994.461 1.034 1.015l.02.64C13 8.446 13 12 13 12s0 3.554 1.015 5.36l.02.64C14.006 20.539 14.461 21 15 21h5m-13-13h.01M7 17h.01" />
                          </svg>
                        </div>
                        <select
                          name="category"
                          value={formData.category}
                          onChange={handleChange}
                          className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none appearance-none"
                        >
                          <option value="Food">Ăn uống</option>
                          <option value="Housing">Nhà trọ</option>
                          <option value="Cafe">Cafe</option>
                          <option value="Play">Vui chơi</option>
                          <option value="Other">Khác</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                          <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2 ml-1">
                        Địa chỉ
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </div>
                        <input
                          type="text"
                          name="address"
                          value={formData.address}
                          onChange={handleAddressChange}
                          onFocus={() => setShowSuggestions(true)}
                          onClick={(e) => e.stopPropagation()}
                          required
                          placeholder="Nhập địa chỉ hoặc ghim trên bản đồ"
                          className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none placeholder-gray-400"
                        />
                        {geocoding && (
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <svg className="animate-spin h-5 w-5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <circle className="opacity-75" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                            </svg>
                          </div>
                        )}
                        
                        {/* Address Autocomplete Dropdown */}
                        {showSuggestions && suggestions.length > 0 && (
                          <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl shadow-indigo-100/40 z-50 max-h-60 overflow-y-auto outline-none">
                            {suggestions.map((s, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectSuggestion(s);
                                }}
                                className="w-full text-left px-4 py-3 hover:bg-indigo-50/50 text-sm text-gray-700 border-b border-gray-50 last:border-0 truncate transition-colors outline-none"
                              >
                                📍 {s.display_name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Image Upload */}
                  <div className="space-y-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-2 ml-1">
                      Hình ảnh minh họa
                    </label>
                    <div className="relative group">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className={`
                        relative w-full h-64 border-2 border-dashed rounded-2xl transition-all flex flex-col items-center justify-center p-4 text-center
                        ${imagePreview ? 'border-indigo-300 bg-indigo-50/30' : 'border-gray-300 bg-gray-50 group-hover:border-indigo-400 group-hover:bg-indigo-50/50'}
                      `}>
                        {imagePreview ? (
                          <div className="relative w-full h-full">
                            <img
                              src={imagePreview}
                              alt="Preview"
                              className="w-full h-full object-cover rounded-xl shadow-sm"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                              <p className="text-white font-medium text-sm">Thay đổi ảnh</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center space-y-3">
                            <div className="p-3 bg-indigo-100 rounded-full text-indigo-600 group-hover:scale-110 transition-transform">
                              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 12h.01M16 12h.01M12 16h.01M16 16h.01" />
                              </svg>
                            </div>
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-gray-700">Nhấp để tải ảnh lên</p>
                              <p className="text-xs text-gray-500">PNG, JPG hoặc JPEG (Max. 5MB)</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Map Section */}
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-gray-700 ml-1">
                    Định vị trên bản đồ (Kéo ghim hoặc click trên bản đồ để chọn vị trí chính xác)
                  </label>
                  <MapComponent
                    latitude={coords.lat}
                    longitude={coords.lng}
                    onChangeLocation={handleMapLocationChange}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2 ml-1">
                    Mô tả chi tiết
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows="4"
                    required
                    placeholder="Chia sẻ thêm về giá cả, chất lượng, lưu ý khi đến đây..."
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none placeholder-gray-400"
                  />
                </div>

                {/* Video URL */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2 ml-1">
                    Link video ngắn (tùy chọn) 🎬
                  </label>
                  <input
                    type="url"
                    name="videoUrl"
                    value={formData.videoUrl}
                    onChange={handleChange}
                    placeholder="https://... (link video .mp4 hoặc YouTube Shorts)"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none placeholder-gray-400"
                  />
                  <p className="text-xs text-gray-400 ml-1">
                    💡 Gắn video ngắn để địa điểm xuất hiện trên CityZ Shorts. Hỗ trợ link .mp4 trực tiếp.
                  </p>
                </div>

                <div className="pt-6 flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => router.push('/dashboard')}
                    className="px-6 py-3 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    Quay lại
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 md:flex-none px-10 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <circle className="opacity-75" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                        </svg>
                        Đang xử lý...
                      </span>
                    ) : 'Thêm địa điểm'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
