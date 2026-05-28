'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function InAppBrowserBarrier() {
  const [inAppType, setInAppType] = useState(null); // 'zalo', 'facebook', 'instagram', 'generic' or null
  const [isAndroid, setIsAndroid] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setMounted(true);
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    const lowerUA = ua.toLowerCase();

    const zalo = /zalo/i.test(lowerUA);
    const fb = /fban|fbav/i.test(lowerUA);
    const instagram = /instagram/i.test(lowerUA);

    const android = /android/i.test(lowerUA);
    const ios = /iphone|ipad|ipod/i.test(lowerUA);

    setIsAndroid(android);
    setIsIOS(ios);

    if (zalo) {
      setInAppType('zalo');
    } else if (fb) {
      setInAppType('facebook');
    } else if (instagram) {
      setInAppType('instagram');
    } else if (
      /webview|wv|ipod|iphone|ipad/i.test(lowerUA) &&
      !/safari/i.test(lowerUA) &&
      (ios || android)
    ) {
      // Bắt các webview chung khác có thể chặn Google OAuth
      setInAppType('generic');
    }

    // Android: Tự động chuyển hướng sang Google Chrome
    if ((zalo || fb || instagram) && android) {
      const cleanUrl = window.location.href.replace(/https?:\/\//, '');
      const intentUrl = `intent://${cleanUrl}#Intent;scheme=https;package=com.android.chrome;end`;
      window.location.href = intentUrl;
    }
  }, []);

  if (!mounted || !inAppType || dismissed) return null;

  const handleCopyLink = () => {
    try {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Đã sao chép liên kết thành công!');
    } catch (err) {
      toast.error('Không thể tự động sao chép. Vui lòng sao chép thủ công.');
    }
  };

  const getAndroidIntentUrl = () => {
    if (typeof window === 'undefined') return '';
    const cleanUrl = window.location.href.replace(/https?:\/\//, '');
    return `intent://${cleanUrl}#Intent;scheme=https;package=com.android.chrome;end`;
  };

  const appNameMap = {
    zalo: 'Zalo',
    facebook: 'Facebook/Messenger',
    instagram: 'Instagram',
    generic: 'trình duyệt nhúng',
  };

  const appName = appNameMap[inAppType] || 'trình duyệt nhúng';

  return (
    <div className="fixed inset-0 z-[999999] bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-white overflow-y-auto font-sans">
      {/* iOS Bouncing Arrow Indicator pointing to top right menu */}
      {isIOS && (
        <div className="absolute top-4 right-4 flex flex-col items-end animate-bounce z-[1000000]">
          <svg
            className="w-10 h-10 text-blue-400 rotate-[315deg]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              d="M14 5l7 7m0 0l-7 7m7-7H3"
            ></path>
          </svg>
          <span className="text-xs bg-blue-500/90 px-3 py-1 rounded-full text-white font-semibold mt-1 backdrop-blur-sm border border-blue-400/30 shadow-lg">
            Bấm nút menu ... ở đây
          </span>
        </div>
      )}

      {/* Main Glassmorphism Card */}
      <div className="max-w-md w-full bg-white/10 border border-white/20 rounded-3xl p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
        {/* Decorative background glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl"></div>

        <div className="relative flex flex-col items-center text-center">
          {/* Warning Icon */}
          <div className="w-16 h-16 bg-amber-500/20 border border-amber-500/30 rounded-2xl flex items-center justify-center mb-6 animate-pulse">
            <svg
              className="w-8 h-8 text-amber-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              ></path>
            </svg>
          </div>

          <h2 className="text-2xl font-bold tracking-tight mb-2 text-white">
            Mở bằng trình duyệt ngoài
          </h2>
          <p className="text-gray-300 text-sm mb-6 leading-relaxed">
            Bạn đang truy cập CityZ Kit qua trình duyệt nhúng của{' '}
            <span className="font-semibold text-white underline decoration-blue-400 decoration-2">
              {appName}
            </span>
            . Để tránh lỗi bảo mật của Google và sử dụng đầy đủ tính năng, vui lòng
            chuyển sang trình duyệt của điện thoại.
          </p>

          {/* Platform Specific Steps */}
          {isIOS ? (
            <div className="w-full text-left space-y-4 mb-6 bg-white/5 border border-white/10 rounded-2xl p-4">
              <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                Hướng dẫn mở trên iOS (iPhone/iPad):
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    1
                  </div>
                  <p className="text-gray-200">
                    Bấm vào biểu tượng ba chấm{' '}
                    <span className="font-extrabold text-white bg-white/10 px-1.5 py-0.5 rounded text-xs">
                      ...
                    </span>{' '}
                    hoặc biểu tượng{' '}
                    <span className="font-bold text-white bg-white/10 px-1.5 py-0.5 rounded text-xs">
                      Chia sẻ
                    </span>{' '}
                    ở góc màn hình.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    2
                  </div>
                  <p className="text-gray-200">
                    Chọn{' '}
                    <span className="font-bold text-blue-300 bg-blue-500/10 px-1.5 py-0.5 rounded">
                      "Mở bằng trình duyệt"
                    </span>{' '}
                    hoặc{' '}
                    <span className="font-bold text-blue-300 bg-blue-500/10 px-1.5 py-0.5 rounded">
                      "Mở bằng Safari"
                    </span>
                    .
                  </p>
                </div>
              </div>
            </div>
          ) : isAndroid ? (
            <div className="w-full text-left space-y-4 mb-6 bg-white/5 border border-white/10 rounded-2xl p-4">
              <h3 className="text-xs font-bold text-green-400 uppercase tracking-wider">
                Đang chuyển sang Google Chrome...
              </h3>
              <p className="text-sm text-gray-300 leading-relaxed">
                Hệ thống đang mở liên kết này trên Google Chrome. Nếu ứng dụng không tự động chuyển đổi, vui lòng bấm vào nút bên dưới:
              </p>
              <a
                href={getAndroidIntentUrl()}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold py-3 px-4 rounded-xl transition duration-200 shadow-lg shadow-emerald-500/20"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                Mở bằng Google Chrome
              </a>
            </div>
          ) : (
            <div className="w-full text-left space-y-4 mb-6 bg-white/5 border border-white/10 rounded-2xl p-4">
              <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                Hướng dẫn nhanh:
              </h3>
              <p className="text-sm text-gray-200">
                Nhấn vào nút Menu hoặc nút Chia sẻ của ứng dụng bạn đang dùng, chọn{' '}
                <span className="font-bold text-white text-blue-300">
                  "Mở bằng trình duyệt ngoài"
                </span>{' '}
                hoặc{' '}
                <span className="font-bold text-white text-blue-300">
                  "Mở bằng Safari / Chrome"
                </span>
                .
              </p>
            </div>
          )}

            {/* Copy Link Button */}
            <div className="w-full space-y-3">
              <button
                onClick={handleCopyLink}
                className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white border border-white/10 font-medium py-3 px-4 rounded-xl transition duration-200 active:scale-95"
              >
              <svg
                className="w-5 h-5 text-gray-300"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                />
              </svg>
              Sao chép liên kết trang web
            </button>

            <button
              onClick={() => {
                setDismissed(true);
                toast('⚠️ Lưu ý: Một số tính năng như Đăng nhập bằng Google có thể không hoạt động tốt trên trình duyệt này.', { icon: 'ℹ️', duration: 6000 });
              }}
              className="w-full text-center text-xs text-blue-400 font-bold hover:text-blue-300 transition-colors py-2 outline-none mt-1"
            >
              Tiếp tục duyệt bằng trình duyệt này ➔
            </button>

            <div className="text-center text-xs text-gray-400 pt-1">
              CityZ Kit — Đồng hành cùng sinh viên TP.HCM
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
