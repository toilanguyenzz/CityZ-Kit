'use client';

import '@/app/styles/guide.css';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import { useState } from 'react';

const FEATURES = [
  {
    emoji: '📍',
    title: 'Khám phá Địa điểm',
    desc: 'Tìm quán ăn ngon, nhà trọ uy tín, quán cafe yên tĩnh — tất cả đều do sinh viên thực tế đánh giá và xác minh. Lọc theo quận, đánh giá sao hoặc danh mục.',
    href: '/dashboard',
    linkText: 'Khám phá ngay',
    bg: '#eef2ff',
    accent: 'linear-gradient(90deg, #3b82f6, #6366f1)',
  },
  {
    emoji: '📝',
    title: 'Blog Cộng đồng',
    desc: 'Đọc & viết bài chia sẻ kinh nghiệm sống, mẹo thuê trọ, review quán ăn từ chính các sinh viên đi trước. Upvote bài hay, bình luận trao đổi.',
    href: '/blog',
    linkText: 'Xem blog',
    bg: '#f0fdf4',
    accent: 'linear-gradient(90deg, #10b981, #059669)',
  },
  {
    emoji: '🤝',
    title: 'Tìm bạn cùng phòng & bạn học',
    desc: 'Đăng tin tìm roommate, study buddy hoặc bạn đồng hành khám phá thành phố. Kết nối với sinh viên cùng trường, cùng quận.',
    href: '/buddy-finder',
    linkText: 'Tìm bạn',
    bg: '#fef3c7',
    accent: 'linear-gradient(90deg, #f59e0b, #d97706)',
  },
  {
    emoji: '💬',
    title: 'Nhắn tin trực tuyến',
    desc: 'Chat trực tiếp với các sinh viên khác, hỏi thăm về nhà trọ, quán ăn hoặc trao đổi mua bán đồ cũ qua hệ thống tin nhắn real-time.',
    href: '/messages',
    linkText: 'Mở tin nhắn',
    bg: '#ede9fe',
    accent: 'linear-gradient(90deg, #8b5cf6, #7c3aed)',
  },
  {
    emoji: '🛍️',
    title: 'Chợ Sinh viên (Marketplace)',
    desc: 'Mua bán đồ cũ giữa sinh viên: sách, đồ điện tử, nội thất phòng trọ. Giao dịch trực tiếp, không qua trung gian.',
    href: '/marketplace',
    linkText: 'Xem marketplace',
    bg: '#fce7f3',
    accent: 'linear-gradient(90deg, #ec4899, #db2777)',
  },
  {
    emoji: '🛡️',
    title: 'Bản đồ An toàn',
    desc: 'Xem các khu vực cảnh báo an toàn do cộng đồng sinh viên đóng góp. Biết trước những nơi cần cẩn thận khi đi lại.',
    href: '/safety',
    linkText: 'Xem bản đồ',
    bg: '#fee2e2',
    accent: 'linear-gradient(90deg, #ef4444, #dc2626)',
  },
  {
    emoji: '📸',
    title: 'Khoảnh khắc Sinh viên (Shorts)',
    desc: 'Chia sẻ ảnh & video check-in tại các địa điểm bạn yêu thích. Giống Instagram Stories nhưng dành riêng cho sinh viên!',
    href: '/shorts',
    linkText: 'Xem shorts',
    bg: '#fdf4ff',
    accent: 'linear-gradient(90deg, #d946ef, #a855f7)',
  },
  {
    emoji: '🏆',
    title: 'Huy hiệu & Level',
    desc: 'Đóng góp review, thêm địa điểm, viết blog để nhận huy hiệu thưởng. Tích lũy XP, lên level và xây dựng uy tín trong cộng đồng.',
    href: '/profile',
    linkText: 'Xem hồ sơ',
    bg: '#fefce8',
    accent: 'linear-gradient(90deg, #eab308, #ca8a04)',
  },
];

