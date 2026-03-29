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
   - 7 gói câu hỏi tương ứng với 7 đội thi
   - Mỗi gói gồm 10 câu trả lời nhanh
   - Thời gian: 10 giây/câu
   - Đáp án hợp lệ phải kèm từ `chốt`
   - Điểm: đúng +10, sai hoặc quá giờ = 0

2. **Khát vọng**
   - Mỗi đội trình bày sản phẩm trực tuyến đã thiết kế
   - Thời gian trình bày: 5 phút/đội
   - Chấm điểm trực tiếp bởi Ban Giám khảo
   - Cơ cấu điểm:
     - Trực tuyến: 40%
     - Thuyết minh: 60%
   - Tổng điểm quy đổi: 100 điểm

3. **Tự hào tiến bước**
   - 4 đội có tổng điểm phần 1 + phần 2 cao nhất vào thi đấu
   - Có 4 mật ảnh, mỗi mật ảnh gồm 9 mảnh ghép câu hỏi
   - Mỗi mảnh ghép tối đa 2 đội được quyền trả lời
   - Điểm:
     - Trả lời đúng lượt 1: +10
     - Trả lời đúng lượt 2: +5
     - Cả 2 lượt sai: khóa mảnh ghép
   - Trả lời đúng mật ảnh:
     - `(Số mảnh ghép chưa mở × 10) + 50`

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
