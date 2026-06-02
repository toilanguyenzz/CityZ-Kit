'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import '@/app/styles/product-tour.css';

/**
 * ProductTour — Interactive Guided Tour Component
 * Inspired by Notion / Slack / Discord onboarding
 * 
 * Usage:
 *   <ProductTour steps={TOUR_STEPS} onComplete={handler} onSkip={handler} />
 */

const DASHBOARD_TOUR_STEPS = [
  {
    targetSelector: 'nav',
    title: 'Thanh điều hướng chính',
    description: 'Đây là thanh navigation — dùng để <strong>di chuyển nhanh</strong> giữa các trang: Khám phá địa điểm, Cộng đồng, Kết nối bạn bè, Tin nhắn và Góp ý.',
    tip: 'Bấm vào tên trang bất kỳ để truy cập ngay!',
    position: 'bottom',
  },
  {
    targetSelector: '.cmd-actions',
    title: 'Quick Actions — Hành động nhanh',
    description: 'Bấm vào các nút nhanh để <strong>tìm quán ăn, nhà trọ, bạn bè học tập</strong> hay xem bản đồ an toàn chỉ với 1 click.',
    tip: 'Thử bấm "🍜 Ăn gì?" để xem ngay danh sách quán ăn gần trường bạn!',
    position: 'bottom',
  },
  {
    targetSelector: '.stories-strip',
    title: 'Khoảnh khắc Sinh viên',
    description: 'Xem <strong>ảnh check-in thực tế</strong> từ các sinh viên khác — hoặc bấm 📸 để tải ảnh bạn chụp lên chia sẻ với cộng đồng.',
    tip: 'Giống Stories trên Instagram, nhưng dành riêng cho sinh viên!',
    position: 'bottom',
  },
  {
    targetSelector: '.cmd-trend-list',
    title: '🔥 Trending hôm nay',
    description: 'Danh sách <strong>bài viết, địa điểm và kết nối đang hot nhất</strong> trong cộng đồng. Bấm vào để xem chi tiết.',
    tip: 'Cập nhật liên tục — luôn có thông tin mới mỗi ngày!',
    position: 'bottom',
  },
  {
    targetSelector: '.db-sticky-toolbar',
    title: 'Bộ lọc & Tìm kiếm',
    description: 'Lọc địa điểm theo <strong>quận/huyện, đánh giá sao, danh mục</strong> (Ăn uống, Nhà trọ, Cafe...) hoặc gõ tên để tìm kiếm.',
    tip: 'Lọc theo quận của trường bạn để xem địa điểm gần nhất!',
    position: 'bottom',
  },
  {
    targetSelector: 'a[href="/add-location"][style]',
    title: 'Nút + Thêm địa điểm',
    description: 'Khám phá được quán ăn ngon hay nhà trọ tốt? Bấm nút <strong>"+"</strong> để chia sẻ với cộng đồng và <strong>nhận huy hiệu thưởng</strong>!',
    tip: 'Đóng góp càng nhiều → Level càng cao → Huy hiệu càng xịn!',
    position: 'top',
  },
];

export { DASHBOARD_TOUR_STEPS };

