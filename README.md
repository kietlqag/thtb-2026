# Người là niềm tin tất thắng - Contest Application

Ứng dụng web quản lý cuộc thi "Người là niềm tin tất thắng" được xây dựng bằng React và Firebase.

## 🚀 Tính năng

### 👥 Ba vai trò chính:

1. **Admin**
   - Quản lý trận đấu (CRUD)
   - Quản lý đội thi (CRUD)
   - Nhập câu hỏi qua Excel
   - Quản lý điểm số

2. **Ban Tổ Chức**
   - Quản lý trận đấu
   - Điều khiển các phần thi
   - Cập nhật điểm số
   - Xem bảng điểm

3. **Đội Thi**
   - Chọn trận đấu
   - Tham gia các phần thi
   - Xem điểm số

### 🎯 Các phần thi:

1. **Tiên phong**
   - 4 bộ câu hỏi (8 câu/bộ)
   - Thời gian trả lời: 10 giây
   - Điểm: Số câu trả lời đúng

2. **Khát vọng**
   - 10 câu hỏi
   - Thời gian: 60 giây/câu
   - Điểm theo thứ tự trả lời đúng

3. **Tự hào tiến bước**
   - 4 bộ câu hỏi (3x3 grid)
   - Thời gian: 5 giây buzz in, 15 giây trả lời
   - Điểm: 10 điểm/câu đúng
   - Bonus: Đoán hình ảnh

## 🛠️ Công nghệ sử dụng

- React (Vite)
- Firebase Authentication
- Firebase Realtime Database
- Ant Design
- Material-UI

## 📦 Cài đặt

1. Clone repository:
```bash
git clone [repository-url]
```

2. Cài đặt dependencies:
```bash
npm install
```

3. Tạo file `.env` và cấu hình Firebase:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_DATABASE_URL=your_database_url
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

4. Chạy ứng dụng:
```bash
npm run dev
```

## 📁 Cấu trúc thư mục

```
src/
├── assets/                 # Tài nguyên tĩnh
├── components/            # Components tái sử dụng
├── contexts/             # React Context
├── hooks/               # Custom hooks
├── layouts/            # Layout components
├── pages/             # Các trang chính
├── services/         # Firebase services
├── styles/          # Global styles
└── utils/          # Utility functions
```

## 🔒 Bảo mật

- Xác thực người dùng qua Firebase Auth
- Phân quyền dựa trên vai trò
- Bảo vệ routes theo vai trò

## 🎨 Giao diện

- Responsive design (16:9)
- Theme màu xanh dương
- Hỗ trợ tùy chỉnh theme
- Font chữ tùy chỉnh

## 📝 License

MIT 
