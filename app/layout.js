import './styles/globals.css';
import 'leaflet/dist/leaflet.css';
import { Inter } from 'next/font/google';
import ToastProvider from '@/components/ToastProvider';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'CityZ Kit - Cộng đồng sinh viên TP.HCM',
  description: 'Nền tảng hỗ trợ tân sinh viên TP.HCM: tìm chỗ ở, ẩm thực, gợi ý thông minh từ AI và kết nối cộng đồng',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'CityZ',
  },
};

export const viewport = {
  themeColor: '#4f46e5',
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body className={`${inter.className} bg-gray-50`}>
        <ToastProvider />
        {children}
        <Analytics />
        <SpeedInsights />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(reg) {
                      console.log('Service Worker registered successfully:', reg.scope);
                    },
                    function(err) {
                      console.warn('Service Worker registration failed:', err);
                    }
                  );
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
