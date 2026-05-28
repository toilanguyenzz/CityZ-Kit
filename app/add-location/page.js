'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { addLocation, addReview } from '@/lib/firestore';
import { auth, db } from '@/lib/firebase';
import { uploadToCloudinary } from '@/lib/cloudinary';
import RatingStars from '@/components/RatingStars';
import { doc, getDoc } from 'firebase/firestore';
import useUserRole from '@/lib/useUserRole';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';

const MapComponent = dynamic(() => import('@/components/MapComponent'), { ssr: false });

const compressImage = (file) => {
  return new Promise((resolve) => {
    if (!file || !file.type.startsWith('image/')) {
      resolve(file);
      return;
    }
    console.log(`[Compression] Starting for ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            const MAX_WIDTH = 1200;
            const MAX_HEIGHT = 1200;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  console.log("[Compression] Failed to generate blob, using original file");
                  resolve(file);
                  return;
                }
                try {
                  const compressedFile = new File([blob], file.name, {
                    type: 'image/jpeg',
                    lastModified: Date.now(),
                  });
                  console.log(`[Compression] Success: ${file.name} compressed from ${(file.size / 1024 / 1024).toFixed(2)} MB to ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);
                  resolve(compressedFile);
                } catch (fileErr) {
                  console.warn("[Compression] File constructor failed, using Blob fallback:", fileErr);
                  blob.name = file.name;
                  resolve(blob);
                }
              },
              'image/jpeg',
              0.75
            );
          } catch (canvasErr) {
            console.error("[Compression] Canvas operations failed, using original file:", canvasErr);
            resolve(file);
          }
        };
        img.onerror = (imgErr) => {
          console.error("[Compression] Image load failed, using original file:", imgErr);
          resolve(file);
        };
        img.src = event.target.result;
      };
      reader.onerror = (readerErr) => {
        console.error("[Compression] FileReader failed, using original file:", readerErr);
        resolve(file);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("[Compression] Unhandled exception, using original file:", err);
      resolve(file);
    }
  });
};

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
  const [isMapManuallyPinned, setIsMapManuallyPinned] = useState(false);
  const [rating, setRating] = useState(5);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [debounceTimeout, setDebounceTimeout] = useState(null);

  const [mediaFiles, setMediaFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadStatus, setUploadStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const { role, isAdmin } = useUserRole();

  useEffect(() => {
    return () => {
      mediaFiles.forEach((item) => {
        if (item.preview && item.preview.startsWith('blob:')) {
          URL.revokeObjectURL(item.preview);
        }
      });
    };
  }, [mediaFiles]);

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
    setIsMapManuallyPinned(false); // User modified the text address manually

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
    setIsMapManuallyPinned(false); // Synced with suggestion
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleMapLocationChange = async (lat, lng) => {
    setCoords({ lat, lng });
    setIsMapManuallyPinned(true); // User manually clicked/dragged the map
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

  const handleGetCurrentGPS = () => {
    if (!navigator.geolocation) {
      toast.error('Trình duyệt của bạn không hỗ trợ định vị GPS');
      return;
    }
    
    const toastId = toast.loading('Đang lấy vị trí GPS...');
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        toast.dismiss(toastId);
        toast.success('Đã lấy vị trí GPS thành công!');
        
        // Cập nhật tọa độ
        setCoords({ lat: latitude, lng: longitude });
        setIsMapManuallyPinned(true); // Obtained from hardware GPS
        
        // Reverse geocode để lấy địa chỉ chữ
        try {
          setGeocoding(true);
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.display_name) {
              setFormData(prev => ({ ...prev, address: data.display_name }));
            }
          }
        } catch (error) {
          console.error(error);
        } finally {
          setGeocoding(false);
        }
      },
      (error) => {
        toast.dismiss(toastId);
        console.error(error);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast.error('Bạn đã từ chối quyền truy cập vị trí GPS.');
            break;
          case error.POSITION_UNAVAILABLE:
            toast.error('Thông tin vị trí không khả dụng.');
            break;
          case error.TIMEOUT:
            toast.error('Quá thời gian yêu cầu vị trí.');
            break;
          default:
            toast.error('Lỗi khi lấy vị trí GPS.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleMediaChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (mediaFiles.length + files.length > 9) {
      toast.error('Chỉ được tải lên tối đa 9 hình ảnh (dưới 10 cái)!');
      return;
    }

    const newFiles = files.map((file) => ({
      file,
      type: 'image',
      preview: URL.createObjectURL(file),
    }));

    setMediaFiles((prev) => [...prev, ...newFiles]);
  };

  const uploadLocationFile = (file, userId, onProgress) => {
    return uploadToCloudinary(file, onProgress);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) {
      toast.error('Vui lòng đăng nhập');
      return;
    }
    setLoading(true);
    let finalCoords = { ...coords };
    if (!isMapManuallyPinned && formData.address && formData.address.length >= 5) {
      setUploadStatus('Đang đồng bộ bản đồ...');
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(formData.address)}&countrycodes=vn`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) {
            finalCoords = {
              lat: parseFloat(data[0].lat),
              lng: parseFloat(data[0].lon)
            };
          }
        }
      } catch (err) {
        console.warn('Geocoding on submit failed:', err);
      }
    }

    setUploadStatus('Bắt đầu tải ảnh...');
    try {
      let creatorName = user.displayName || user.email?.split('@')[0] || 'User';
      let creatorAvatar = null;
      
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const uData = userDocSnap.data();
          creatorName = uData.name || creatorName;
          creatorAvatar = uData.avatarUrl || null;
        }
      } catch (err) {
        console.error('Error fetching user info for location:', err);
      }

      const uploadedMedia = [];
      for (let i = 0; i < mediaFiles.length; i++) {
        const item = mediaFiles[i];
        setUploadStatus(`Nén & Tải ảnh ${i + 1}/${mediaFiles.length}...`);
        const compressedFile = await compressImage(item.file);
        const uploadedItem = await uploadLocationFile(compressedFile, user.uid, (progress) => {
          setUploadProgress((prev) => ({ ...prev, [i]: Math.round(progress) }));
        });
        uploadedMedia.push(uploadedItem);
      }

      setUploadStatus('Đang tạo địa điểm...');

      const newLocationId = await addLocation({
        ...formData,
        latitude: finalCoords.lat,
        longitude: finalCoords.lng,
        createdByName: creatorName,
        createdByAvatar: creatorAvatar,
      }, null, user.uid, role, uploadedMedia);

      // Tự động tạo đánh giá đầu tiên với số sao người dùng đã chọn
      await addReview(
        newLocationId,
        user.uid,
        creatorName,
        rating,
        formData.description || 'Khởi tạo địa điểm'
      );

      toast.success(isAdmin ? 'Đã thêm địa điểm và đánh giá thành công!' : 'Đã gửi! Địa điểm đang chờ kiểm duyệt từ Admin.');
      router.push('/dashboard');
    } catch (error) {
      toast.error(error.message || 'Lỗi thêm địa điểm');
      console.error(error);
    } finally {
      setLoading(false);
      setUploadStatus('');
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
                        Đánh giá của bạn về địa điểm này ⭐
                      </label>
                      <div className="py-2.5 px-4 bg-gray-50 border border-gray-200 rounded-xl w-fit">
                        <RatingStars rating={rating} onRate={setRating} interactive />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1 ml-1">Số sao này sẽ được lưu làm đánh giá đầu tiên của bạn cho địa điểm.</p>
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
                        <button
                          type="button"
                          onClick={handleGetCurrentGPS}
                          className="mt-2.5 flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-xs font-semibold transition-colors outline-none"
                        >
                          🛰️ Lấy vị trí GPS hiện tại
                        </button>
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

                  {/* Right Column: Multi-Image Upload */}
                  <div className="space-y-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-2 ml-1">
                      Hình ảnh minh họa (tối đa 9 ảnh, dưới 10 cái)
                    </label>
                    <div className="relative group">
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleMediaChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className="relative w-full h-36 border-2 border-dashed border-gray-300 bg-gray-50 rounded-2xl group-hover:border-indigo-400 group-hover:bg-indigo-50/30 transition-all flex flex-col items-center justify-center p-4 text-center">
                        <div className="flex flex-col items-center justify-center space-y-1.5">
                          <div className="p-2.5 bg-indigo-100 rounded-full text-indigo-600 group-hover:scale-110 transition-transform">
                            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-700">Chọn hoặc kéo thả nhiều ảnh tại đây</p>
                            <p className="text-[10px] text-gray-400">PNG, JPG, JPEG (Tối đa 9 files)</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Previews grid */}
                    {mediaFiles.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 mt-4">
                        {mediaFiles.map((item, idx) => (
                          <div key={idx} className="relative w-full aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-100 group/item">
                            <img src={item.preview} alt={`Location ${idx}`} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => {
                                URL.revokeObjectURL(item.preview);
                                setMediaFiles((prev) => prev.filter((_, i) => i !== idx));
                              }}
                              className="absolute top-1.5 right-1.5 bg-red-500/90 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shadow-sm hover:bg-red-600 transition-colors"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
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
                        {uploadStatus || 'Đang xử lý...'}
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
