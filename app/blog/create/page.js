'use client';

import '@/app/styles/blog.css';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { addPost } from '@/lib/firestore';
import useUserRole from '@/lib/useUserRole';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import { compressAndToBase64 } from '@/lib/imageHelper';
import toast from 'react-hot-toast';

const CATEGORIES = [
  { key: 'general', label: 'Tổng hợp', emoji: '💬' },
  { key: 'housing', label: 'Nhà trọ', emoji: '🏠' },
  { key: 'food', label: 'Ẩm thực', emoji: '🍜' },
  { key: 'academic', label: 'Học tập', emoji: '📚' },
  { key: 'social', label: 'Xã hội', emoji: '🎉' },
];

const FLAIRS = ['DISCUSSION', 'QUESTION', 'REVIEW', 'URGENT', 'ANNOUNCEMENT'];

const POST_TYPES = [
  { key: 'discussion', label: '💬 Thảo luận', desc: 'Chia sẻ suy nghĩ, trải nghiệm' },
  { key: 'question', label: '❓ Hỏi đáp', desc: 'Đặt câu hỏi cho cộng đồng' },
  { key: 'poll', label: '🗳️ Khảo sát', desc: 'Tạo bình chọn' },
];

export default function CreatePost() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('general');
  const [flair, setFlair] = useState('');
  const [postType, setPostType] = useState('discussion');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pollOptions, setPollOptions] = useState(['', '']);
  const { role, isAdmin } = useUserRole();

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const addOption = () => {
    if (pollOptions.length < 6) setPollOptions([...pollOptions, '']);
  };

  const removeOption = (index) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index, value) => {
    const newOpts = [...pollOptions];
    newOpts[index] = value;
    setPollOptions(newOpts);
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
      let imageUrl = null;
      if (imageFile) {
        imageUrl = await compressAndToBase64(imageFile);
      }

      // For poll type, store poll data in content as JSON
      const finalType = postType === 'poll' ? 'poll' : postType;

      await addPost(
        user.uid,
        user.displayName || user.email,
        title,
        postType === 'poll' ? JSON.stringify({ question: title, options: pollOptions.map(o => ({ text: o, votes: 0 })) }) : content,
        imageUrl,
        role,
        finalType,
        category,
        flair || null
      );

      toast.success(isAdmin ? 'Đã đăng bài thành công!' : 'Đã gửi! Bài viết đang chờ kiểm duyệt từ Admin.');
      router.push('/blog');
    } catch (error) {
      toast.error(error.message || 'Lỗi đăng bài');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="blog-root">
        <Navbar />
        <main className="blog-main">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#64748b' }}>
              ←
            </button>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Tạo bài viết mới</h1>
          </div>

          <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: '1rem', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', padding: '1.5rem' }}>
            {/* Post Type */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                Loại bài viết
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {POST_TYPES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setPostType(t.key)}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '0.75rem',
                      border: postType === t.key ? '2px solid #3b82f6' : '1.5px solid #e2e8f0',
                      background: postType === t.key ? '#eff6ff' : '#fff',
                      color: postType === t.key ? '#2563eb' : '#64748b',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                Danh mục
              </label>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setCategory(cat.key)}
                    style={{
                      padding: '0.4rem 0.85rem',
                      borderRadius: '2rem',
                      border: category === cat.key ? '2px solid #3b82f6' : '1.5px solid #e2e8f0',
                      background: category === cat.key ? '#eff6ff' : '#fff',
                      color: category === cat.key ? '#2563eb' : '#64748b',
                      fontWeight: 500,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {cat.emoji} {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Flair (optional) */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                Flair (tùy chọn)
              </label>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setFlair('')}
                  style={{
                    padding: '0.3rem 0.7rem',
                    borderRadius: '2rem',
                    border: !flair ? '2px solid #3b82f6' : '1.5px solid #e2e8f0',
                    background: !flair ? '#eff6ff' : '#fff',
                    color: !flair ? '#2563eb' : '#94a3b8',
                    fontWeight: 500,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                  }}
                >
                  Không có
                </button>
                {FLAIRS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFlair(f)}
                    style={{
                      padding: '0.3rem 0.7rem',
                      borderRadius: '2rem',
                      border: flair === f ? '2px solid #3b82f6' : '1.5px solid #e2e8f0',
                      background: flair === f ? '#eff6ff' : '#fff',
                      color: flair === f ? '#2563eb' : '#64748b',
                      fontWeight: 500,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                {postType === 'poll' ? 'Câu hỏi khảo sát' : 'Tiêu đề'}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={postType === 'poll' ? 'Ví dụ: Đề thi năm nay thế nào?' : 'Ví dụ: Review môn Giải tích 1...'}
                required
                style={{
                  width: '100%',
                  padding: '0.7rem 1rem',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: '0.75rem',
                  fontSize: '1rem',
                  fontWeight: 600,
                  outline: 'none',
                  fontFamily: 'inherit',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => e.target.style.borderColor = '#93c5fd'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            {/* Content (for non-poll) */}
            {postType !== 'poll' && (
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                  Nội dung
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={6}
                  placeholder="Hãy viết những điều bạn muốn chia sẻ... (dùng #hashtag để thêm tag)"
                  required
                  style={{
                    width: '100%',
                    padding: '0.7rem 1rem',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '0.75rem',
                    fontSize: '0.9rem',
                    resize: 'vertical',
                    outline: 'none',
                    fontFamily: 'inherit',
                    lineHeight: 1.6,
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#93c5fd'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>
            )}

            {/* Poll options */}
            {postType === 'poll' && (
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                  Các lựa chọn
                </label>
                {pollOptions.map((option, index) => (
                  <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      placeholder={`Lựa chọn ${index + 1}`}
                      required
                      style={{
                        flex: 1,
                        padding: '0.6rem 1rem',
                        border: '1.5px solid #e2e8f0',
                        borderRadius: '0.75rem',
                        fontSize: '0.875rem',
                        outline: 'none',
                        fontFamily: 'inherit',
                      }}
                    />
                    {pollOptions.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(index)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem' }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                {pollOptions.length < 6 && (
                  <button
                    type="button"
                    onClick={addOption}
                    style={{
                      width: '100%',
                      padding: '0.6rem',
                      border: '2px dashed #e2e8f0',
                      borderRadius: '0.75rem',
                      background: 'none',
                      color: '#94a3b8',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >
                    + Thêm lựa chọn
                  </button>
                )}
              </div>
            )}

            {/* Image upload */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                Hình ảnh (tùy chọn)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', zIndex: 2 }}
                />
                <div style={{
                  border: '2px dashed #e2e8f0',
                  borderRadius: '0.75rem',
                  padding: '1.5rem',
                  textAlign: 'center',
                  color: '#94a3b8',
                  fontSize: '0.85rem',
                  background: imagePreview ? 'transparent' : '#f8fafc',
                  transition: 'all 0.2s',
                  position: 'relative',
                }}>
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" style={{ maxHeight: '200px', borderRadius: '0.5rem', objectFit: 'cover' }} />
                  ) : (
                    <p>📷 Nhấp để chọn ảnh hoặc kéo thả</p>
                  )}
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.85rem',
                background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                color: '#fff',
                border: 'none',
                borderRadius: '0.75rem',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
                opacity: loading ? 0.6 : 1,
                boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
              }}
            >
              {loading ? 'Đang đăng bài...' : '🚀 Đăng lên Feed'}
            </button>
          </form>
        </main>
      </div>
    </ProtectedRoute>
  );
}
