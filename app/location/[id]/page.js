'use client';

import { useState, useEffect } from 'react';
import '@/app/styles/blog.css';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { addReview, updateLocation, deleteLocation } from '@/lib/firestore';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import toast from 'react-hot-toast';
import RatingStars from '@/components/RatingStars';
import CommentSection from '@/components/CommentSection';
import useUserRole from '@/lib/useUserRole';
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

export default function LocationDetail() {
  const { id } = useParams();
  const router = useRouter();
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);

  // States for uploading more images
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [additionalFiles, setAdditionalFiles] = useState([]);
  const [uploadingMore, setUploadingMore] = useState(false);

  // Lightbox Zoom & Pan State
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxScale, setLightboxScale] = useState(1);
  const [lightboxPosition, setLightboxPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Edit & Delete states
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('Food');
  const [editAddress, setEditAddress] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editVideoUrl, setEditVideoUrl] = useState('');
  const [editCoords, setEditCoords] = useState({ lat: 10.7769, lng: 106.7009 });
  const [currentMediaList, setCurrentMediaList] = useState([]);
  const [editMediaFiles, setEditMediaFiles] = useState([]);
  const [saving, setSaving] = useState(false);

  const startEditing = () => {
    if (!location) return;
    setEditName(location.name || '');
    setEditCategory(location.category || 'Food');
    setEditAddress(location.address || '');
    setEditDescription(location.description || '');
    setEditVideoUrl(location.videoUrl || '');
    setEditCoords({ lat: location.latitude || 10.7769, lng: location.longitude || 106.7009 });
    
    let initialMedia = location.media || [];
    if (initialMedia.length === 0 && location.imageUrl) {
      initialMedia = [{ type: 'image', url: location.imageUrl }];
    }
    setCurrentMediaList(initialMedia);
    setEditMediaFiles([]);
    setIsEditing(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editName.trim()) return toast.error('Vui lòng nhập tên địa điểm');
    if (!editAddress.trim()) return toast.error('Vui lòng nhập địa chỉ');
    if (!editDescription.trim()) return toast.error('Vui lòng nhập mô tả');

    setSaving(true);
    const toastId = toast.loading('Đang lưu thay đổi...');
    try {
      // Upload any new images
      const uploadedItems = [];
      for (let i = 0; i < editMediaFiles.length; i++) {
        const item = editMediaFiles[i];
        const compressedFile = await compressImage(item.file);
        const uploadedItem = await uploadToCloudinary(compressedFile);
        uploadedItems.push(uploadedItem);
      }

      // Merge remaining existing media and new uploaded media
      const mergedMedia = [...currentMediaList, ...uploadedItems];

      const updatedData = {
        name: editName.trim(),
        category: editCategory,
        address: editAddress.trim(),
        description: editDescription.trim(),
        videoUrl: editVideoUrl.trim() || null,
        latitude: editCoords.lat,
        longitude: editCoords.lng,
        media: mergedMedia,
        imageUrl: mergedMedia.length > 0 ? mergedMedia[0].url : null,
      };

      await updateLocation(id, updatedData);
      toast.success('Đã cập nhật địa điểm thành công!', { id: toastId });
      setIsEditing(false);
      await fetchLocation();
    } catch (err) {
      toast.error('Lỗi khi cập nhật địa điểm: ' + err.message, { id: toastId });
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa địa điểm này không?')) return;
    try {
      await deleteLocation(id);
      toast.success('Đã xóa địa điểm thành công!');
      router.push('/dashboard');
    } catch (err) {
      toast.error('Lỗi khi xóa địa điểm: ' + err.message);
      console.error(err);
    }
  };

  const handleCloseLightbox = () => {
    setIsLightboxOpen(false);
    handleResetZoom();
  };

  const handleZoomIn = () => {
    setLightboxScale(prev => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = () => {
    setLightboxScale(prev => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) {
        setLightboxPosition({ x: 0, y: 0 });
      }
      return next;
    });
  };

  const handleResetZoom = () => {
    setLightboxScale(1);
    setLightboxPosition({ x: 0, y: 0 });
  };

  const handlePrevLightboxImage = (e) => {
    e.stopPropagation();
    handleResetZoom();
    setActiveMediaIndex((prev) => (prev === 0 ? location.media.length - 1 : prev - 1));
  };

  const handleNextLightboxImage = (e) => {
    e.stopPropagation();
    handleResetZoom();
    setActiveMediaIndex((prev) => (prev === location.media.length - 1 ? 0 : prev + 1));
  };

  const handlePanStart = (e) => {
    if (lightboxScale <= 1) return;
    setIsPanning(true);
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setPanStart({
      x: clientX - lightboxPosition.x,
      y: clientY - lightboxPosition.y
    });
  };

  const handlePanMove = (e) => {
    if (!isPanning || lightboxScale <= 1) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setLightboxPosition({
      x: clientX - panStart.x,
      y: clientY - panStart.y
    });
  };

  const handlePanEnd = () => {
    setIsPanning(false);
  };

  const { user, role, isAdmin } = useUserRole();

  useEffect(() => {
    return () => {
      additionalFiles.forEach(item => {
        if (item.preview && item.preview.startsWith('blob:')) {
          URL.revokeObjectURL(item.preview);
        }
      });
      editMediaFiles.forEach(item => {
        if (item.preview && item.preview.startsWith('blob:')) {
          URL.revokeObjectURL(item.preview);
        }
      });
    };
  }, [additionalFiles, editMediaFiles]);

  useEffect(() => {
    fetchLocation();
  }, [id]);

  const fetchLocation = async () => {
    try {
      const docRef = doc(db, 'locations', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const isApproved = data.status === 'approved' || !data.status;
        const isCreator = user && data.createdBy === user.uid;
        if (!isApproved && !isAdmin && !isCreator) {
          toast.error('Địa điểm này đang chờ duyệt.');
          router.push('/dashboard');
          return;
        }
        setLocation({ id: docSnap.id, ...data });
      } else {
        toast.error('Không tìm thấy địa điểm');
        router.push('/dashboard');
      }
    } catch (error) {
      toast.error('Lỗi tải địa điểm');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) {
      toast.error('Vui lòng đăng nhập');
      return;
    }
    try {
      await addReview(id, user.uid, user.displayName || user.email || 'Sinh viên ẩn danh', rating, comment);
      await fetchLocation();
      setComment('');
      toast.success('Đã gửi đánh giá!');
    } catch (error) {
      toast.error('Lỗi gửi đánh giá');
    }
  };

  const handleUploadPanelFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    const currentMediaCount = location.media ? location.media.length : (location.imageUrl ? 1 : 0);
    if (currentMediaCount + additionalFiles.length + files.length > 9) {
      toast.error(`Tổng số lượng ảnh không được vượt quá 9! Hiện tại đã có ${currentMediaCount} ảnh.`);
      return;
    }

    const newFiles = files.map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }));
    setAdditionalFiles(prev => [...prev, ...newFiles]);
  };

  const uploadLocationFile = (file, userId) => {
    return uploadToCloudinary(file);
  };

  const handleUploadMoreImages = async () => {
    if (additionalFiles.length === 0) return;
    setUploadingMore(true);
    const toastId = toast.loading('Đang nén & tải lên các ảnh mới...');
    try {
      const uploadedItems = [];
      for (let i = 0; i < additionalFiles.length; i++) {
        const item = additionalFiles[i];
        const compressedFile = await compressImage(item.file);
        const uploadedItem = await uploadLocationFile(compressedFile, user.uid);
        uploadedItems.push(uploadedItem);
      }

      // Merge with existing media
      let currentMedia = location.media || [];
      if (currentMedia.length === 0 && location.imageUrl) {
        currentMedia = [{ type: 'image', url: location.imageUrl }];
      }

      const updatedMedia = [...currentMedia, ...uploadedItems];
      const locRef = doc(db, 'locations', id);
      await updateDoc(locRef, {
        media: updatedMedia,
        imageUrl: updatedMedia[0].url // update main fallback as well
      });

      toast.success('Đã tải lên ảnh minh họa mới thành công!', { id: toastId });
      setAdditionalFiles([]);
      setShowUploadPanel(false);
      await fetchLocation();
    } catch (error) {
      toast.error('Lỗi khi tải lên hình ảnh bổ sung: ' + error.message, { id: toastId });
      console.error(error);
    } finally {
      setUploadingMore(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>
      </div>
    );
  }

  if (!location) return null;

  const currentMediaCount = location.media ? location.media.length : (location.imageUrl ? 1 : 0);
  const canEdit = user && location && (location.createdBy === user.uid || isAdmin);
  const canAddMore = canEdit && currentMediaCount < 9;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            {isEditing ? (
              <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Chỉnh sửa địa điểm</h2>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Tên địa điểm</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Danh mục</label>
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
                    >
                      <option value="Food">Ăn uống</option>
                      <option value="Housing">Nhà trọ</option>
                      <option value="Cafe">Cafe</option>
                      <option value="Play">Vui chơi</option>
                      <option value="Other">Khác</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Địa chỉ</label>
                    <input
                      type="text"
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Mô tả</label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    required
                    rows="4"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Link video ngắn (tùy chọn)</label>
                  <input
                    type="url"
                    value={editVideoUrl}
                    onChange={(e) => setEditVideoUrl(e.target.value)}
                    placeholder="https://... (link video .mp4)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
                  />
                </div>

                <div className="space-y-4 pt-2">
                  <div className="border-t border-gray-100 pt-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Vị trí bản đồ (Kéo ghim hoặc click trên bản đồ để chọn lại vị trí chính xác)</label>
                    <div className="rounded-xl overflow-hidden border border-gray-200">
                      <MapComponent
                        latitude={editCoords.lat}
                        longitude={editCoords.lng}
                        onChangeLocation={(lat, lng) => setEditCoords({ lat, lng })}
                      />
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-4 space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Hình ảnh hiện tại (Có thể xóa bớt ảnh bị sai)</label>
                      {currentMediaList.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">Không có hình ảnh nào.</p>
                      ) : (
                        <div className="grid grid-cols-4 gap-2">
                          {currentMediaList.map((item, idx) => (
                            <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                              <img src={item.url} alt="existing media" className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => {
                                  setCurrentMediaList(prev => prev.filter((_, i) => i !== idx));
                                }}
                                className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shadow-sm border border-white/20 cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Tải thêm hình ảnh mới (Tối đa 9 ảnh tổng cộng)</label>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          if (currentMediaList.length + editMediaFiles.length + files.length > 9) {
                            toast.error("Tổng số hình ảnh không được vượt quá 9!");
                            return;
                          }
                          const newFiles = files.map(file => ({
                            file,
                            preview: URL.createObjectURL(file)
                          }));
                          setEditMediaFiles(prev => [...prev, ...newFiles]);
                        }}
                        className="text-xs text-gray-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 cursor-pointer"
                      />
                      {editMediaFiles.length > 0 && (
                        <div className="grid grid-cols-4 gap-2 mt-2">
                          {editMediaFiles.map((fileObj, idx) => (
                            <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                              <img src={fileObj.preview} alt="new upload preview" className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => {
                                  URL.revokeObjectURL(fileObj.preview);
                                  setEditMediaFiles(prev => prev.filter((_, i) => i !== idx));
                                }}
                                className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shadow-sm border border-white/20 cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50 transition"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
                  >
                    {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                </div>
              </form>
            ) : (
              <>
                {/* Media Gallery / Slideshow */}
                {location.media && location.media.length > 0 ? (
                  <div className="pd-media-carousel">
                    <div className="pd-media-viewer" style={{ height: '320px', position: 'relative' }}>
                      <img
                        src={location.media[activeMediaIndex].url}
                        alt={`Media ${activeMediaIndex + 1}`}
                        className="pd-media-main-img"
                        onClick={() => setIsLightboxOpen(true)}
                        style={{ cursor: 'zoom-in' }}
                      />

                      <button
                        onClick={() => setIsLightboxOpen(true)}
                        className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 text-white w-10 h-10 rounded-full flex items-center justify-center transition-colors z-20 border-none"
                        title="Phóng to ảnh"
                        style={{ cursor: 'pointer' }}
                      >
                        🔍
                      </button>

                      {location.media.length > 1 && (
                        <>
                          <button
                            onClick={() => setActiveMediaIndex((prev) => (prev === 0 ? location.media.length - 1 : prev - 1))}
                            className="pd-carousel-nav pd-carousel-prev"
                            title="Ảnh trước"
                          >
                            ‹
                          </button>
                          <button
                            onClick={() => setActiveMediaIndex((prev) => (prev === location.media.length - 1 ? 0 : prev + 1))}
                            className="pd-carousel-nav pd-carousel-next"
                            title="Ảnh sau"
                          >
                            ›
                          </button>
                        </>
                      )}
                    </div>

                    {location.media.length > 1 && (
                      <div className="pd-media-thumbnails">
                        {location.media.map((item, idx) => (
                          <button
                            key={idx}
                            onClick={() => setActiveMediaIndex(idx)}
                            className={`pd-thumbnail-btn ${idx === activeMediaIndex ? 'active' : ''}`}
                          >
                            <img src={item.url} alt={`Thumbnail ${idx + 1}`} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : location.imageUrl ? (
                  <div className="relative h-72 w-full bg-gray-200">
                    <img src={location.imageUrl} alt={location.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="relative h-72 w-full bg-gray-200 flex items-center justify-center text-gray-400">No image</div>
                )}
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                        {location.name}
                      </h1>
                    </div>
                    {location.reviewCount >= 3 && (
                      <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">✓ Verified</span>
                    )}
                  </div>

                  {canEdit && (
                    <div className="flex flex-col sm:flex-row gap-3 mb-6 bg-slate-50 border border-slate-200/80 rounded-2xl p-4 items-start sm:items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-700">⚙️ Quản lý địa điểm của bạn:</span>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button
                          onClick={startEditing}
                          className="flex-1 sm:flex-initial flex items-center justify-center gap-1 bg-white hover:bg-slate-50 text-blue-600 border border-slate-200 text-xs font-bold py-2 px-4 rounded-xl shadow-sm transition cursor-pointer"
                        >
                          ✏️ Chỉnh sửa thông tin
                        </button>
                        <button
                          onClick={handleDelete}
                          className="flex-1 sm:flex-initial flex items-center justify-center gap-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 text-xs font-bold py-2 px-4 rounded-xl transition cursor-pointer"
                        >
                          🗑️ Xóa địa điểm
                        </button>
                      </div>
                    </div>
                  )}
                  <p className="text-gray-600 mb-1"><span className="font-semibold">Danh mục:</span> {location.category}</p>
                  <p className="text-gray-600 mb-1"><span className="font-semibold">Địa chỉ:</span> {location.address}</p>
                  <p className="text-gray-700 mt-4">{location.description}</p>
                  <div className="mt-4 flex items-center">
                    <span className="font-semibold text-gray-700 mr-2">Đánh giá:</span>
                    <RatingStars rating={location.averageRating || 0} />
                    <span className="ml-2 text-gray-500">({location.reviewCount} nhận xét)</span>
                  </div>

                  {/* Owner/Admin upload more images section */}
                  {canAddMore && (
                    <div className="mt-6 border-t border-gray-100 pt-6">
                      {showUploadPanel ? (
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                          <h3 className="text-sm font-bold text-gray-700 mb-2">Thêm hình ảnh minh họa</h3>
                          <p className="text-xs text-gray-500 mb-3">Bạn có thể đăng tải tối đa {9 - currentMediaCount} ảnh nữa (tối đa 9 ảnh cho mỗi địa điểm).</p>
                          
                          <div className="flex flex-col gap-3">
                            <input
                              type="file"
                              multiple
                              accept="image/*"
                              onChange={handleUploadPanelFileChange}
                              className="text-xs text-gray-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 cursor-pointer"
                            />
                            
                            {/* Preview grid */}
                            {additionalFiles.length > 0 && (
                              <div className="grid grid-cols-4 gap-2 mt-2">
                                {additionalFiles.map((fileObj, idx) => (
                                  <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                                    <img src={fileObj.preview} alt="preview" className="w-full h-full object-cover" />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        URL.revokeObjectURL(fileObj.preview);
                                        setAdditionalFiles(prev => prev.filter((_, i) => i !== idx));
                                      }}
                                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[8px] font-bold shadow-sm"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="flex gap-2 justify-end mt-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setShowUploadPanel(false);
                                  setAdditionalFiles([]);
                                }}
                                className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 transition"
                              >
                                Hủy
                              </button>
                              <button
                                type="button"
                                disabled={uploadingMore || additionalFiles.length === 0}
                                onClick={handleUploadMoreImages}
                                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white text-xs font-bold rounded-xl shadow-sm transition"
                              >
                                {uploadingMore ? `Đang tải...` : 'Tải lên'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowUploadPanel(true)}
                          className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition"
                        >
                          📷 Thêm hình ảnh minh họa địa điểm
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ───── Video Short ───── */}
          {location.videoUrl && (
            <div className="bg-white rounded-xl shadow-md p-6 mb-8">
              <h2 className="text-lg font-bold text-gray-900 mb-3">🎬 Video ngắn</h2>
              <div style={{ borderRadius: '0.75rem', overflow: 'hidden', background: '#000', maxHeight: '400px' }}>
                <video
                  src={location.videoUrl}
                  controls
                  playsInline
                  preload="metadata"
                  poster={location.imageUrl || undefined}
                  style={{ width: '100%', maxHeight: '400px', objectFit: 'contain' }}
                />
              </div>
            </div>
          )}
          {/* ───── OpenStreetMap ───── */}
          {location.address && (
            <div className="db-map-section mt-8">
              <h2 className="db-map-header">
                <span>📍</span> Bản đồ vị trí
              </h2>
              {(() => {
                const mapLat = location.latitude || 10.7769;
                const mapLng = location.longitude || 106.7009;
                const bbox = `${mapLng - 0.005},${mapLat - 0.005},${mapLng + 0.005},${mapLat + 0.005}`;
                return (
                  <>
                    <iframe
                      className="db-map-frame"
                      title="Bản đồ địa điểm"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${mapLat},${mapLng}`}
                      loading="lazy"
                      style={{ width: '100%', height: '350px', border: 'none' }}
                    />
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', padding: '0.75rem 1.5rem 1rem', flexWrap: 'wrap', borderTop: '1px solid var(--blog-divider)' }}>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${mapLat},${mapLng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs md:text-sm font-bold px-4 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all text-decoration-none border-none cursor-pointer"
                        style={{ textDecoration: 'none' }}
                      >
                        🚗 Chỉ đường Google Maps
                      </a>
                      <a
                        href={`https://maps.apple.com/?daddr=${mapLat},${mapLng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs md:text-sm font-bold px-4 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all text-decoration-none border-none cursor-pointer"
                        style={{ textDecoration: 'none' }}
                      >
                        🍎 Apple Maps (iOS)
                      </a>
                      <a
                        href={`https://www.openstreetmap.org/directions?route=%3B${mapLat}%2C${mapLng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs md:text-sm font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all border border-gray-200 text-decoration-none cursor-pointer"
                        style={{ textDecoration: 'none' }}
                      >
                        🗺️ OpenStreetMap
                      </a>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
          <div className="mt-8 bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Viết đánh giá</h2>
            <form onSubmit={handleSubmitReview} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số sao</label>
                <RatingStars rating={rating} onRate={setRating} interactive />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nhận xét</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows="3"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition"
              >
                Gửi đánh giá
              </button>
            </form>
          </div>

          <div className="mt-8 bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Các nhận xét ({location.reviewCount || 0})</h2>
            <CommentSection reviews={location.reviews || []} locationId={id} onRefresh={fetchLocation} />
          </div>

          {/* Lightbox Modal with Zoom & Pan */}
          {isLightboxOpen && (
            <div 
              className="fixed inset-0 bg-black/95 backdrop-blur-md z-[9999] flex flex-col items-center justify-center select-none"
              onKeyDown={(e) => {
                if (e.key === 'Escape') handleCloseLightbox();
              }}
              tabIndex={0}
              style={{ outline: 'none' }}
            >
              {/* Close Button */}
              <button
                onClick={handleCloseLightbox}
                className="absolute top-6 right-6 text-white bg-white/10 hover:bg-white/20 w-12 h-12 rounded-full flex items-center justify-center text-2xl transition-colors border-none cursor-pointer z-50"
                title="Đóng (Esc)"
              >
                ✕
              </button>

              {/* Carousel Navigation in Lightbox */}
              {location.media && location.media.length > 1 && (
                <>
                  <button
                    onClick={handlePrevLightboxImage}
                    className="absolute left-6 top-1/2 -translate-y-1/2 text-white bg-white/10 hover:bg-white/20 w-14 h-14 rounded-full flex items-center justify-center text-3xl transition-colors border-none cursor-pointer z-50"
                    title="Ảnh trước"
                  >
                    ‹
                  </button>
                  <button
                    onClick={handleNextLightboxImage}
                    className="absolute right-6 top-1/2 -translate-y-1/2 text-white bg-white/10 hover:bg-white/20 w-14 h-14 rounded-full flex items-center justify-center text-3xl transition-colors border-none cursor-pointer z-50"
                    title="Ảnh sau"
                  >
                    ›
                  </button>
                </>
              )}

              {/* Large Image Container */}
              <div 
                className="relative w-full h-[80vh] flex items-center justify-center overflow-hidden"
                onMouseMove={handlePanMove}
                onMouseUp={handlePanEnd}
                onMouseLeave={handlePanEnd}
                onTouchMove={handlePanMove}
                onTouchEnd={handlePanEnd}
              >
                <img
                  src={location.media[activeMediaIndex].url}
                  alt="Zoomed media"
                  style={{
                    maxHeight: '100%',
                    maxWidth: '100%',
                    objectFit: 'contain',
                    transform: `translate(${lightboxPosition.x}px, ${lightboxPosition.y}px) scale(${lightboxScale})`,
                    transition: isPanning ? 'none' : 'transform 0.2s cubic-bezier(0.1, 0.76, 0.55, 0.94)',
                    cursor: lightboxScale > 1 ? (isPanning ? 'grabbing' : 'grab') : 'zoom-in',
                    userSelect: 'none',
                    touchAction: lightboxScale > 1 ? 'none' : 'auto',
                  }}
                  onMouseDown={handlePanStart}
                  onTouchStart={handlePanStart}
                  onClick={(e) => {
                    if (lightboxScale === 1) {
                      setLightboxScale(2);
                    } else {
                      handleResetZoom();
                    }
                  }}
                />
              </div>

              {/* Zoom Control Bar */}
              <div className="absolute bottom-8 bg-black/60 backdrop-blur-sm border border-white/10 rounded-2xl px-6 py-3 flex items-center gap-6 z-50 text-white text-sm">
                <button 
                  onClick={handleZoomOut}
                  className="bg-transparent border-none text-white text-lg hover:text-blue-400 cursor-pointer disabled:opacity-30 transition-colors"
                  disabled={lightboxScale <= 1}
                  title="Thu nhỏ"
                >
                  ➖
                </button>
                
                <button 
                  onClick={handleResetZoom}
                  className="bg-white/10 hover:bg-white/20 border-none text-white px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                  title="Khôi phục kích thước"
                >
                  🔍 {Math.round(lightboxScale * 100)}%
                </button>

                <button 
                  onClick={handleZoomIn}
                  className="bg-transparent border-none text-white text-lg hover:text-blue-400 cursor-pointer disabled:opacity-30 transition-colors"
                  disabled={lightboxScale >= 4}
                  title="Phóng to"
                >
                  ➕
                </button>
              </div>

              {/* Image index counter */}
              <div className="absolute top-8 left-1/2 -translate-x-1/2 text-white/60 text-sm font-medium">
                Ảnh {activeMediaIndex + 1} / {location.media.length}
              </div>
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
