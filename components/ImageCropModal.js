import { useState, useRef, useEffect } from 'react';

export default function ImageCropModal({
  isOpen,
  onClose,
  imageSrc,
  isCircular,
  onSave,
  title = 'Chỉnh sửa ảnh',
}) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(false);
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });
  const [viewSize, setViewSize] = useState({ width: 0, height: 0 });

  const containerRef = useRef(null);
  const imageRef = useRef(null);

  // Reset states when a new image is loaded
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setLoading(false);
    }
  }, [isOpen, imageSrc]);

  if (!isOpen || !imageSrc) return null;

  // Calculate clamp limits for offsets to ensure the image always covers the viewport
  const getClampedOffset = (x, y, currentZoom, currentImgSize, currentViewSize) => {
    const w = currentImgSize.width || imgSize.width;
    const h = currentImgSize.height || imgSize.height;
    const vw = currentViewSize.width || viewSize.width;
    const vh = currentViewSize.height || viewSize.height;

    if (!w || !vw) return { x, y };

    // Fit scale: scale factor to make the image cover the viewport
    const fitScale = Math.max(vw / w, vh / h);
    const dispWidth = w * fitScale * currentZoom;
    const dispHeight = h * fitScale * currentZoom;

    let clampedX = x;
    let clampedY = y;

    if (dispWidth > vw) {
      clampedX = Math.min(0, Math.max(vw - dispWidth, x));
    } else {
      clampedX = (vw - dispWidth) / 2;
    }

    if (dispHeight > vh) {
      clampedY = Math.min(0, Math.max(vh - dispHeight, y));
    } else {
      clampedY = (vh - dispHeight) / 2;
    }

    return { x: clampedX, y: clampedY };
  };

  const handleImageLoad = (e) => {
    const img = e.target;
    const vw = containerRef.current.clientWidth;
    const vh = containerRef.current.clientHeight;

    const currentImgSize = { width: img.naturalWidth, height: img.naturalHeight };
    const currentViewSize = { width: vw, height: vh };

    setImgSize(currentImgSize);
    setViewSize(currentViewSize);

    // Initial center fit
    const fitScale = Math.max(vw / img.naturalWidth, vh / img.naturalHeight);
    const baseW = img.naturalWidth * fitScale;
    const baseH = img.naturalHeight * fitScale;

    setOffset({
      x: (vw - baseW) / 2,
      y: (vh - baseH) / 2,
    });
  };

  // Mouse Dragging Handlers
  const handleMouseDown = (e) => {
    if (loading) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX - offset.x,
      y: e.clientY - offset.y,
    });
    e.preventDefault();
  };

  const handleMouseMove = (e) => {
    if (!isDragging || loading) return;
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    setOffset(getClampedOffset(newX, newY, zoom, imgSize, viewSize));
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  // Mobile Touch Dragging Handlers
  const handleTouchStart = (e) => {
    if (loading || e.touches.length !== 1) return;
    setIsDragging(true);
    setDragStart({
      x: e.touches[0].clientX - offset.x,
      y: e.touches[0].clientY - offset.y,
    });
  };

  const handleTouchMove = (e) => {
    if (!isDragging || loading || e.touches.length !== 1) return;
    const newX = e.touches[0].clientX - dragStart.x;
    const newY = e.touches[0].clientY - dragStart.y;
    setOffset(getClampedOffset(newX, newY, zoom, imgSize, viewSize));
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleZoomChange = (e) => {
    const val = parseFloat(e.target.value);
    setZoom(val);
    setOffset(getClampedOffset(offset.x, offset.y, val, imgSize, viewSize));
  };

  // Canvas high-resolution crop action
  const handleSave = () => {
    if (loading) return;
    setLoading(true);

    // Timeout allows the loader spinner UI to render
    setTimeout(() => {
      try {
        const img = imageRef.current;
        const canvas = document.createElement('canvas');

        // Output sizes: 935x220 for cover, 300x300 for avatar
        const targetWidth = isCircular ? 300 : 935;
        const targetHeight = isCircular ? 220 : 220; // Aspect ratio height for covers

        canvas.width = targetWidth;
        canvas.height = isCircular ? 300 : 220;

        const ctx = canvas.getContext('2d');

        // Fit scale of base image
        const fitScale = Math.max(viewSize.width / imgSize.width, viewSize.height / imgSize.height);
        const dispWidth = imgSize.width * fitScale * zoom;
        const dispHeight = imgSize.height * fitScale * zoom;

        // Ratio mapping from viewport back to original source image coordinates
        const ratio = imgSize.width / dispWidth;

        const sX = -offset.x * ratio;
        const sY = -offset.y * ratio;
        const sWidth = viewSize.width * ratio;
        const sHeight = viewSize.height * ratio;

        // Draw image onto target high-quality canvas
        ctx.drawImage(img, sX, sY, sWidth, sHeight, 0, 0, canvas.width, canvas.height);

        const base64 = canvas.toDataURL('image/jpeg', 0.85);
        onSave(base64);
      } catch (err) {
        console.error('Error cropping image:', err);
        alert('Có lỗi xảy ra khi xử lý và cắt ảnh.');
      } finally {
        setLoading(false);
      }
    }, 100);
  };

  return (
    <div className="crop-modal-overlay" onClick={onClose}>
      <div className="crop-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="crop-modal-header">
          <h3 className="crop-modal-title">{title}</h3>
          <p className="crop-modal-desc">
            Phóng to/thu nhỏ bằng thanh kéo và di chuột (kéo thả) để căn chỉnh vị trí ảnh hoàn hảo nhất
          </p>
        </div>

        {/* Viewport Frame */}
        <div
          ref={containerRef}
          className={`crop-viewport-container ${isCircular ? 'crop-viewport-circular' : 'crop-viewport-cover'}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Inner circle mask for avatar guide */}
          {isCircular && <div className="crop-circular-guide" />}

          {/* Draggable image */}
          <img
            ref={imageRef}
            src={imageSrc}
            onLoad={handleImageLoad}
            style={{
              transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
              width: imgSize.width
                ? `${
                    imgSize.width *
                    Math.max(viewSize.width / imgSize.width, viewSize.height / imgSize.height) *
                    zoom
                  }px`
                : '100%',
              height: imgSize.height
                ? `${
                    imgSize.height *
                    Math.max(viewSize.width / imgSize.width, viewSize.height / imgSize.height) *
                    zoom
                  }px`
                : 'auto',
              maxWidth: 'none',
              maxHeight: 'none',
              cursor: isDragging ? 'grabbing' : 'grab',
              userSelect: 'none',
              pointerEvents: 'none', // Prevents default browser image drag behavior
              position: 'absolute',
              top: 0,
              left: 0,
            }}
            alt="Adjust viewport"
          />

          {loading && (
            <div className="crop-loading-overlay">
              <div className="crop-spinner" />
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="crop-controls-wrap">
          <div className="crop-slider-row">
            <span className="crop-slider-label">🔎 Thu nhỏ</span>
            <input
              type="range"
              min="1"
              max="3"
              step="0.01"
              value={zoom}
              onChange={handleZoomChange}
              className="crop-zoom-slider"
              disabled={loading}
            />
            <span className="crop-slider-label">Phóng to 🔍</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="crop-actions-wrap">
          <button
            type="button"
            className="crop-btn crop-btn-cancel"
            onClick={onClose}
            disabled={loading}
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            className="crop-btn crop-btn-save"
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? 'Đang xử lý...' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>
    </div>
  );
}
