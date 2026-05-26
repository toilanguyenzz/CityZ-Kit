# CityZ Kit - Student Toolkit MVP

> Hệ sinh thái hỗ trợ tân sinh viên tại TP.HCM - Đồ án SSG105

## 📌 Giới thiệu

CityZ Kit là nền tảng web giúp sinh viên mới tại TP.HCM:
- 🔍 Khám phá địa điểm (ăn uống, nhà trọ, cafe) được xác thực bởi cộng đồng
- ✍️ Chia sẻ bài viết và bình luận trên Blog cộng đồng
- 🤖 Nhận gợi ý thông minh từ AI dựa trên ngân sách, sở thích và khu vực
- 🏆 Nhận danh hiệu (Badges) khi đóng góp nội dung
- ✅ Xác thực địa điểm "Verified by Student" sau 3 đánh giá

## 🛠️ Tech Stack

- **Frontend**: Next.js 14 (App Router), Tailwind CSS
- **Backend & Database**: Firebase (Auth, Firestore, Storage)
- **AI**: Google Gemini 2.0 Flash (`@google/generative-ai`)
- **Deployment**: Vercel (recommended)

## 📁 Cấu trúc thư mục

```
cityz-kit/
├── app/
│   ├── api/recommend/route.js    # API gọi Gemini
│   ├── dashboard/                 # Trang chính (danh sách địa điểm)
│   ├── add-location/              # Thêm địa điểm mới
│   ├── location/[id]/             # Chi tiết địa điểm + đánh giá
│   ├── blog/                      # Danh sách bài viết
│   ├── blog/create/               # Tạo bài viết mới
│   ├── post/[id]/                 # Chi tiết bài viết + bình luận
│   ├── recommend/                 # Form gợi ý AI
│   ├── profile/                   # Hồ sơ & danh hiệu
│   ├── login/ & signup/           # Xác thực
│   ├── layout.js                  # Root layout (Navbar toàn cục)
│   └── page.js                    # Landing page
├── components/
│   ├── Navbar.js
│   ├── LocationCard.js
│   ├── RatingStars.js
│   ├── CommentSection.js
│   ├── Badge.js
│   └── ProtectedRoute.js
├── lib/
│   ├── firebase.js                # Khởi tạo Firebase
│   └── firestore.js               # CRUD + Logic badges
├── styles/globals.css
├── .env.local                     # Biến môi trường
├── package.json
├── tailwind.config.js
├── postcss.config.js
└── README.md
```

## 🚀 Cài đặt và chạy local

### 1. Clone repository

```bash
git clone <your-repo-url>
cd cityz-kit
```

### 2. Cài đặt dependencies

```bash
npm install
# hoặc
npm install --legacy-peer-deps
```

### 3. Tạo Firebase Project

1. Truy cập [Firebase Console](https://console.firebase.google.com/)
2. Tạo project mới (tên: CityZ Kit)
3. Bật **Authentication** > Sign-in method > Email/Password
4. Tạo **Firestore Database** (chế độ test để MVP)
5. Tạo **Storage** (chế độ test)
6. Vào Project Settings > General > Your apps > Web (</>) → Đăng ký app để lấy config

### 4. Lấy Gemini API Key

1. Truy cập [Google AI Studio](https://aistudio.google.com/)
2. Đăng nhập, nhấn "Get API Key"
3. Tạo key mới (free)

### 5. Cấu hình biến môi trường

Tạo file `.env.local` trong thư mục gốc:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
GOOGLE_GEMINI_API_KEY=your_gemini_api_key_here
```

### 6. Cấu hình Firebase Security Rules (tạm thời cho MVP)

**Firestore Rules:**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

**Storage Rules:**

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 7. Seed dữ liệu mẫu (tùy chọn)

Sau khi chạy app, truy cập trang `/seed` hoặc chạy script dưới đây trong browser console:

```javascript
// Mở console khi đã đăng nhập
fetch('/api/seed').catch(console.log);
```

Hoặc thêm thủ công qua Firebase Console.

### 8. Chạy development server

```bash
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000)

## 🧪 Kiểm thử tính năng

- [ ] Đăng ký / Đăng nhập
- [ ] Xem danh sách địa điểm, lọc theo danh mục
- [ ] Thêm địa điểm mới (upload ảnh)
- [ ] Xem chi tiết, đánh giá sao và comment
- [ ] Xem blog, tạo bài viết mới, comment
- [ ] Gợi ý AI (chọn budget, food type, district)
- [ ] Kiểm tra badge trên Profile sau khi:
    - Thêm 1 location → Explorer
    - Viết 3 review → Helper
    - Tạo 1 post → Influencer
- [ ] Xác thực "Verified by Student" hiển thị khi location có >=3 reviews

## 📦 Build cho production

```bash
npm run build
npm start
```

Hoặc deploy lên Vercel:

```bash
npm i -g vercel
vercel
```

## ⚠️ Lưu ý khi demo

- Gemini API có rate limit giới hạn, không nên spam gọi liên tục
- Ảnh upload lên Firebase Storage cần cấu hình CORS nếu gặp lỗi (chỉ ảnh hưởng khi deploy)
- Trên local, có thể dùng ảnh mẫu URL thay vì upload

## 🧑‍💻 Tác giả

Nhóm SSG105 - CityZ Kit

## 📄 Giấy phép

MIT