export default function ProductTour({ steps = DASHBOARD_TOUR_STEPS, onComplete, onSkip }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const [showComplete, setShowComplete] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const tooltipRef = useRef(null);
  const resizeTimerRef = useRef(null);

  const step = steps[currentStep];

  // Calculate target element position
  const updateTargetPosition = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.targetSelector);
    if (!el) {
      // Skip to next step if element not found
      if (currentStep < steps.length - 1) {
        setCurrentStep(prev => prev + 1);
      }
      return;
    }

    const rect = el.getBoundingClientRect();
    const padding = 8;
    setTargetRect({
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    });

    // Calculate tooltip position
    const tooltipWidth = Math.min(340, window.innerWidth - 32);
    const tooltipHeight = 260; // approximate
    let top, left;

    const pos = step.position || 'bottom';

    if (pos === 'bottom') {
      top = rect.bottom + 16;
      left = Math.max(16, Math.min(rect.left, window.innerWidth - tooltipWidth - 16));
      // If tooltip goes below viewport, switch to top
      if (top + tooltipHeight > window.innerHeight - 16) {
        top = rect.top - tooltipHeight - 16;
      }
    } else if (pos === 'top') {
      top = rect.top - tooltipHeight - 16;
      left = Math.max(16, Math.min(rect.left, window.innerWidth - tooltipWidth - 16));
      // If tooltip goes above viewport, switch to bottom
      if (top < 16) {
        top = rect.bottom + 16;
      }
    } else if (pos === 'left') {
      top = rect.top;
      left = rect.left - tooltipWidth - 16;
      if (left < 16) {
        left = rect.right + 16;
      }
    } else { // right
      top = rect.top;
      left = rect.right + 16;
      if (left + tooltipWidth > window.innerWidth - 16) {
        left = rect.left - tooltipWidth - 16;
      }
    }

    setTooltipPos({ top, left });

    // Scroll element into view if needed
    if (rect.top < 0 || rect.bottom > window.innerHeight) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [step, currentStep, steps.length]);

  useEffect(() => {
    updateTargetPosition();

    const handleResize = () => {
      clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(updateTargetPosition, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', updateTargetPosition, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', updateTargetPosition, true);
      clearTimeout(resizeTimerRef.current);
    };
  }, [updateTargetPosition]);

  const handleNext = () => {
    if (currentStep >= steps.length - 1) {
      // Last step — show completion
      setShowComplete(true);
      return;
    }
    setCurrentStep(prev => prev + 1);
  };

  const handleSkip = () => {
    setIsExiting(true);
    setTimeout(() => {
      onSkip?.();
    }, 300);
  };

  const handleComplete = () => {
    setIsExiting(true);
    setTimeout(() => {
      onComplete?.();
    }, 300);
  };

  if (isExiting) return null;

  // Show completion card
  if (showComplete) {
    return (
      <div className="tour-complete-overlay">
        <div className="tour-complete-card">
          <span className="tour-complete-emoji">🎉</span>
          <h2 className="tour-complete-title">Bạn đã sẵn sàng!</h2>
          <p className="tour-complete-desc">
            Giờ bạn đã hiểu cách dùng CityZ Kit rồi.<br />
            Hãy bắt đầu khám phá Sài Gòn nào!
          </p>
          <button onClick={handleComplete} className="tour-complete-btn">
            Bắt đầu khám phá! 🚀
          </button>
          <div className="tour-complete-links">
            <Link href="/guide" onClick={handleComplete} className="tour-complete-link">
              📖 Xem hướng dẫn đầy đủ
            </Link>
            <Link href="/add-location" onClick={handleComplete} className="tour-complete-link">
              ➕ Thêm địa điểm đầu tiên
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!targetRect) return null;

  return (
    <div className={`tour-overlay tour-overlay--active`}>
      {/* Spotlight hole */}
      <div
        className="tour-spotlight"
        style={{
          top: targetRect.top,
          left: targetRect.left,
          width: targetRect.width,
          height: targetRect.height,
        }}
      />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className={`tour-tooltip tour-tooltip--${step.position || 'bottom'}`}
        style={{ top: tooltipPos.top, left: tooltipPos.left }}
      >
        <div className={`tour-tooltip-arrow`} />

        <div className="tour-tooltip-header">
          <span className="tour-tooltip-step-badge">
            {currentStep + 1}
          </span>
          <h3 className="tour-tooltip-title">{step.title}</h3>
        </div>

        <div className="tour-tooltip-body">
          <p
            className="tour-tooltip-desc"
            dangerouslySetInnerHTML={{ __html: step.description }}
          />
          {step.tip && (
            <div className="tour-tooltip-tip">
              <span className="tour-tooltip-tip-icon">💡</span>
              <span className="tour-tooltip-tip-text">{step.tip}</span>
            </div>
          )}
        </div>

        <div className="tour-tooltip-footer">
          <div className="tour-tooltip-dots">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`tour-dot ${
                  i === currentStep ? 'tour-dot--active' : i < currentStep ? 'tour-dot--done' : ''
                }`}
              />
            ))}
          </div>
          <div className="tour-tooltip-actions">
            <button onClick={handleSkip} className="tour-btn-skip">
              Bỏ qua
            </button>
            <button onClick={handleNext} className="tour-btn-next">
              {currentStep >= steps.length - 1 ? 'Hoàn tất ✨' : 'Tiếp tục →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
