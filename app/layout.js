import './styles/globals.css';
import { Inter } from 'next/font/google';
import ToastProvider from '@/components/ToastProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'CityZ Kit - Cộng đồng sinh viên TP.HCM',
  description: 'Nền tảng hỗ trợ tân sinh viên TP.HCM: tìm chỗ ở, ẩm thực, gợi ý thông minh từ AI và kết nối cộng đồng',
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body className={`${inter.className} bg-gray-50`}>
        <ToastProvider />
        {children}
      </body>
    </html>
  );
}
