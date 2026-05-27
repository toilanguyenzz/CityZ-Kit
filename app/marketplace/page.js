'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import Navbar from '@/components/Navbar';
import ProtectedRoute from '@/components/ProtectedRoute';
import toast from 'react-hot-toast';
import useUserRole from '@/lib/useUserRole';
import { updateMarketplaceItem, deleteMarketplaceItem } from '@/lib/firestore';

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
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, isAdmin } = useUserRole();
  const [filterCat, setFilterCat] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);

  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formCategory, setFormCategory] = useState('textbook');
  const [formCondition, setFormCondition] = useState('used_good');
  const [formContact, setFormContact] = useState('');

  const toggleForm = () => {
    if (showForm) {
      setEditingItemId(null);
      setFormTitle(''); setFormDesc(''); setFormPrice('');
      setFormCategory('textbook'); setFormCondition('used_good'); setFormContact('');
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
    try {
      const itemData = {
        title: formTitle.trim(),
        description: formDesc.trim(),
        price: Number(formPrice),
        category: formCategory,
        condition: formCondition,
        contact: formContact.trim() || user.email,
      };

      if (editingItemId) {
        await updateMarketplaceItem(editingItemId, itemData);
        toast.success('Đã cập nhật sản phẩm thành công!');
      } else {
        await addDoc(collection(db, 'marketplaceItems'), {
          ...itemData,
          sellerId: user.uid,
          sellerName: user.displayName || user.email,
          status: 'available',
          createdAt: serverTimestamp(),
        });
        toast.success('Đã đăng bán thành công!');
      }
      
      setShowForm(false);
      setEditingItemId(null);
      setFormTitle(''); setFormDesc(''); setFormPrice('');
      setFormCategory('textbook'); setFormCondition('used_good'); setFormContact('');
      fetchItems();
    } catch (error) {
      console.error(error);
      toast.error('Có lỗi xảy ra!');
    } finally {
      setSubmitting(false);
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
                {submitting ? 'Đang xử lý...' : editingItemId ? '💾 Cập nhật' : '🚀 Đăng bán'}
              </button>
            </form>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-6">
            {CATEGORIES.map(c => (
              <button key={c.key || 'all'} onClick={() => setFilterCat(c.key)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition ${filterCat === c.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {c.emoji} {c.label}
              </button>
            ))}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filtered.map(item => (
                <div key={item.id} className="card overflow-hidden hover:shadow-lg transition-all duration-300">
                  <div className="h-40 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                    <span className="text-5xl">{catEmoji(item.category)}</span>
                  </div>
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-gray-800 truncate flex-1">{item.title}</h3>
                    </div>
                    <p className="text-blue-600 font-bold text-lg mb-1">{formatPrice(item.price)}</p>
                    {item.condition && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                        {CONDITIONS.find(c => c.key === item.condition)?.label || item.condition}
                      </span>
                    )}
                    {item.description && <p className="text-sm text-gray-500 mt-2 line-clamp-2">{item.description}</p>}
                    <p className="text-xs text-gray-400 mt-2">Bởi {item.sellerName || 'Ẩn danh'}</p>
                    {user && (item.sellerId === user.uid || isAdmin) && (
                      <div className="flex gap-2 mt-2 text-xs font-semibold">
                        <button onClick={() => startEditing(item)} className="text-blue-600 hover:text-blue-800 border-none bg-transparent cursor-pointer">Sửa</button>
                        <span className="text-gray-300">|</span>
                        <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-800 border-none bg-transparent cursor-pointer">Xóa</button>
                      </div>
                    )}
                    <div className="flex gap-2 mt-3">
                      <button className="flex-1 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-semibold transition">
                        💬 Nhắn tin
                      </button>
                      {item.contact && (
                        <a href={`tel:${item.contact}`} className="py-2 px-3 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-semibold transition">
                          📞
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
