'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import Navbar from '@/components/Navbar';
import ProtectedRoute from '@/components/ProtectedRoute';
import toast from 'react-hot-toast';
import useUserRole from '@/lib/useUserRole';
import { updateMarketplaceItem, deleteMarketplaceItem, createMarketplaceConnection } from '@/lib/firestore';
import { uploadToCloudinary } from '@/lib/cloudinary';

const CATEGORIES = [
  { key: null, label: 'Tất cả', emoji: '🌐' },
  { key: 'textbook', label: 'Giáo trình', emoji: '📚' },
  { key: 'dorm_item', label: 'Đồ dùng KTX', emoji: '🛏️' },
  { key: 'electronic', label: 'Điện tử', emoji: '💻' },
  { key: 'other', label: 'Khác', emoji: '🏷️' },
];

const CONDITIONS = [
  { key: 'like_new', label: 'Như mới' },
  { key: 'used_good', label: 'Đã dùng - Tốt' },
  { key: 'used_fair', label: 'Đã dùng - Khá' },
];

export default function MarketplacePage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, isAdmin, userData } = useUserRole();
  const [filterCat, setFilterCat] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [connectingId, setConnectingId] = useState(null);

  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formCategory, setFormCategory] = useState('textbook');
  const [formCondition, setFormCondition] = useState('used_good');
  const [formContact, setFormContact] = useState('');
  
  // Lightbox states
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [lightboxTitle, setLightboxTitle] = useState('');
  const [lightboxPrice, setLightboxPrice] = useState(null);
  const [activeDetailItem, setActiveDetailItem] = useState(null);

  // Image upload states
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');

  const compressImage = (file) => {
    return new Promise((resolve) => {
      if (!file || !file.type.startsWith('image/')) {
        resolve(file);
        return;
      }
      try {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              let width = img.width;
              let height = img.height;
              const MAX_WIDTH = 800;
              const MAX_HEIGHT = 800;
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
              canvas.toBlob((blob) => {
                if (!blob) {
                  resolve(file);
                  return;
                }
                try {
                  const compressedFile = new File([blob], file.name, {
                    type: 'image/jpeg',
                    lastModified: Date.now(),
                  });
                  resolve(compressedFile);
                } catch (e) {
                  resolve(blob);
                }
              }, 'image/jpeg', 0.8);
            } catch (e) {
              resolve(file);
            }
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
      } catch (e) {
        resolve(file);
      }
    });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn file ảnh!');
      return;
    }
    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setPreviewUrl('');
    setFormImageUrl('');
  };

  const toggleForm = () => {
    if (showForm) {
      setEditingItemId(null);
      setFormTitle(''); setFormDesc(''); setFormPrice('');
      setFormCategory('textbook'); setFormCondition('used_good'); setFormContact('');
      setImageFile(null);
      setPreviewUrl('');
      setFormImageUrl('');
    }
    setShowForm(!showForm);
  };

  const startEditing = (item) => {
    setEditingItemId(item.id);
    setFormTitle(item.title || '');
    setFormDesc(item.description || '');
    setFormPrice(item.price || '');
    setFormCategory(item.category || 'textbook');
    setFormCondition(item.condition || 'used_good');
    setFormContact(item.contact || '');
    setFormImageUrl(item.imageUrl || '');
    setPreviewUrl(item.imageUrl || '');
    setImageFile(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (itemId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa sản phẩm này không?')) return;
    try {
      await deleteMarketplaceItem(itemId);
      toast.success('Đã xóa sản phẩm thành công!');
      fetchItems();
    } catch (error) {
      toast.error('Lỗi khi xóa sản phẩm: ' + error.message);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const q = query(collection(db, 'marketplaceItems'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error('Error fetching marketplace items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return toast.error('Bạn cần đăng nhập!');
    if (!formTitle.trim()) return toast.error('Vui lòng nhập tên sản phẩm!');
    if (!formPrice) return toast.error('Vui lòng nhập giá!');

    setSubmitting(true);
    setUploadStatus('Đang xử lý...');
    try {
      let finalImageUrl = formImageUrl;

      if (imageFile) {
        setUploadStatus('Đang nén ảnh...');
        const compressed = await compressImage(imageFile);
        setUploadStatus('Đang tải ảnh lên...');
        const uploadResult = await uploadToCloudinary(compressed);
        finalImageUrl = uploadResult.url;
      }

      const itemData = {
        title: formTitle.trim(),
        description: formDesc.trim(),
        price: Number(formPrice),
        category: formCategory,
        condition: formCondition,
        contact: formContact.trim() || user.email,
        imageUrl: finalImageUrl,
      };

      if (editingItemId) {
        await updateMarketplaceItem(editingItemId, itemData);
        toast.success('Đã cập nhật sản phẩm thành công!');
      } else {
        await addDoc(collection(db, 'marketplaceItems'), {
          ...itemData,
          sellerId: user.uid,
          sellerName: userData?.name || user.displayName || user.email,
          status: 'available',
          createdAt: serverTimestamp(),
        });
        toast.success('Đã đăng bán thành công!');
      }
      
      setShowForm(false);
      setEditingItemId(null);
      setFormTitle(''); setFormDesc(''); setFormPrice('');
      setFormCategory('textbook'); setFormCondition('used_good'); setFormContact('');
      setImageFile(null);
      setPreviewUrl('');
      setFormImageUrl('');
      fetchItems();
    } catch (error) {
      console.error(error);
      toast.error('Có lỗi xảy ra khi lưu sản phẩm!');
    } finally {
      setSubmitting(false);
      setUploadStatus('');
    }
  };

  const handleConnectSeller = async (item) => {
    if (!user) return toast.error('Bạn cần đăng nhập!');
    if (item.sellerId === user.uid) return toast.error('Bạn không thể nhắn tin cho chính mình!');

    setConnectingId(item.id);
    try {
      const { connectionId, isNew } = await createMarketplaceConnection(
        item.id,
        item,
        user,
        item.sellerId
      );

      if (isNew) {
        toast.success('Đã kết nối với người bán! Đang mở chat...');
      } else {
        toast('Đang mở cuộc trò chuyện...', { icon: '💬' });
      }

      router.push(`/messages/${connectionId}`);
    } catch (err) {
      console.error('Error connecting seller:', err);
      toast.error('Có lỗi xảy ra khi kết nối. Vui lòng thử lại!');
    } finally {
      setConnectingId(null);
    }
  };

  const filtered = filterCat ? items.filter(i => i.category === filterCat) : items;
  const catEmoji = (key) => (CATEGORIES.find(c => c.key === key) || CATEGORIES[4]).emoji;

  const formatPrice = (price) => {
    if (!price) return 'Liên hệ';
    return Number(price).toLocaleString('vi-VN') + 'đ';
  };

  return (
    <ProtectedRoute>
      <Navbar />
      <div className="min-h-screen bg-gray-50">
        <main className="max-w-6xl mx-auto py-8 px-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">🛍️ Chợ Đồ Cũ Sinh Viên</h1>
              <p className="text-gray-500 mt-1">Mua bán đồ cũ giá rẻ, tiết kiệm cho tân sinh viên</p>
            </div>
             <button onClick={toggleForm} className="btn-primary flex items-center gap-2">
              {showForm ? '✕ Đóng' : editingItemId ? '✏️ Sửa sản phẩm' : '＋ Đăng bán'}
            </button>
          </div>

          {/* Form */}
          {showForm && (
            <form onSubmit={handleSubmit} className="card p-6 mb-8 border border-blue-100">
              <h2 className="text-xl font-bold mb-4 text-gray-800">{editingItemId ? '✏️ Chỉnh sửa sản phẩm' : '📦 Đăng sản phẩm'}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tên sản phẩm *</label>
                  <input value={formTitle} onChange={e => setFormTitle(e.target.value)}
                    className="input-field" placeholder="Ví dụ: Sách giáo trình Toán cao cấp" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Giá bán (VNĐ) *</label>
                  <input type="number" value={formPrice} onChange={e => setFormPrice(e.target.value)}
                    className="input-field" placeholder="50000" min="0" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Danh mục</label>
                  <select value={formCategory} onChange={e => setFormCategory(e.target.value)} className="input-field">
                    {CATEGORIES.filter(c => c.key).map(c => <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tình trạng</label>
                  <select value={formCondition} onChange={e => setFormCondition(e.target.value)} className="input-field">
                    {CONDITIONS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Hình ảnh sản phẩm (tùy chọn)</label>
                <div className="flex items-center gap-4">
                  <div className="w-28 h-28 border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-xl flex flex-col items-center justify-center overflow-hidden bg-gray-50 relative transition-colors duration-200">
                    {previewUrl ? (
                      <>
                        <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold transition shadow-md border border-white"
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <label className="cursor-pointer flex flex-col items-center justify-center w-full h-full text-gray-400 hover:text-gray-600 transition-colors">
                        <span className="text-3xl">📸</span>
                        <span className="text-xs font-medium mt-1.5">Tải ảnh lên</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleImageChange} 
                          className="hidden" 
                        />
                      </label>
                    )}
                  </div>
                  {imageFile && (
                    <div className="text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg">
                      📁 {imageFile.name} ({(imageFile.size / 1024).toFixed(0)} KB)
                    </div>
                  )}
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                <textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} rows={3}
                  className="input-field" placeholder="Mô tả sản phẩm chi tiết..." />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Liên hệ (SĐT hoặc Zalo)</label>
                <input value={formContact} onChange={e => setFormContact(e.target.value)}
                  className="input-field" placeholder="Để trống sẽ dùng email đăng nhập" />
              </div>
              <button type="submit" disabled={submitting} className="btn-primary w-full sm:w-auto">
                {submitting ? (uploadStatus || 'Đang xử lý...') : editingItemId ? '💾 Cập nhật' : '🚀 Đăng bán'}
              </button>
            </form>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-2.5 mb-8 bg-white p-2.5 rounded-2xl border border-gray-100 shadow-sm w-fit">
            {CATEGORIES.map(c => {
              const active = filterCat === c.key;
              return (
                <button
                  key={c.key || 'all'}
                  onClick={() => setFilterCat(c.key)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-1.5 border ${
                    active
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-100 scale-102'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-transparent'
                  }`}
                >
                  <span>{c.emoji}</span>
                  <span>{c.label}</span>
                </button>
              );
            })}
          </div>

          {/* Items Grid */}
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <p className="text-5xl mb-4">📦</p>
              <p className="text-lg font-medium">Chưa có sản phẩm nào. Hãy đăng bán ngay!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {filtered.map(item => (
                <div
                  key={item.id}
                  onClick={() => setActiveDetailItem(item)}
                  className="group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col relative cursor-pointer"
                >
                  {/* Floating Action Buttons for Seller/Admin */}
                  {user && (item.sellerId === user.uid || isAdmin) && (
                    <div className="absolute top-2 right-2 z-20 flex gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditing(item);
                        }}
                        className="p-1.5 bg-white/90 hover:bg-white text-blue-600 rounded-lg shadow-sm transition-all text-xs font-bold border-none cursor-pointer flex items-center justify-center"
                        title="Sửa sản phẩm"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(item.id);
                        }}
                        className="p-1.5 bg-white/90 hover:bg-white text-red-600 rounded-lg shadow-sm transition-all text-xs font-bold border-none cursor-pointer flex items-center justify-center"
                        title="Xóa sản phẩm"
                      >
                        🗑️
                      </button>
                    </div>
                  )}

                  {/* Dual-layer no-crop Image Container */}
                  <div
                    onClick={() => {
                      if (item.imageUrl) {
                        setLightboxUrl(item.imageUrl);
                        setLightboxTitle(item.title);
                        setLightboxPrice(item.price);
                      }
                    }}
                    className="h-48 bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center relative overflow-hidden border-b border-slate-50 cursor-pointer"
                  >
                    {item.imageUrl ? (
                      <>
                        {/* Layer 1: Blurred scale background */}
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover blur-md scale-110 opacity-30 select-none pointer-events-none"
                        />
                        {/* Layer 2: Main clean product image */}
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="w-full h-full object-contain relative z-10 transition-transform duration-300 group-hover:scale-103"
                        />
                        {/* Zoom interactive badge overlay */}
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-15">
                          <span className="text-white bg-slate-900/80 backdrop-blur-sm px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-md">
                            🔍 Xem ảnh chi tiết
                          </span>
                        </div>
                      </>
                    ) : (
                      <span className="text-5xl transform group-hover:scale-110 transition-transform duration-300">{catEmoji(item.category)}</span>
                    )}
                  </div>

                  {/* Card Body */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors text-base line-clamp-1 mb-1" title={item.title}>
                        {item.title}
                      </h3>
                      
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-blue-600 font-extrabold text-lg">
                          {formatPrice(item.price)}
                        </span>
                        {item.condition && (
                          <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full font-bold">
                            {CONDITIONS.find(c => c.key === item.condition)?.label || item.condition}
                          </span>
                        )}
                      </div>

                      {item.description && (
                        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mb-4">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-1 text-[10px] text-gray-400 border-t border-slate-50 pt-3 mb-3.5">
                        <span>👤</span>
                        <span className="font-semibold truncate">Bởi {item.sellerName || 'Ẩn danh'}</span>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleConnectSeller(item);
                          }}
                          disabled={connectingId === item.id}
                          className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-100/50 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border-none"
                        >
                          {connectingId === item.id ? (
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>💬 Nhắn tin</>
                          )}
                        </button>
                        {item.contact && (
                          <a
                            href={`tel:${item.contact}`}
                            onClick={(e) => e.stopPropagation()}
                            className="py-2.5 px-3.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white border border-emerald-200 hover:border-emerald-500 rounded-xl text-sm font-semibold transition-all flex items-center justify-center"
                            title="Gọi điện / Zalo liên hệ"
                          >
                            📞
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Lightbox Modal */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(8px)',
            zIndex: 3000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          {/* Close button */}
          <button
            onClick={() => setLightboxUrl(null)}
            style={{
              position: 'absolute',
              top: '1.5rem',
              right: '1.5rem',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#fff',
              fontSize: '1.25rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 3010,
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
          >
            ✕
          </button>

          {/* Lightbox Content Container */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '90%',
              maxWidth: '800px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}
          >
            {/* Image display */}
            <div style={{
              width: '100%',
              maxHeight: '75vh',
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '1.5rem',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
            }}>
              <img
                src={lightboxUrl}
                alt="Product Full View"
                style={{
                  maxWidth: '100%',
                  maxHeight: '75vh',
                  objectFit: 'contain',
                  userSelect: 'none'
                }}
              />
            </div>

            {/* Bottom details card */}
            {lightboxTitle && (
              <div style={{
                marginTop: '1.5rem',
                padding: '1.25rem 1.75rem',
                background: 'rgba(30, 41, 59, 0.7)',
                backdropFilter: 'blur(16px)',
                borderRadius: '1.25rem',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                width: '100%',
                boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                color: '#fff',
                textAlign: 'left'
              }}>
                <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc' }}>
                  {lightboxTitle}
                </h2>
                {lightboxPrice !== null && (
                  <p style={{ margin: '0.4rem 0 0', fontSize: '1.1rem', fontWeight: 900, color: '#60a5fa' }}>
                    {formatPrice(lightboxPrice)}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Product Details Modal */}
      {activeDetailItem && (
        <div
          onClick={() => setActiveDetailItem(null)}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-45 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-100 relative flex flex-col md:flex-row max-h-[90vh] md:max-h-[70vh] animate-fade-in"
          >
            {/* Close button */}
            <button
              onClick={() => setActiveDetailItem(null)}
              className="absolute top-4 right-4 z-30 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center border-none cursor-pointer transition-colors font-bold"
            >
              ✕
            </button>

            {/* Product Image Section */}
            <div className="w-full md:w-1/2 h-64 md:h-auto bg-slate-50 relative flex items-center justify-center overflow-hidden border-r border-slate-100">
              {activeDetailItem.imageUrl ? (
                <>
                  <img
                    src={activeDetailItem.imageUrl}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover blur-md scale-110 opacity-30 select-none pointer-events-none"
                  />
                  <img
                    src={activeDetailItem.imageUrl}
                    alt={activeDetailItem.title}
                    className="w-full h-full object-contain relative z-10 cursor-zoom-in hover:scale-102 transition-transform duration-300"
                    onClick={() => {
                      setLightboxUrl(activeDetailItem.imageUrl);
                      setLightboxTitle(activeDetailItem.title);
                      setLightboxPrice(activeDetailItem.price);
                    }}
                    title="Click để phóng to ảnh"
                  />
                </>
              ) : (
                <span className="text-7xl">{catEmoji(activeDetailItem.category)}</span>
              )}
            </div>

            {/* Product Details Section */}
            <div className="w-full md:w-1/2 p-6 flex flex-col justify-between overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-2.5 py-1 rounded-full font-extrabold uppercase tracking-wide">
                    {CATEGORIES.find(c => c.key === activeDetailItem.category)?.label || activeDetailItem.category}
                  </span>
                  {activeDetailItem.condition && (
                    <span className="ml-2 text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-2.5 py-1 rounded-full font-extrabold uppercase tracking-wide">
                      {CONDITIONS.find(c => c.key === activeDetailItem.condition)?.label || activeDetailItem.condition}
                    </span>
                  )}
                </div>

                <h2 className="text-xl font-extrabold text-slate-900 leading-tight">
                  {activeDetailItem.title}
                </h2>

                <div className="text-2xl font-black text-blue-600">
                  {formatPrice(activeDetailItem.price)}
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Mô tả sản phẩm</h4>
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {activeDetailItem.description || 'Không có mô tả chi tiết cho sản phẩm này.'}
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 mt-6 space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Người bán: <strong className="text-slate-800">{activeDetailItem.sellerName || 'Ẩn danh'}</strong></span>
                  {activeDetailItem.contact && <span>Liên hệ: <strong className="text-slate-800">{activeDetailItem.contact}</strong></span>}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      handleConnectSeller(activeDetailItem);
                      setActiveDetailItem(null);
                    }}
                    disabled={connectingId === activeDetailItem.id}
                    className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-100/50 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border-none"
                  >
                    {connectingId === activeDetailItem.id ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>💬 Nhắn tin người bán</>
                    )}
                  </button>
                  {activeDetailItem.contact && (
                    <a
                      href={`tel:${activeDetailItem.contact}`}
                      className="py-3 px-4 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white border border-emerald-200 hover:border-emerald-500 rounded-xl text-sm font-semibold transition-all flex items-center justify-center"
                      title="Gọi điện trực tiếp"
                    >
                      📞 Gọi điện
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
