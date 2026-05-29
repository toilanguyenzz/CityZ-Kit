'use client';

import { useState, useEffect, useRef } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { addLocation } from '@/lib/firestore';
import useUserRole from '@/lib/useUserRole';
import toast from 'react-hot-toast';

// Haversine formula to calculate distance in meters
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const QUICK_TAGS = [
  { label: 'Ngon 🤤', value: 'Ngon 🤤' },
  { label: 'Rẻ 💸', value: 'Rẻ 💸' },
  { label: 'Hơi đông 🤫', value: 'Hơi đông 🤫' },
  { label: 'Thân thiện 👍', value: 'Thân thiện 👍' },
  { label: 'Yên tĩnh ☕', value: 'Yên tĩnh ☕' },
  { label: 'Học tập 📚', value: 'Học tập 📚' },
];

export default function LocketCameraModal({ onClose, onUploadSuccess }) {
  const { role, isAdmin } = useUserRole();
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // Default to rear camera
  const [cameraError, setCameraError] = useState(false);
  const [coords, setCoords] = useState(null);
  const [address, setAddress] = useState('');
  const [nearbyLocations, setNearbyLocations] = useState([]);
  const [useGPS, setUseGPS] = useState(false);
  
  // Form fields
  const [spotName, setSpotName] = useState('');
  const [category, setCategory] = useState('Food');
  const [caption, setCaption] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [loading, setLoading] = useState(false);

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);

  // Manual GPS trigger
  const handleFetchGPS = (shouldFetch) => {
    if (!shouldFetch) {
      setCoords(null);
      setAddress('');
      setNearbyLocations([]);
      return;
    }

    if (!navigator.geolocation) {
      toast.error('Trình duyệt của bạn không hỗ trợ định vị GPS');
      setUseGPS(false);
      return;
    }
    
    const toastId = toast.loading('Đang lấy vị trí GPS...');
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        toast.dismiss(toastId);
        toast.success('Đã lấy vị trí GPS thành công!');
        setCoords({ lat: latitude, lng: longitude });
        
        // Fetch reverse geocoding
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.display_name) {
              setAddress(data.display_name);
            }
          }
        } catch (e) {
          console.error('Error reverse geocoding:', e);
        }

        // Fetch locations to find nearby spots within 100m
        try {
          const snapshot = await getDocs(collection(db, 'locations'));
          const spots = snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
          }));

          const calculated = spots
            .map(spot => {
              if (spot.latitude && spot.longitude) {
                const dist = getDistance(latitude, longitude, spot.latitude, spot.longitude);
                return { ...spot, distance: dist };
              }
              return { ...spot, distance: 99999 };
            })
            .filter(spot => spot.distance <= 100) // 100 meters limit
            .sort((a, b) => a.distance - b.distance);

          setNearbyLocations(calculated);
        } catch (err) {
          console.error('Error fetching nearby locations:', err);
        }
      },
      (err) => {
        toast.dismiss(toastId);
        setUseGPS(false);
        console.warn('Geolocation error:', err);
        toast.error('Không thể lấy vị trí GPS. Vui lòng cấp quyền vị trí.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // 2. Start webcam stream
  useEffect(() => {
    if (capturedImage) return;

    let activeStream = null;

    async function startCamera() {
      try {
        setCameraError(false);
        const constraints = {
          video: {
            facingMode: facingMode,
            width: { ideal: 640 },
            height: { ideal: 640 },
          },
          audio: false,
        };
        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        activeStream = mediaStream;
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error('Camera access denied or unavailable:', err);
        setCameraError(true);
      }
    }

    startCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [facingMode, capturedImage]);

  // 3. Switch camera facingMode
  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  // 4. Capture photo from video stream
  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    // Crop viewport into a 1:1 square
    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = 480;
    canvas.height = 480;

    const ctx = canvas.getContext('2d');
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;

    // Draw flipped frame if using front camera for natural mirroring
    if (facingMode === 'user') {
      ctx.translate(480, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, sx, sy, size, size, 0, 0, 480, 480);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    } else {
      ctx.drawImage(video, sx, sy, size, size, 0, 0, 480, 480);
    }

    const base64 = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(base64);
  };

  // 5. Fallback File selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 480;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');

        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;

        ctx.drawImage(img, sx, sy, size, size, 0, 0, 480, 480);
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedImage(base64);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  // 6. Handle tag click
  const handleTagToggle = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // 7. Submit check-in
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!capturedImage) return toast.error('Vui lòng chụp ảnh');
    if (!spotName.trim()) return toast.error('Vui lòng chọn hoặc nhập tên địa điểm');

    const user = auth.currentUser;
    if (!user) return toast.error('Vui lòng đăng nhập');

    setLoading(true);
    const toastId = toast.loading('Đang đăng Check-in...');

    try {
      // Fetch creator details
      let creatorName = user.displayName || user.email?.split('@')[0] || 'User';
      let creatorAvatar = null;
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          creatorName = userData.name || creatorName;
          creatorAvatar = userData.avatarUrl || null;
        }
      } catch (err) {
        console.error(err);
      }

      // Convert captured base64 string to a File object for addLocation function
      const resBlob = await fetch(capturedImage);
      const blob = await resBlob.blob();
      const imageFile = new File([blob], 'snapz_checkin.jpg', { type: 'image/jpeg' });

      // Add check-in location card (needs admin approval unless created by admin)
      await addLocation(
        {
          name: spotName.trim(),
          category: category,
          address: address || 'Khu đô thị Đại học, TP. Hồ Chí Minh',
          description: caption.trim() || 'Check-in tức thì',
          latitude: coords?.lat || 10.7769,
          longitude: coords?.lng || 106.7009,
          createdByName: creatorName,
          createdByAvatar: creatorAvatar,
          tags: selectedTags,
          isCheckIn: true,
        },
        imageFile,
        user.uid,
        role
      );

      toast.dismiss(toastId);
      toast.success(isAdmin ? '⚡ Đăng check-in thành công!' : '⚡ Đăng check-in thành công! Đang chờ Admin phê duyệt.');
      if (onUploadSuccess) onUploadSuccess();
      onClose();
    } catch (err) {
      toast.dismiss(toastId);
      toast.error('Lỗi khi đăng check-in: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1000,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '1rem', fontFamily: 'inherit'
    }}>
      <div style={{
        width: '100%', maxWidth: '440px', background: '#111', borderRadius: '2rem',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)', border: '1px solid #222', position: 'relative'
      }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: '1.25rem', right: '1.25rem',
            width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)',
            border: 'none', color: '#fff', fontSize: '1rem', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10,
            transition: 'background 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
        >
          ✕
        </button>

        {/* Viewport Header */}
        <div style={{ padding: '1.5rem 1.5rem 1rem', textAlign: 'center', borderBottom: '1px solid #222' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>
            ⚡ Quick Check-in
          </h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: '#666' }}>
            Chụp và chia sẻ trải nghiệm tức thì của bạn
          </p>
        </div>

        {/* Camera / Preview Screen */}
        <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', background: '#000' }}>
          {!capturedImage ? (
            <>
              {!cameraError ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{
                  width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center', color: '#999'
                }}>
                  <span style={{ fontSize: '3rem', marginBottom: '1rem' }}>📷</span>
                  <p style={{ fontSize: '0.85rem', margin: '0 0 1.5rem' }}>Không thể truy cập camera</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      background: 'linear-gradient(135deg, #3b82f6, #6366f1)', border: 'none',
                      color: '#fff', padding: '0.6rem 1.2rem', borderRadius: '2rem', fontSize: '0.8rem',
                      fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    📂 Chọn ảnh có sẵn
                  </button>
                </div>
              )}

              {/* Shutter Overlay buttons */}
              {!cameraError && (
                <div style={{
                  position: 'absolute', bottom: '1.25rem', left: 0, right: 0,
                  display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2rem'
                }}>
                  {/* Camera toggle */}
                  <button
                    onClick={toggleCamera}
                    style={{
                      width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(0,0,0,0.5)',
                      border: '1.5px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '1.2rem', cursor: 'pointer'
                    }}
                  >
                    🔄
                  </button>
                  {/* Main capture button */}
                  <button
                    onClick={capturePhoto}
                    style={{
                      width: '64px', height: '64px', borderRadius: '50%', background: '#fff',
                      border: '5px solid rgba(255,255,255,0.3)', cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                    }}
                  />
                  {/* Gallery access */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(0,0,0,0.5)',
                      border: '1.5px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '1.2rem', cursor: 'pointer'
                    }}
                  >
                    📂
                  </button>
                </div>
              )}
            </>
          ) : (
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
              <img
                src={capturedImage}
                alt="Captured"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <button
                onClick={() => setCapturedImage(null)}
                style={{
                  position: 'absolute', bottom: '1.25rem', left: '1.25rem',
                  background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff',
                  padding: '0.4rem 1rem', borderRadius: '2rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer'
                }}
              >
                ← Chụp lại
              </button>
            </div>
          )}
        </div>

        {/* Hidden inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        {/* Info Form */}
        {capturedImage && (
          <form onSubmit={handleSubmit} style={{ padding: '1.25rem', overflowY: 'auto', maxHeight: '280px' }}>
            {/* GPS Toggle */}
            <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem', background: '#1a1a1a', borderRadius: '0.75rem', border: '1px solid #2a2a2a' }}>
              <input
                type="checkbox"
                id="snapzUseGPS"
                checked={useGPS}
                onChange={(e) => {
                  const val = e.target.checked;
                  setUseGPS(val);
                  handleFetchGPS(val);
                }}
                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#3b82f6' }}
              />
              <label htmlFor="snapzUseGPS" style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e5e7eb', cursor: 'pointer', selectSpread: 'none' }}>
                🛰️ Sử dụng vị trí GPS hiện tại
              </label>
            </div>

            {/* 1. Geolocation nearby suggestions */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#666', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                📍 Địa điểm của bạn
              </label>
              
              {useGPS && nearbyLocations.length > 0 ? (
                <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.4rem', scrollbarWidth: 'none' }}>
                  {nearbyLocations.map((loc) => (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => {
                        setSpotName(loc.name);
                        setCategory(loc.category);
                        if (loc.address) setAddress(loc.address);
                        if (loc.latitude && loc.longitude) {
                          setCoords({ lat: loc.latitude, lng: loc.longitude });
                        }
                      }}
                      style={{
                        padding: '0.35rem 0.8rem', borderRadius: '1rem',
                        background: spotName === loc.name ? '#3b82f6' : '#222',
                        border: spotName === loc.name ? '1px solid #3b82f6' : '1px solid #333',
                        color: '#fff', fontSize: '0.75rem', fontWeight: 600,
                        cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s'
                      }}
                    >
                      {loc.name} ({Math.round(loc.distance)}m)
                    </button>
                  ))}
                </div>
              ) : (
                <p style={{ margin: '0 0 0.4rem', fontSize: '0.75rem', color: '#888', fontStyle: 'italic' }}>
                  {useGPS ? 'Không thấy quán nào đã lưu lân cận...' : 'Bật GPS ở trên để tìm các quán gần bạn! 📍'}
                </p>
              )}

              <input
                type="text"
                placeholder="Nhập tên quán / địa điểm..."
                value={spotName}
                onChange={(e) => setSpotName(e.target.value)}
                required
                style={{
                  width: '100%', padding: '0.6rem 0.85rem', background: '#222', border: '1px solid #333',
                  borderRadius: '0.75rem', color: '#fff', fontSize: '0.85rem', outline: 'none'
                }}
              />
            </div>

            {/* 2. Category selection (only show if not existing location) */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#666', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                Danh mục
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  width: '100%', padding: '0.6rem 0.85rem', background: '#222', border: '1px solid #333',
                  borderRadius: '0.75rem', color: '#fff', fontSize: '0.85rem', outline: 'none'
                }}
              >
                <option value="Food">🍔 Ăn uống</option>
                <option value="Housing">🏠 Nhà trọ</option>
                <option value="Cafe">☕ Cafe</option>
                <option value="Play">🎡 Vui chơi</option>
                <option value="Other">🏷️ Khác</option>
              </select>
            </div>

            {/* 3. Quick Tag select */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#666', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                Đánh giá nhanh
              </label>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {QUICK_TAGS.map((tag) => {
                  const active = selectedTags.includes(tag.value);
                  return (
                    <button
                      key={tag.value}
                      type="button"
                      onClick={() => handleTagToggle(tag.value)}
                      style={{
                        padding: '0.35rem 0.7rem', borderRadius: '2rem',
                        background: active ? 'rgba(59, 130, 246, 0.2)' : '#222',
                        border: active ? '1px solid #3b82f6' : '1px solid #333',
                        color: active ? '#60a5fa' : '#bbb', fontSize: '0.75rem',
                        fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s'
                      }}
                    >
                      {tag.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Caption input */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: '#666', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                <span>Caption</span>
                <span style={{ fontWeight: 500, color: caption.length > 70 ? '#f59e0b' : '#555' }}>
                  {caption.length}/80
                </span>
              </div>
              <input
                type="text"
                maxLength={80}
                placeholder="Món này ngon cực... (Viết tối đa 80 ký tự)"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                style={{
                  width: '100%', padding: '0.6rem 0.85rem', background: '#222', border: '1px solid #333',
                  borderRadius: '0.75rem', color: '#fff', fontSize: '0.85rem', outline: 'none'
                }}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '0.85rem',
                background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                color: '#fff', border: 'none', borderRadius: '0.75rem',
                fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
                transition: 'opacity 0.2s', opacity: loading ? 0.6 : 1,
                boxShadow: '0 4px 15px rgba(59,130,246,0.3)'
              }}
            >
              {loading ? 'Đang tải lên...' : '⚡ Đăng lên VibeZ'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
