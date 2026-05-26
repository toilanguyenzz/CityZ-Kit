'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { addReview } from '@/lib/firestore';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import toast from 'react-hot-toast';
import RatingStars from '@/components/RatingStars';
import CommentSection from '@/components/CommentSection';

export default function LocationDetail() {
  const { id } = useParams();
  const router = useRouter();
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>
      </div>
    );
  }

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
