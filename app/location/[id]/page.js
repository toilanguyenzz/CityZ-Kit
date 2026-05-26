'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db, storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { addReview } from '@/lib/firestore';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import toast from 'react-hot-toast';
import RatingStars from '@/components/RatingStars';
import CommentSection from '@/components/CommentSection';
import useUserRole from '@/lib/useUserRole';

const compressImage = (file) => {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
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
              resolve(file);
              return;
            }
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          'image/jpeg',
          0.75
        );
      };
      img.onerror = () => resolve(file);
      img.src = event.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
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

  const { user, role, isAdmin } = useUserRole();

  useEffect(() => {
    return () => {
      additionalFiles.forEach(item => {
        if (item.preview && item.preview.startsWith('blob:')) {
          URL.revokeObjectURL(item.preview);
        }
      });
    };
  }, [additionalFiles]);

  useEffect(() => {
    fetchLocation();
  }, [id]);

  const fetchLocation = async () => {
    try {
      const docRef = doc(db, 'locations', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setLocation({ id: docSnap.id, ...docSnap.data() });
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
    return new Promise((resolve, reject) => {
      const timestamp = Date.now();
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const storagePath = `locations/${userId}/${timestamp}_${cleanFileName}`;
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        null,
        (error) => reject(error),
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({
            type: 'image',
            url: downloadURL,
          });
        }
      );
    });
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
            {/* Media Gallery / Slideshow */}
            {location.media && location.media.length > 0 ? (
              <div className="pd-media-carousel">
                <div className="pd-media-viewer" style={{ height: '320px' }}>
                  <img
                    src={location.media[activeMediaIndex].url}
                    alt={`Media ${activeMediaIndex + 1}`}
                    className="pd-media-main-img"
                  />

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
                <h1 className="text-2xl font-bold text-gray-900">{location.name}</h1>
                {location.reviewCount >= 3 && (
                  <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">✓ Verified</span>
                )}
              </div>
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
                  <iframe
                    className="db-map-frame"
                    title="Bản đồ địa điểm"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${mapLat},${mapLng}`}
                    loading="lazy"
                    style={{ width: '100%', height: '350px', border: 'none' }}
                  />
                );
              })()}
              <div style={{ padding: '0.75rem 1.5rem 1rem', textAlign: 'right' }}>
                <a
                  href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(location.address + ', TP.HCM, Việt Nam')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  🗺️ Xem bản đồ lớn hơn →
                </a>
              </div>
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
            <CommentSection reviews={location.reviews || []} />
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
