'use client';

import '@/app/styles/blog.css';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db, onAuthStateChanged } from '@/lib/firebase';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { doc, getDoc } from 'firebase/firestore';
import { addPost } from '@/lib/firestore';
import useUserRole from '@/lib/useUserRole';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
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

const SUGGESTED_TAGS = ['reviewmonhoc', 'giarebinhthanh', 'timphongtro', 'tansinhvien', 'hcmc', 'svfpt', 'anchoi', 'sinhvien', 'ktx'];
const SUGGESTED_USERS = ['admin', 'tiendung', 'hoangnam', 'quynhanh', 'thanhhang', 'minhduc'];

export default function CreatePost() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('general');
  const [flair, setFlair] = useState('');
  const [postType, setPostType] = useState('discussion');
  const [mediaFiles, setMediaFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadStatus, setUploadStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [userProfile, setUserProfile] = useState({ name: '', avatarUrl: null, badges: [] });
  const { role, isAdmin } = useUserRole();

  const [isDragging, setIsDragging] = useState(false);
  const [autocompleteQuery, setAutocompleteQuery] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    return () => {
      mediaFiles.forEach(item => {
        if (item.preview && item.preview.startsWith('blob:')) {
          URL.revokeObjectURL(item.preview);
        }
      });
    };
  }, [mediaFiles]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          const docRef = doc(db, 'users', u.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserProfile({
              name: data.name || u.displayName || u.email?.split('@')[0] || 'User',
              avatarUrl: data.avatarUrl || null,
              badges: data.badges || []
            });
          } else {
            setUserProfile({
              name: u.displayName || u.email?.split('@')[0] || 'User',
              avatarUrl: null,
              badges: []
            });
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const addFiles = (files) => {
    if (mediaFiles.length + files.length > 9) {
      toast.error('Chỉ được tải lên tối đa 9 ảnh hoặc video!');
      return;
    }

    const newFiles = files.map((file) => {
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      return {
        file,
        type,
        preview: URL.createObjectURL(file),
      };
    });

    setMediaFiles((prev) => [...prev, ...newFiles]);
  };

  const handleMediaChange = (e) => {
    const files = Array.from(e.target.files || []);
    addFiles(files);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || []);
    addFiles(files);
  };

  const handleContentChange = (e) => {
    const val = e.target.value;
    setContent(val);

    const cursor = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursor);
    const match = textBeforeCursor.match(/([@#])(\w*)$/);
    if (match) {
      setAutocompleteQuery(match[0]);
      setShowAutocomplete(true);
    } else {
      setShowAutocomplete(false);
    }
  };

  const handleSelectSuggestion = (suggestion) => {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    const cursor = el.selectionStart;
    const textBeforeCursor = content.slice(0, cursor);
    const textAfterCursor = content.slice(cursor);

    const lastSymbolIdx = textBeforeCursor.lastIndexOf(autocompleteQuery.charAt(0));
    if (lastSymbolIdx !== -1) {
      const newTextBefore = textBeforeCursor.slice(0, lastSymbolIdx) + autocompleteQuery.charAt(0) + suggestion + ' ';
      setContent(newTextBefore + textAfterCursor);
      setShowAutocomplete(false);
      setTimeout(() => {
        el.focus();
        const newCursorPos = newTextBefore.length;
        el.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
  };

  const getFilteredSuggestions = () => {
    if (!autocompleteQuery) return [];
    const symbol = autocompleteQuery.charAt(0);
    const queryStr = autocompleteQuery.slice(1).toLowerCase();
    const list = symbol === '#' ? SUGGESTED_TAGS : SUGGESTED_USERS;
    return list.filter(item => item.toLowerCase().includes(queryStr));
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

  const uploadFile = (file, userId, onProgress) => {
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
    setUploadStatus('Đang bắt đầu tải lên...');
    try {
      const uploadedMedia = [];
      for (let i = 0; i < mediaFiles.length; i++) {
        const item = mediaFiles[i];
        setUploadStatus(`Nén & Tải file ${i + 1}/${mediaFiles.length}...`);
        const compressedFile = await compressImage(item.file);
        const uploadedItem = await uploadFile(compressedFile, user.uid, (progress) => {
          setUploadProgress((prev) => ({ ...prev, [i]: Math.round(progress) }));
        });
        uploadedMedia.push(uploadedItem);
      }

      setUploadStatus('Đang tạo bài viết...');

      const finalType = postType === 'poll' ? 'poll' : postType;

      await addPost(
        user.uid,
        userProfile.name || user.displayName || user.email,
        title,
        postType === 'poll' ? JSON.stringify({ question: title, options: pollOptions.map(o => ({ text: o, votes: 0 })) }) : content,
        null,
        role,
        finalType,
        category,
        flair || null,
        isAnonymous,
        userProfile.avatarUrl,
        userProfile.badges,
        uploadedMedia
      );

      toast.success(isAdmin ? 'Đã đăng bài thành công!' : 'Đã gửi! Bài viết đang chờ kiểm duyệt từ Admin.');
      router.push('/blog');
    } catch (error) {
      toast.error(error.message || 'Lỗi đăng bài');
      console.error(error);
    } finally {
      setLoading(false);
      setUploadStatus('');
    }
  };

  const charsLeft = 280 - content.length;
  const isExceeded = content.length > 280;

  return (
    <ProtectedRoute>
      <div className="blog-root">
        <Navbar />
        <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', marginTop: '1.5rem' }}>
            <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--blog-text-secondary)' }}>
              ←
            </button>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--blog-text-primary)', margin: 0 }}>Tạo bài viết mới</h1>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', marginBottom: '3rem' }} className="create-layout-grid">
            {/* Form Container */}
            <form onSubmit={handleSubmit} style={{ background: 'var(--blog-card-bg)', border: '1px solid var(--blog-divider)', borderRadius: '1rem', padding: '1.5rem', height: 'fit-content' }}>
              {/* Post Type */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--blog-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
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
                        border: postType === t.key ? '2px solid var(--blog-accent)' : '1.5px solid var(--blog-divider)',
                        background: postType === t.key ? 'rgba(29, 155, 240, 0.1)' : 'var(--blog-input-bg)',
                        color: postType === t.key ? 'var(--blog-accent)' : 'var(--blog-text-secondary)',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        fontFamily: 'inherit',
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--blog-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
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
                        border: category === cat.key ? '2px solid var(--blog-accent)' : '1.5px solid var(--blog-divider)',
                        background: category === cat.key ? 'rgba(29, 155, 240, 0.1)' : 'var(--blog-input-bg)',
                        color: category === cat.key ? 'var(--blog-accent)' : 'var(--blog-text-secondary)',
                        fontWeight: 500,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        fontFamily: 'inherit',
                      }}
                    >
                      {cat.emoji} {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Flair (optional) */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--blog-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                  Flair (tùy chọn)
                </label>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setFlair('')}
                    style={{
                      padding: '0.3rem 0.7rem',
                      borderRadius: '2rem',
                      border: !flair ? '2px solid var(--blog-accent)' : '1.5px solid var(--blog-divider)',
                      background: !flair ? 'rgba(29, 155, 240, 0.1)' : 'var(--blog-input-bg)',
                      color: !flair ? 'var(--blog-accent)' : 'var(--blog-text-secondary)',
                      fontWeight: 500,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
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
                        border: flair === f ? '2px solid var(--blog-accent)' : '1.5px solid var(--blog-divider)',
                        background: flair === f ? 'rgba(29, 155, 240, 0.1)' : 'var(--blog-input-bg)',
                        color: flair === f ? 'var(--blog-accent)' : 'var(--blog-text-secondary)',
                        fontWeight: 500,
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--blog-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
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
                    border: '1.5px solid var(--blog-divider)',
                    borderRadius: '0.75rem',
                    fontSize: '1rem',
                    fontWeight: 600,
                    outline: 'none',
                    fontFamily: 'inherit',
                    background: 'var(--blog-input-bg)',
                    color: 'var(--blog-text-primary)',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--blog-accent)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--blog-divider)'}
                />
              </div>

              {/* Content (for non-poll) */}
              {postType !== 'poll' && (
                <div style={{ marginBottom: '1.25rem', position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--blog-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                    Nội dung
                  </label>
                  <div style={{ position: 'relative' }}>
                    <textarea
                      ref={textareaRef}
                      value={content}
                      onChange={handleContentChange}
                      rows={6}
                      placeholder="Hãy viết những điều bạn muốn chia sẻ... (dùng #hashtag để thêm tag hoặc @ để nhắc tên)"
                      required
                      style={{
                        width: '100%',
                        padding: '0.7rem 1rem',
                        border: '1.5px solid var(--blog-divider)',
                        borderRadius: '0.75rem',
                        fontSize: '0.9rem',
                        resize: 'vertical',
                        outline: 'none',
                        fontFamily: 'inherit',
                        lineHeight: 1.6,
                        background: 'var(--blog-input-bg)',
                        color: 'var(--blog-text-primary)',
                        transition: 'border-color 0.2s',
                      }}
                      onFocus={(e) => e.target.style.borderColor = 'var(--blog-accent)'}
                      onBlur={(e) => e.target.style.borderColor = 'var(--blog-divider)'}
                    />
                    {showAutocomplete && getFilteredSuggestions().length > 0 && (
                      <div style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: '10px',
                        background: 'var(--blog-card-bg)',
                        border: '1px solid var(--blog-divider)',
                        borderRadius: '0.5rem',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                        zIndex: 100,
                        width: '200px',
                        maxHeight: '150px',
                        overflowY: 'auto',
                        marginBottom: '5px',
                        padding: '0.25rem 0'
                      }}>
                        {getFilteredSuggestions().map((sug, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelectSuggestion(sug)}
                            style={{
                              display: 'block',
                              width: '100%',
                              padding: '0.5rem 0.75rem',
                              background: 'none',
                              border: 'none',
                              textAlign: 'left',
                              fontSize: '0.85rem',
                              color: 'var(--blog-text-primary)',
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                              transition: 'background 0.15s'
                            }}
                            onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.05)'}
                            onMouseLeave={(e) => e.target.style.background = 'none'}
                          >
                            {autocompleteQuery.charAt(0)}{sug}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '0.35rem',
                    fontSize: '0.78rem',
                    color: isExceeded ? '#ef4444' : charsLeft <= 20 ? '#f59e0b' : 'var(--blog-text-secondary)'
                  }}>
                    <span>{content.length}/280 ký tự</span>
                    {isExceeded ? (
                      <span style={{ fontWeight: 600 }}>Quá giới hạn Twitter/X (280 ký tự)</span>
                    ) : (
                      <span>Còn lại {charsLeft} ký tự</span>
                    )}
                  </div>
                </div>
              )}

              {/* Poll options */}
              {postType === 'poll' && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--blog-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
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
                          border: '1.5px solid var(--blog-divider)',
                          borderRadius: '0.75rem',
                          fontSize: '0.875rem',
                          outline: 'none',
                          fontFamily: 'inherit',
                          background: 'var(--blog-input-bg)',
                          color: 'var(--blog-text-primary)',
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
                        border: '2px dashed var(--blog-divider)',
                        borderRadius: '0.75rem',
                        background: 'none',
                        color: 'var(--blog-text-secondary)',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      + Thêm lựa chọn
                    </button>
                  )}
                </div>
              )}

              {/* Multi-Media Upload */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--blog-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                  Hình ảnh & Video (tối đa 9 files, tùy chọn)
                </label>
                <div
                  style={{ position: 'relative', marginBottom: mediaFiles.length > 0 ? '0.75rem' : '0' }}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    onChange={handleMediaChange}
                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', zIndex: 2 }}
                  />
                  <div style={{
                    border: isDragging ? '2px dashed var(--blog-accent)' : '2px dashed var(--blog-divider)',
                    borderRadius: '0.75rem',
                    padding: '1.5rem',
                    textAlign: 'center',
                    color: isDragging ? 'var(--blog-accent)' : 'var(--blog-text-secondary)',
                    fontSize: '0.85rem',
                    background: isDragging ? 'rgba(29, 155, 240, 0.05)' : 'var(--blog-input-bg)',
                    transition: 'all 0.2s',
                    position: 'relative',
                  }}>
                    <p>📸/🎥 Nhấp để chọn nhiều ảnh/video hoặc kéo thả</p>
                    <p style={{ fontSize: '0.72rem', color: 'var(--blog-text-tertiary)', marginTop: '0.25rem' }}>Định dạng hỗ trợ: JPG, PNG, GIF, MP4, WebM...</p>
                  </div>
                </div>

                {/* Preview Grid */}
                {mediaFiles.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '0.5rem', marginTop: '0.75rem' }}>
                    {mediaFiles.map((item, idx) => (
                      <div key={idx} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '0.5rem', overflow: 'hidden', border: '1.5px solid var(--blog-divider)', background: '#000' }}>
                        {item.type === 'video' ? (
                          <video src={item.preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                        ) : (
                          <img src={item.preview} alt={`Preview ${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            URL.revokeObjectURL(item.preview);
                            setMediaFiles((prev) => prev.filter((_, i) => i !== idx));
                          }}
                          style={{
                            position: 'absolute', top: '2px', right: '2px', background: 'rgba(239, 68, 68, 0.85)',
                            color: '#fff', border: 'none', borderRadius: '50%', width: '18px', height: '18px',
                            display: 'flex', alignItems: 'center', justify: 'center', fontSize: '10px', cursor: 'pointer',
                            fontWeight: 'bold', zIndex: 10
                          }}
                        >
                          ✕
                        </button>
                        {item.type === 'video' && (
                          <span style={{ position: 'absolute', bottom: '2px', left: '2px', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '8px', padding: '1px 3px', borderRadius: '2px' }}>
                            🎥 Video
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Anonymous Toggle */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.85rem 1rem',
                background: 'var(--blog-input-bg)',
                borderRadius: '0.75rem',
                border: '1.5px solid var(--blog-divider)',
                marginBottom: '1.5rem',
              }}>
                <div>
                  <span style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: 'var(--blog-text-primary)' }}>🕵️ Đăng ẩn danh</span>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--blog-text-secondary)', marginTop: '0.1rem' }}>Ẩn danh tính và avatar của bạn với mọi người (Admin vẫn có thể xem)</span>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '24px', flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', cursor: 'pointer', inset: 0,
                    backgroundColor: isAnonymous ? 'var(--blog-accent)' : '#cbd5e1',
                    borderRadius: '24px', transition: '0.3s',
                  }}>
                    <span style={{
                      position: 'absolute', content: '""', height: '18px', width: '18px',
                      left: isAnonymous ? '26px' : '3px', bottom: '3px',
                      backgroundColor: '#fff', borderRadius: '50%', transition: '0.3s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }} />
                  </span>
                </label>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  background: 'linear-gradient(135deg, var(--blog-accent), #a855f7)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '0.75rem',
                  fontSize: '1rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  opacity: loading ? 0.6 : 1,
                  boxShadow: '0 4px 12px rgba(29,155,240,0.3)',
                }}
              >
                {loading ? `${uploadStatus || 'Đang đăng bài...'}` : '🚀 Đăng lên Feed'}
              </button>
            </form>

            {/* Live Preview Panel */}
            <div style={{ background: 'var(--blog-card-bg)', border: '1px solid var(--blog-divider)', borderRadius: '1rem', padding: '1.5rem', height: 'fit-content', position: 'sticky', top: '90px' }} className="create-preview-panel">
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--blog-text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                👀 Xem trước bài đăng (Live Preview)
              </h3>
              
              <div className="tc-card" style={{ border: '1px solid var(--blog-divider)', borderRadius: '0.75rem', cursor: 'default' }}>
                <div className="tc-card-inner">
                  {/* Avatar */}
                  {isAnonymous ? (
                    <div className="tc-avatar" style={{ background: '#536471' }}>👤</div>
                  ) : userProfile.avatarUrl ? (
                    <div className="tc-avatar"><img src={userProfile.avatarUrl} alt="Avatar" /></div>
                  ) : (
                    <div className="tc-avatar">{userProfile.name?.charAt(0).toUpperCase() || 'U'}</div>
                  )}

                  {/* Content Column */}
                  <div className="tc-content">
                    <div className="tc-header">
                      <span className="tc-display-name">
                        {isAnonymous ? 'Ẩn danh' : (userProfile.name || 'Bạn')}
                        {!isAnonymous && userProfile.badges && userProfile.badges.map((badge, idx) => (
                          <span key={idx} title={badge.name} style={{ marginLeft: '0.2rem', fontSize: '0.85rem' }}>{badge.icon}</span>
                        ))}
                      </span>
                      <span className="tc-dot">•</span>
                      <span className="tc-time" style={{ color: 'var(--blog-text-secondary)' }}>vừa xong</span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span className="tc-category">🌐 {category === 'general' ? 'Tổng hợp' : category === 'housing' ? 'Nhà trọ' : category === 'food' ? 'Ẩm thực' : category === 'academic' ? 'Học tập' : 'Xã hội'}</span>
                      {flair && <span style={{ fontSize: '0.72rem', padding: '0.12rem 0.5rem', borderRadius: '1rem', background: 'rgba(59,130,246,0.15)', color: '#3b82f6', fontWeight: 600 }}>{flair}</span>}
                    </div>

                    <h3 className="tc-title">{title || 'Tiêu đề bài viết...'}</h3>
                    
                    {postType === 'poll' ? (
                      <div style={{ padding: '0.75rem', background: 'rgba(29, 155, 240, 0.08)', border: '1px solid rgba(29, 155, 240, 0.2)', borderRadius: '0.5rem', margin: '0.5rem 0' }}>
                        <p style={{ fontWeight: 600, color: 'var(--blog-accent)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>🗳️ Bình chọn khảo sát</p>
                        {pollOptions.map((opt, idx) => (
                          <div key={idx} style={{ padding: '0.4rem 0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--blog-divider)', borderRadius: '0.5rem', marginBottom: '0.25rem', fontSize: '0.8rem', color: 'var(--blog-text-secondary)' }}>
                            {opt || `Lựa chọn ${idx + 1}`}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="tc-preview" style={{ display: 'block', webkitLineClamp: 'unset', overflow: 'visible' }}>
                        {content ? (
                          content.split(/(#\w+)/g).map((part, i) =>
                            part.startsWith('#') ? (
                              <span key={i} style={{ color: 'var(--blog-accent)', fontWeight: 600 }}>{part}</span>
                            ) : (
                              <span key={i}>{part}</span>
                            )
                          )
                        ) : (
                          <span style={{ color: 'var(--blog-text-tertiary)', fontStyle: 'italic' }}>Nội dung bài viết sẽ hiển thị ở đây...</span>
                        )}
                      </p>
                    )}

                    {/* Media Preview inside card */}
                    {mediaFiles.length > 0 && (
                      <div className={`tc-media-grid tc-media-count-${Math.min(mediaFiles.length, 4)}`} style={{ maxHeight: '200px', height: '180px' }}>
                        {mediaFiles.slice(0, 4).map((item, idx) => (
                          <div key={idx} className="tc-media-item">
                            {item.type === 'video' ? (
                              <div className="tc-media-video-wrapper">
                                <video src={item.preview} className="tc-media-video" muted />
                                <div className="tc-media-video-badge">▶ Video</div>
                              </div>
                            ) : (
                              <img src={item.preview} alt="Preview" className="tc-media-img" />
                            )}
                            {mediaFiles.length > 4 && idx === 3 && (
                              <div className="tc-media-more-overlay">
                                <span>+{mediaFiles.length - 3}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Action Bar placeholder */}
                    <div className="tc-action-bar" style={{ opacity: 0.6, marginTop: '0.75rem', pointerEvents: 'none' }}>
                      <div className="tc-action-group">
                        <button className="tc-action-btn"><span style={{ fontSize: '0.9rem' }}>💬</span></button>
                        <span className="tc-action-count">0</span>
                      </div>
                      <div className="tc-action-group">
                        <button className="tc-action-btn"><span style={{ fontSize: '0.9rem' }}>🤍</span></button>
                        <span className="tc-action-count">0</span>
                      </div>
                      <div className="tc-action-group">
                        <button className="tc-action-btn"><span style={{ fontSize: '0.9rem' }}>📤</span></button>
                        <span className="tc-action-count">0</span>
                      </div>
                      <div className="tc-action-group">
                        <button className="tc-action-btn"><span style={{ fontSize: '0.9rem' }}>🔖</span></button>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Responsive CSS */}
        <style jsx global>{`
          @media (min-width: 1024px) {
            .create-layout-grid {
              grid-template-columns: 1.2fr 1fr !important;
            }
            .create-preview-panel {
              display: block !important;
            }
          }
          @media (max-width: 1023px) {
            .create-preview-panel {
              display: none !important;
            }
          }
        `}</style>
      </div>
    </ProtectedRoute>
  );
}
