'use client';

import { useEffect, useRef } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';


/* ── Fade‑in on scroll hook ───────────────────────────── */
function useFadeIn() {
  const ref = useRef(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('fade-in-visible');
        }
      },
      { threshold: 0.15 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return ref;
}

export default function Home() {
  /* seed user profile on first login */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const snap = await getDoc(doc(db, 'users', user.uid));
          if (!snap.exists()) {
            await setDoc(doc(db, 'users', user.uid), {
              uid: user.uid,
              email: user.email,
              name: user.displayName || user.email,
              role: 'user',
              badges: [],
              createdAt: new Date().toISOString(),
            });
          }
        } catch (error) {
          console.error('Error seeding user profile:', error);
        }
      }
    });
    return () => unsub();
  }, []);

  /* section refs */
  const featRef = useFadeIn();
  const howRef = useFadeIn();
  const ctaRef = useFadeIn();

  return (
    <div className="landing-root">
      {/* ───────── HERO ───────── */}
      <section className="hero">
        {/* animated background blobs */}
        <div className="hero-blob hero-blob--1" />
        <div className="hero-blob hero-blob--2" />
        <div className="hero-blob hero-blob--3" />

        <div className="hero-content">
          <span className="hero-badge">🎓 Dành riêng cho tân sinh viên TP.HCM</span>

          <h1 className="hero-title">
            Bắt đầu cuộc sống <br />
            <span className="hero-gradient-text">đại học thật dễ dàng</span>
          </h1>

          <p className="hero-desc">
            <strong>CityZ Kit</strong> là nền tảng <em>all‑in‑one</em> giúp sinh viên mới tìm nhà trọ uy tín,
            khám phá quán ăn ngon‑bổ‑rẻ, đọc blog chia sẻ kinh nghiệm và nhận <strong>gợi ý thông minh từ AI</strong> —
            tất cả trong một ứng dụng duy nhất.
          </p>

          <div className="hero-buttons">
            <Link href="/dashboard" className="btn-hero-primary">
              <span>🚀</span> Khám phá ngay
            </Link>
            <Link href="/recommend" className="btn-hero-secondary">
              <span>✨</span> Gợi ý AI
            </Link>
            <Link href="/signup" className="btn-hero-outline">
              Tạo tài khoản miễn phí →
            </Link>
          </div>

          {/* floating preview cards */}
          <div className="hero-preview-cards">
            <div className="preview-card preview-card--1">
              <span className="preview-icon">🍜</span>
              <div>
                <strong>Phở Hà Nội Bà Sáu</strong>
                <small>Q. Bình Thạnh · ⭐ 4.8</small>
              </div>
            </div>
            <div className="preview-card preview-card--2">
              <span className="preview-icon">🏠</span>
              <div>
                <strong>Nhà trọ SV Thủ Đức</strong>
                <small>TP. Thủ Đức · 1.5tr/tháng</small>
              </div>
            </div>
            <div className="preview-card preview-card--3">
              <span className="preview-icon">☕</span>
              <div>
                <strong>Café Sách Đèn Vàng</strong>
                <small>Q.1 · ⭐ 4.9 · Yên tĩnh</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── FEATURES ───────── */}
      <section ref={featRef} className="section fade-in-section features-section">
        <h2 className="section-title">Tại sao chọn <span className="gradient-text">CityZ Kit</span>?</h2>
        <p className="section-subtitle">
          Một nền tảng — sáu siêu năng lực dành cho hành trình sinh viên của bạn
        </p>

        <div className="features-grid">
          {[
            {
              icon: '📍',
              color: '#3b82f6',
              title: 'Địa điểm xác thực',
              desc: 'Quán ăn, nhà trọ, quán cà phê — tất cả đều được sinh viên thực tế đánh giá và xác minh. Không lo "ảo giá" hay review giả.',
            },
            {
              icon: '🤖',
              color: '#8b5cf6',
              title: 'Gợi ý AI thông minh',
              desc: 'Nhập ngân sách, khẩu vị, khu vực — AI phân tích dữ liệu cộng đồng và đề xuất 3 địa điểm phù hợp nhất cho bạn.',
            },
            {
              icon: '📝',
              color: '#10b981',
              title: 'Blog chia sẻ kinh nghiệm',
              desc: 'Đọc & viết bài chia sẻ mẹo sống, kinh nghiệm thuê trọ, quán ăn ngon từ chính các sinh viên đi trước.',
            },
            {
              icon: '🏆',
              color: '#f59e0b',
              title: 'Hệ thống huy hiệu',
              desc: 'Đóng góp review, thêm địa điểm, viết blog — tích lũy huy hiệu để xây dựng uy tín trong cộng đồng sinh viên.',
            },
            {
              icon: '⭐',
              color: '#ef4444',
              title: 'Đánh giá & nhận xét',
              desc: 'Chấm sao, viết bình luận cho mỗi địa điểm. Giúp những sinh viên sau có thông tin chính xác nhất.',
            },
            {
              icon: '👤',
              color: '#06b6d4',
              title: 'Hồ sơ cá nhân',
              desc: 'Quản lý bài viết, đánh giá và lưu trữ bộ sưu tập huy hiệu cá nhân của riêng bạn.',
            },
          ].map((f, i) => (
            <div key={i} className="feature-card" style={{ '--accent': f.color }}>
              <div className="feature-icon-wrap">
                <span className="feature-icon">{f.icon}</span>
              </div>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── HOW IT WORKS ───────── */}
      <section ref={howRef} className="section fade-in-section how-section">
        <h2 className="section-title">Bắt đầu trong <span className="gradient-text">3 bước</span></h2>
        <p className="section-subtitle">Đơn giản, nhanh chóng và hoàn toàn miễn phí</p>

        <div className="steps-grid">
          {[
            {
              step: '01',
              icon: '✍️',
              title: 'Đăng ký tài khoản',
              desc: 'Tạo tài khoản chỉ với email và mật khẩu. Không cần số điện thoại, không spam.',
            },
            {
              step: '02',
              icon: '🔍',
              title: 'Khám phá & tìm kiếm',
              desc: 'Duyệt qua danh sách địa điểm, lọc theo danh mục (Quán ăn, Nhà trọ, Café) hoặc nhờ AI gợi ý.',
            },
            {
              step: '03',
              icon: '💬',
              title: 'Đánh giá & đóng góp',
              desc: 'Viết review, thêm địa điểm mới, chia sẻ blog. Nhận huy hiệu và giúp đỡ cộng đồng.',
            },
          ].map((s, i) => (
            <div key={i} className="step-card">
              <div className="step-number">{s.step}</div>
              <div className="step-icon">{s.icon}</div>
              <h3 className="step-title">{s.title}</h3>
              <p className="step-desc">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>


      {/* ───────── ABOUT PROJECT ───────── */}
      <section className="section about-section">
        <div className="about-grid">
          <div className="about-text">
            <span className="about-label">Về dự án</span>
            <h2 className="about-title">
              CityZ Kit — <span className="gradient-text">Student Toolkit</span>
            </h2>
            <p>
              CityZ Kit được phát triển với mục tiêu tạo ra một <strong>bộ công cụ số toàn diện</strong> hỗ trợ tân sinh viên khi bắt đầu cuộc sống mới năng động tại TP. Hồ Chí Minh.
            </p>
            <p>
              Không chỉ dừng lại ở việc tìm kiếm địa điểm, CityZ Kit tích hợp <strong>gợi ý thông minh từ AI</strong>, hệ thống <strong>đánh giá cộng đồng</strong> xác thực, <strong>blog chia sẻ kinh nghiệm</strong> sống thực tế và hệ thống <strong>huy hiệu đóng góp</strong> thú vị — giúp sinh viên vừa dễ dàng thích nghi, vừa kết nối và sẻ chia.
            </p>
          </div>
          <div className="about-visual">
            <div className="about-card-stack">
              <div className="about-float-card afc-1">
                <span>🍜</span> Khám phá ẩm thực Sài Gòn
              </div>
              <div className="about-float-card afc-2">
                <span>🏠</span> Tìm nhà trọ an toàn, giá rẻ
              </div>
              <div className="about-float-card afc-3">
                <span>🤖</span> AI gợi ý cá nhân hóa
              </div>
              <div className="about-float-card afc-4">
                <span>🏆</span> Huy hiệu & Bảng xếp hạng
              </div>
              <div className="about-float-card afc-5">
                <span>📝</span> Chia sẻ kinh nghiệm qua Blog
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── CTA ───────── */}
      <section ref={ctaRef} className="section fade-in-section cta-section">
        <div className="cta-content">
          <h2 className="cta-title">Sẵn sàng khám phá Sài Gòn?</h2>
          <p className="cta-desc">
            Tham gia cộng đồng CityZ Kit ngay hôm nay — hoàn toàn miễn phí, không quảng cáo, do chính sinh viên xây dựng và đóng góp.
          </p>
          <div className="cta-buttons">
            <Link href="/signup" className="btn-cta-primary">Tạo tài khoản miễn phí</Link>
            <Link href="/dashboard" className="btn-cta-secondary">Xem địa điểm →</Link>
          </div>
        </div>
      </section>

      {/* ───────── FOOTER ───────── */}
      <footer className="landing-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <h3>CityZ <span>Kit</span></h3>
            <p>Nền tảng hỗ trợ sinh viên TP.HCM khám phá, kết nối và phát triển.</p>
          </div>
          <div className="footer-links">
            <div>
              <h4>Khám phá</h4>
              <Link href="/dashboard">Địa điểm</Link>
              <Link href="/recommend">Gợi ý AI</Link>
              <Link href="/blog">Blog</Link>
            </div>
            <div>
              <h4>Tài khoản</h4>
              <Link href="/login">Đăng nhập</Link>
              <Link href="/signup">Đăng ký</Link>
              <Link href="/profile">Hồ sơ</Link>
            </div>
            <div>
              <h4>Hỗ trợ</h4>
              <span>hotro.cityzkit@gmail.com</span>
              <span>Cộng đồng sinh viên TP.HCM</span>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2024–2026 CityZ Kit · Made with ❤️ by Students</p>
        </div>
      </footer>
    </div>
  );
}