const QUICK_STEPS = [
  {
    num: '01',
    title: 'Tạo tài khoản miễn phí',
    desc: 'Đăng ký chỉ với email và mật khẩu. Không spam, không cần số điện thoại. Sau đó thiết lập hồ sơ cá nhân: chọn trường, quận, gu ăn uống để nhận gợi ý cá nhân hóa.',
    tags: ['✍️ Email', '🎓 Chọn trường', '📍 Chọn quận'],
  },
  {
    num: '02',
    title: 'Khám phá & Tìm kiếm',
    desc: 'Duyệt Dashboard để xem danh sách địa điểm do sinh viên đóng góp. Sử dụng bộ lọc theo quận, đánh giá sao hoặc danh mục (Ăn uống, Nhà trọ, Cafe) để tìm nhanh.',
    tags: ['🔍 Tìm kiếm', '🗂️ Lọc theo quận', '⭐ Lọc theo rating'],
  },
  {
    num: '03',
    title: 'Đánh giá & Đóng góp',
    desc: 'Viết review cho các địa điểm bạn đã trải nghiệm, thêm địa điểm mới mà bạn khám phá được, hoặc viết blog chia sẻ kinh nghiệm. Mỗi đóng góp giúp bạn nhận huy hiệu thưởng!',
    tags: ['⭐ Review', '➕ Thêm địa điểm', '📝 Viết blog', '🏆 Nhận huy hiệu'],
  },
  {
    num: '04',
    title: 'Kết nối & Chia sẻ',
    desc: 'Tìm bạn cùng phòng, bạn học hoặc bạn đồng hành. Chat trực tiếp qua tin nhắn. Mua bán đồ cũ trên Marketplace. Chia sẻ khoảnh khắc qua Shorts!',
    tags: ['🤝 Tìm bạn', '💬 Chat', '🛍️ Marketplace', '📸 Shorts'],
  },
];

const FAQ_DATA = [
  {
    q: 'CityZ Kit là gì? Dùng để làm gì?',
    a: 'CityZ Kit là nền tảng <strong>all-in-one hỗ trợ tân sinh viên TP.HCM</strong>. Bạn có thể tìm quán ăn ngon, nhà trọ uy tín, quán cafe yên tĩnh, kết nối bạn bè, đọc blog chia sẻ kinh nghiệm và nhận gợi ý cá nhân hóa — tất cả trong một ứng dụng duy nhất.',
  },
  {
    q: 'Có mất phí không?',
    a: 'Hoàn toàn <strong>miễn phí</strong>! CityZ Kit được xây dựng bởi chính sinh viên, dành cho sinh viên. Không quảng cáo, không thu phí ẩn.',
  },
  {
    q: 'Làm sao để thêm địa điểm mới?',
    a: 'Sau khi đăng nhập, bấm nút <strong>"+"</strong> ở góc dưới bên phải màn hình, hoặc vào menu <strong>Khám phá → Thêm địa điểm</strong>. Điền tên, địa chỉ, mô tả, chọn danh mục và tải ảnh lên. Địa điểm sẽ được kiểm duyệt trước khi hiển thị.',
  },
  {
    q: 'Huy hiệu và Level hoạt động như thế nào?',
    a: 'Mỗi hành động (viết review, thêm địa điểm, viết blog, bình luận) đều cho bạn <strong>điểm XP</strong>. Tích lũy XP để lên Level (từ Tân binh → Thám hiểm gia → Hướng dẫn viên...) và mở khóa các <strong>huy hiệu</strong> đặc biệt trên hồ sơ cá nhân.',
  },
  {
    q: 'Dữ liệu địa điểm có đáng tin không?',
    a: 'Tất cả địa điểm đều được <strong>sinh viên thực tế review</strong> và có hệ thống kiểm duyệt bởi admin. Bạn có thể xem đánh giá sao, bình luận và ảnh thực tế từ cộng đồng trước khi quyết định.',
  },
  {
    q: 'Làm sao để tìm bạn cùng phòng?',
    a: 'Vào trang <strong>"Kết nối"</strong> trên thanh điều hướng, chọn loại kết nối (bạn ở ghép, bạn học, bạn đồng hành) và đăng tin. Các sinh viên khác sẽ thấy và liên hệ bạn qua chat.',
  },
  {
    q: 'Tôi có thể mua bán đồ cũ ở đâu?',
    a: 'Vào <strong>Marketplace</strong> (Chợ Sinh viên) trên Dashboard hoặc qua menu. Bạn có thể đăng bán sách, đồ điện tử, nội thất phòng trọ và chat trực tiếp với người mua/bán.',
  },
  {
    q: 'Bản đồ An toàn là gì?',
    a: 'Đây là bản đồ <strong>cảnh báo các khu vực</strong> cần lưu ý khi đi lại (mất trộm, ngập nước, v.v.) do cộng đồng sinh viên đóng góp. Giúp bạn chuẩn bị tốt hơn khi di chuyển trong thành phố.',
  },
];

