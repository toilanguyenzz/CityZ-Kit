'use client';

import { useEffect, useRef, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import dynamic from 'next/dynamic';
import { getCommunityStats, getRecentUsers, getRecentActivities, getTrendingPostsPublic, timeAgoShort } from '@/lib/landing-social';

const ParticleBackground = dynamic(() => import('@/components/ParticleBackground'), { ssr: false });


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

/* ── Animated Counter ───────────────────────────── */
function AnimatedNumber({ end, duration = 1500 }) {
  const [value, setValue] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    if (end === 0 || started.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const startTime = performance.now();
        const animate = (currentTime) => {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setValue(Math.round(eased * end));
          if (progress < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
      }
    }, { threshold: 0.3 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, duration]);

  return <span ref={ref} style={{ fontVariantNumeric: 'tabular-nums' }}>{value.toLocaleString('vi-VN')}</span>;
}

export default function Home() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [communityStats, setCommunityStats] = useState({ userCount: 0, postCount: 0, locationCount: 0 });
  const [recentUsers, setRecentUsers] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [trendingPosts, setTrendingPosts] = useState([]);

  /* Kiểm tra auth → nếu đã đăng nhập thì vào thẳng Dashboard (giống Facebook) */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Seed user profile nếu lần đầu
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
        // Đã đăng nhập → chuyển thẳng vào Dashboard
        router.replace('/dashboard');
        return;
      }
      // Chưa đăng nhập → hiện trang Welcome
      setAuthChecked(true);
    });
    return () => unsub();
  }, [router]);

  // Fetch social proof data
  useEffect(() => {
    if (!authChecked) return;
    Promise.all([
      getCommunityStats(),
      getRecentUsers(8),
      getRecentActivities(4),
      getTrendingPostsPublic(3),
    ]).then(([stats, users, activities, posts]) => {
      setCommunityStats(stats);
      setRecentUsers(users);
      setRecentActivities(activities);
      setTrendingPosts(posts);
    }).catch(console.error);
  }, [authChecked]);

  /* section refs */
  const featRef = useFadeIn();
  const howRef = useFadeIn();
  const ctaRef = useFadeIn();
  const socialRef = useFadeIn();

  /* Đang kiểm tra trạng thái đăng nhập — hiện loading nhẹ để tránh flash */
  if (!authChecked) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f0c29, #1a1245, #24243e)',
      }}>
        <div style={{
          width: 40,
          height: 40,
          border: '3px solid rgba(255,255,255,0.15)',
          borderTopColor: '#8b5cf6',
          borderRadius: '50%',
          animation: 'spin .7s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const CATEGORY_EMOJI = { housing: '🏠', food: '🍜', academic: '📚', social: '🎉', general: '💬', safety: '⚠️' };

  return (
    <div className="landing-root">
      {/* ───────── HERO ───────── */}
      <section className="hero">
        {/* animated background blobs */}
        <div className="hero-blob hero-blob--1" />
        <div className="hero-blob hero-blob--2" />
        <div className="hero-blob hero-blob--3" />

        {/* Particle constellation effect */}
        <ParticleBackground variant="constellation" opacity={0.8} particleCount={55} speed={0.6} interactive={true} />

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
              <span>📝</span> Gửi Góp Ý
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

      {/* ───────── SOCIAL PROOF — Community Pulse ───────── */}
      {(communityStats.userCount > 0 || recentActivities.length > 0) && (
        <section ref={socialRef} className="section fade-in-section" style={{ padding: '3rem 0' }}>
          <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 1.5rem' }}>
            {/* Stats Counter */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '2rem',
              flexWrap: 'wrap',
              marginBottom: '2rem',
            }}>
              {[
                { label: 'Sinh viên', value: communityStats.userCount, icon: '👥' },
                { label: 'Bài chia sẻ', value: communityStats.postCount, icon: '📝' },
                { label: 'Địa điểm', value: communityStats.locationCount, icon: '📍' },
              ].map((stat, i) => (
                <div key={i} style={{
                  textAlign: 'center',
                  padding: '1rem 1.5rem',
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: '1rem',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  minWidth: '140px',
                }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{stat.icon}</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    <AnimatedNumber end={stat.value} />
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Recent User Avatars */}
            {recentUsers.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', marginRight: '0.5rem' }}>
                  {recentUsers.slice(0, 6).map((u, i) => (
                    <img
                      key={u.uid}
                      src={u.avatarUrl}
                      alt={u.name}
                      title={u.name}
                      style={{
                        width: 36, height: 36, borderRadius: '50%',
                        border: '2px solid rgba(139,92,246,0.4)',
                        marginLeft: i > 0 ? '-10px' : 0,
                        objectFit: 'cover',
                        zIndex: recentUsers.length - i,
                        position: 'relative',
                      }}
                    />
                  ))}
                </div>
                <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
                  và nhiều sinh viên khác đã tham gia
                </span>
              </div>
            )}

            {/* Live Activity Feed */}
            {recentActivities.length > 0 && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                maxWidth: '500px',
                margin: '0 auto',
              }}>
                {recentActivities.slice(0, 3).map((activity, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    padding: '0.6rem 1rem',
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: '0.75rem',
                    border: '1px solid rgba(255,255,255,0.06)',
                    fontSize: '0.82rem',
                    color: 'rgba(255,255,255,0.75)',
                  }}>
                    <span style={{ fontSize: '1rem' }}>{activity.emoji}</span>
                    <span style={{ flex: 1 }}>
                      <strong style={{ color: 'rgba(255,255,255,0.9)' }}>{activity.userName?.split('@')[0]}</strong>
                      {' '}{activity.action}{' '}
                      {activity.target && <em style={{ color: '#a78bfa' }}>{activity.target}</em>}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>
                      {timeAgoShort(activity.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

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
              icon: '📝',
              color: '#8b5cf6',
              title: 'Góp ý & Phản hồi',
              desc: 'Gửi ý kiến đóng góp và phản hồi trực tuyến để giúp CityZ Kit nâng cấp và phát triển các tính năng ngày một tốt hơn.',
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
      <section ref={ctaRef} className="section fade-in-section cta-section" style={{ position: 'relative', overflow: 'hidden' }}>
        <ParticleBackground variant="firefly" opacity={0.5} particleCount={20} speed={0.4} interactive={false} />
        <div className="cta-content" style={{ position: 'relative', zIndex: 2 }}>
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
              <Link href="/recommend">Gửi Góp Ý</Link>
              <Link href="/blog">Blog</Link>
              <Link href="/guide">📖 Hướng dẫn sử dụng</Link>
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
