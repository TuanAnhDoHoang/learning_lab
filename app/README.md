# Lab Train — Frontend App

Ứng dụng web giao diện người dùng cho hệ thống thư viện đề thi thông minh **Lab Train**, được xây dựng bằng **React**, **TypeScript**, **Vite** và **Vanilla CSS**.

---

## 🚀 Công nghệ sử dụng

- **Core Framework:** React 18 + TypeScript 5
- **Build Tool:** Vite 5
- **Styling:** Vanilla CSS (CSS Variables hỗ trợ Dark/Light Theme)
- **Production Server:** Nginx (Multi-stage Docker build)
- **Containerization:** Docker & Docker Compose

---

## 📁 Cấu trúc thư mục

```text
app/
├── public/                 # Static assets
├── src/
│   ├── api/                # API service layer (apicaller.ts)
│   ├── components/         # Reusable UI components
│   │   ├── CategoryFilters.tsx
│   │   ├── ExamCard.tsx
│   │   ├── ExamModal.tsx
│   │   ├── Footer.tsx
│   │   ├── Navbar.tsx
│   │   ├── PageHeader.tsx
│   │   ├── SearchBar.tsx
│   │   ├── Sidebar.tsx
│   │   ├── SubTabs.tsx
│   │   └── ThemeToggle.tsx
│   ├── context/            # React Context (ThemeContext.tsx)
│   ├── page/               # Các màn hình chính
│   │   ├── App.tsx         # Trang chủ & Quản lý điều hướng chính
│   │   ├── exampage.tsx    # Màn hình làm bài thi
│   │   ├── loginpage.tsx   # Màn hình đăng nhập
│   │   └── registerpage.tsx# Màn hình đăng ký
│   ├── style/              # CSS Design Tokens & Global Styles (index.css)
│   ├── index.ts            # TypeScript Interfaces & Types
│   └── main.tsx            # Entry point của ứng dụng
├── Dockerfile              # Multi-stage build (Node.js -> Nginx)
├── docker-compose.yml      # Orchestration cho Frontend container
├── nginx.conf              # Cấu hình Nginx + Reverse Proxy API
├── package.json
└── vite.config.ts          # Cấu hình Vite + Dev Proxy
```

---

## ✨ Tính năng chính

1. **Thư viện đề thi thông minh (Trang chủ)**
   - Lọc đề thi theo lĩnh vực (Toán học, Vật lý, Hóa học...)
   - Tìm kiếm đề thi theo từ khóa thời gian thực
   - Xem chi tiết cấu trúc đề thi qua Modal popup

2. **Màn hình làm bài thi (`exampage.tsx`)**
   - Hiển thị từng câu hỏi một (Single-question view)
   - Đồng hồ đếm ngược 15 phút (tự động đổi màu cảnh báo khi còn dưới 1 phút, tự động nộp bài khi hết giờ)
   - Khung danh sách câu hỏi bên phải (Grid navigator) đánh dấu trạng thái *Đang xem*, *Đã trả lời*, *Chưa trả lời*
   - Chấm điểm tự động via Backend API `POST /api/score` và hiển thị kết quả trực quan

3. **Giao diện Authentication (`loginpage.tsx` & `registerpage.tsx`)**
   - Form Đăng nhập & Đăng ký tối giản, hiện đại
   - Nút ẩn/hiện mật khẩu sử dụng SVG icons tối giản
   - Thanh đo độ mạnh mật khẩu 5 cấp độ (Password Strength Meter) khi đăng ký
   - Chuyển đổi linh hoạt giữa Login ↔ Register ↔ Home

4. **Hệ thống Theme Tối/Sáng (Dark/Light Mode)**
   - Mặc định là **Light Mode**
   - Nút đổi Theme dạng Floating Action Button cố định góc dưới bên phải màn hình

---

## 🛠️ Hướng dẫn Chạy ứng dụng

### 1. Chạy trên môi trường Development (Máy cục bộ)

Yêu cầu: Đã cài đặt **Node.js (>= 18)** và Backend Server đang chạy tại `http://127.0.0.1:3000`.

```bash
# Cài đặt các phụ thuộc
npm install

# Khởi chạy Dev Server (Vite)
npm run dev
```

Ứng dụng sẽ chạy tại **`http://localhost:5173`**.
Các request bắt đầu bằng `/api/*` sẽ tự động được Vite proxy tới `http://127.0.0.1:3000`.

---

### 2. Chạy trên môi trường Docker (Production Stack)

Yêu cầu: Đã tạo Docker Network chung `learning-lab-net`.

```bash
# 1. Tạo Docker Network (nếu chưa có)
docker network create learning-lab-net

# 2. Khởi chạy Backend container trước (trong thư mục /server)
cd ../server
docker compose up -d --build

# 3. Khởi chạy Frontend container (trong thư mục /app)
cd ../app
docker compose up -d --build
```

Container Frontend sẽ được Nginx serve ở cổng **5173** (`http://localhost:5173`). Nginx sẽ đóng vai trò Reverse Proxy chuyển tiếp các request `/api/` tới container `server:3000` thông qua Docker internal DNS (`127.0.0.11`).

---

## 📜 Các lệnh Script khả dụng

- `npm run dev`: Chạy ứng dụng ở chế độ phát triển
- `npm run build`: Kiểm tra lỗi TypeScript & Đóng gói sản phẩm cho môi trường Production (`dist/`)
- `npm run preview`: Xem trước bản build Production ở máy cục bộ