export default function GuidePage() {
  const [openFaq, setOpenFaq] = useState(null);

  const toggleFaq = (i) => {
    setOpenFaq(prev => (prev === i ? null : i));
  };

  return (
    <div className="guide-root">
      <Navbar />

      {/* ═══ HERO ═══ */}
      <section className="guide-hero">
        <span className="guide-hero-badge">📖 Hướng dẫn sử dụng</span>
        <h1 className="guide-hero-title">
          Mọi thứ bạn cần biết về <br />
          <span>CityZ Kit</span>
        </h1>
        <p className="guide-hero-desc">
          Từ cách tìm quán ăn ngon đến kết nối bạn bè — hướng dẫn này sẽ giúp bạn 
          khai thác tối đa mọi tính năng của nền tảng chỉ trong vài phút.
        </p>
        <div className="guide-hero-actions">
          <Link href="/signup" className="guide-hero-btn guide-hero-btn--primary">
            🚀 Bắt đầu ngay
          </Link>
          <a href="#features" className="guide-hero-btn guide-hero-btn--secondary">
            ↓ Xem tính năng
          </a>
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section id="features" className="guide-section">
        <span className="guide-section-label">✨ Tính năng</span>
        <h2 className="guide-section-title">CityZ Kit có những gì?</h2>
        <p className="guide-section-subtitle">
          8 tính năng chính giúp bạn sống, học và vui chơi tại Sài Gòn dễ dàng hơn
        </p>
        <div className="guide-features-grid">
          {FEATURES.map((f, i) => (
            <Link
              key={i}
              href={f.href}
              className="guide-feature-card"
              style={{ '--card-accent': f.accent, '--card-bg': f.bg }}
            >
              <div className="guide-feature-icon" style={{ background: f.bg }}>
                {f.emoji}
              </div>
              <h3 className="guide-feature-title">{f.title}</h3>
              <p className="guide-feature-desc">{f.desc}</p>
              <span className="guide-feature-link">
                {f.linkText} <span>→</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ═══ QUICK START ═══ */}
      <section className="guide-section" style={{ background: '#fafaff', borderRadius: 0, margin: '0 auto', maxWidth: '100%', padding: '48px 20px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <span className="guide-section-label">🚀 Bắt đầu nhanh</span>
          <h2 className="guide-section-title">4 bước để bắt đầu hành trình</h2>
          <p className="guide-section-subtitle">
            Đơn giản, nhanh chóng và hoàn toàn miễn phí
          </p>
          <div className="guide-steps">
            {QUICK_STEPS.map((s, i) => (
              <div key={i} className="guide-step">
                <div className="guide-step-number">{s.num}</div>
                <div className="guide-step-content">
                  <h3 className="guide-step-title">{s.title}</h3>
                  <p className="guide-step-desc">{s.desc}</p>
                  <div className="guide-step-tags">
                    {s.tags.map((tag, j) => (
                      <span key={j} className="guide-step-tag">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section id="faq" className="guide-section">
        <span className="guide-section-label">❓ Câu hỏi thường gặp</span>
        <h2 className="guide-section-title">FAQ — Những thắc mắc phổ biến</h2>
        <p className="guide-section-subtitle">
          Bấm vào câu hỏi để xem câu trả lời chi tiết
        </p>
        <div className="guide-faq-list">
          {FAQ_DATA.map((faq, i) => (
            <div key={i} className={`guide-faq-item ${openFaq === i ? 'guide-faq-item--open' : ''}`}>
              <button className="guide-faq-q" onClick={() => toggleFaq(i)}>
                <span className="guide-faq-q-text">{faq.q}</span>
                <svg className="guide-faq-chevron" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openFaq === i && (
                <div className="guide-faq-a" dangerouslySetInnerHTML={{ __html: faq.a }} />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="guide-cta">
        <span className="guide-cta-emoji">🎓</span>
        <h2 className="guide-cta-title">Sẵn sàng bắt đầu cuộc sống đại học?</h2>
        <p className="guide-cta-desc">
          Tham gia CityZ Kit ngay — hoàn toàn miễn phí, do sinh viên xây dựng, dành cho sinh viên.
        </p>
        <div className="guide-cta-buttons">
          <Link href="/signup" className="guide-hero-btn guide-hero-btn--primary">
            ✍️ Tạo tài khoản
          </Link>
          <Link href="/dashboard" className="guide-hero-btn guide-hero-btn--secondary">
            🔍 Khám phá ngay
          </Link>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="guide-footer">
        <p>
          © 2024–2026 CityZ Kit · Made with ❤️ by Students · <Link href="/">Trang chủ</Link>
        </p>
      </footer>
    </div>
  );
}
