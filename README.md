# THTB 2026 - Contest Application

Ứng dụng web quản lý và vận hành cuộc thi **"THTB 2026"**, xây dựng bằng React + Vite và Firebase.

## Tổng quan

Hệ thống phục vụ 3 nhóm người dùng:

- `admin`: quản lý đội thi, trận đấu, câu hỏi, điểm số
- `organizer` (ban tổ chức): điều phối trận thi và các phần thi theo thời gian thực
- `team` (đội thi): tham gia phần thi và theo dõi điểm

## Tính năng chính

### 1) Admin

- Quản lý đội thi (`teams`)
- Quản lý trận đấu (`matches`)
- Quản lý bộ câu hỏi (hỗ trợ nhập từ Excel)
- Quản lý và theo dõi điểm số

### 2) Ban tổ chức (Organizer)

- Theo dõi danh sách trận đấu
- Điều khiển màn hình cuộc thi theo từng phần
- Mở bảng điểm toàn màn hình / bảng điểm theo từng phần
- Cập nhật diễn biến và điểm theo thời gian thực

### 3) Đội thi (Team)

- Vào trận thi được phân công
- Chọn phần thi theo luồng cuộc thi
- Tham gia làm bài ở các phần khả dụng
- Xem điểm và trạng thái thi

## Các phần thi

- `Tiên phong`: gói câu hỏi trả lời nhanh theo thời gian
- `Khát vọng`: phần trình bày/chấm điểm sản phẩm
- `Tự hào tiến bước`: vòng thi tăng tốc/xếp hạng với cơ chế mở mảnh ghép

> Luật chi tiết có thể điều chỉnh theo từng mùa thi trong dữ liệu hệ thống.

## Công nghệ sử dụng

- React 19
- Vite 6
- React Router DOM 7
- Firebase Authentication
- Firebase Realtime Database
- Ant Design 5
- Material UI 7
- XLSX

## Cài đặt và chạy local

### Yêu cầu

- Node.js 18+ (khuyến nghị Node.js 20 LTS)
- npm 9+

### Các bước

1. Cài dependencies:

```bash
npm install
```

2. Tạo file `.env` ở thư mục gốc với cấu hình Firebase:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_DATABASE_URL=your_database_url
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

3. Chạy môi trường phát triển:

```bash
npm run dev
```

4. Truy cập ứng dụng tại URL Vite in ra terminal (mặc định thường là `http://localhost:5173`).

## Scripts

- `npm run dev`: chạy development server
- `npm run build`: build production
- `npm run preview`: chạy bản build để kiểm tra local
- `npm run lint`: kiểm tra lint với ESLint

## Điều hướng và phân quyền

- `/login`: đăng nhập
- `/admin/*`: chỉ `admin`
- `/organizer` và các route con `/organizer/contest/...`: chỉ `organizer`
- `/team/*`: chỉ `team`

Vai trò người dùng được đọc từ Realtime Database tại nhánh:

- `users/{uid}/role`

## Cấu trúc thư mục

```text
src/
├── assets/            # Tài nguyên tĩnh
├── contexts/          # Context (AuthContext, ...)
├── database/          # Dữ liệu mẫu/khởi tạo (nếu có)
├── layouts/           # Layout theo vai trò
├── pages/             # Các màn hình theo vai trò
├── services/          # Tích hợp Firebase và services khác
├── styles/            # CSS global/theme
├── utils/             # Hàm tiện ích
├── App.jsx            # Khai báo routes + bảo vệ route
└── main.jsx           # Entry point
```

## Bảo mật

- Xác thực bằng Firebase Auth
- Duy trì phiên đăng nhập theo `browserSessionPersistence`
- Bảo vệ route theo vai trò người dùng

## Build và triển khai

```bash
npm run build
```

Output nằm tại thư mục `dist/`.

## License

MIT
