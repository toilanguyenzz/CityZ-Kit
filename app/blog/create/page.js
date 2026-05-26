'use client';

import '@/app/styles/blog.css';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db, storage, onAuthStateChanged } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
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

  const handleMediaChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (mediaFiles.length + files.length > 9) {
      toast.error('Chỉ được tải lên tối đa 9 ảnh hoặc video (dưới 10 cái)!');
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
    return new Promise((resolve, reject) => {
      const timestamp = Date.now();
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const storagePath = `posts/${userId}/${timestamp}_${cleanFileName}`;
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) onProgress(progress);
        },
        (error) => reject(error),
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({
            type: file.type.startsWith('video/') ? 'video' : 'image',
            url: downloadURL,
          });
        }
      );
    });
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

      // For poll type, store poll data in content as JSON
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

            {/* Multi-Media Upload */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                Hình ảnh & Video (tối đa 9 files, tùy chọn)
              </label>
              <div style={{ position: 'relative', marginBottom: mediaFiles.length > 0 ? '0.75rem' : '0' }}>
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={handleMediaChange}
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', zIndex: 2 }}
                />
                <div style={{
                  border: '2px dashed #e2e8f0',
                  borderRadius: '0.75rem',
                  padding: '1.5rem',
                  textAlign: 'center',
                  color: '#94a3b8',
                  fontSize: '0.85rem',
                  background: '#f8fafc',
                  transition: 'all 0.2s',
                  position: 'relative',
                }}>
                  <p>📸/🎥 Nhấp để chọn nhiều ảnh/video hoặc kéo thả</p>
                  <p style={{ fontSize: '0.72rem', color: '#cbd5e1', marginTop: '0.25rem' }}>Định dạng hỗ trợ: JPG, PNG, GIF, MP4, WebM...</p>
                </div>
              </div>

              {/* Preview Grid */}
              {mediaFiles.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '0.5rem', marginTop: '0.75rem' }}>
                  {mediaFiles.map((item, idx) => (
                    <div key={idx} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '0.5rem', overflow: 'hidden', border: '1.5px solid #e2e8f0', background: '#000' }}>
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
              background: '#f8fafc',
              borderRadius: '0.75rem',
              border: '1.5px solid #e2e8f0',
              marginBottom: '1.5rem',
            }}>
              <div>
                <span style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155' }}>🕵️ Đăng ẩn danh</span>
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginTop: '0.1rem' }}>Ẩn danh tính và avatar của bạn với mọi người (Admin vẫn có thể xem)</span>
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
                  backgroundColor: isAnonymous ? '#3b82f6' : '#cbd5e1',
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
              {loading ? `${uploadStatus || 'Đang đăng bài...'}` : '🚀 Đăng lên Feed'}
            </button>
          </form>
        </main>
      </div>
    </ProtectedRoute>
  );
}
