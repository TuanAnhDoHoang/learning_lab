# Learning Lab

Learning Lab là một hệ thống hỗ trợ quản lý và tổ chức bài kiểm tra trực tuyến, tập trung vào việc tạo đề, tổ chức phòng thi và theo dõi kết quả làm bài một cách thuận tiện.

## Tổng quan dự án

Hệ thống cho phép người dùng:
- Đăng ký và đăng nhập vào tài khoản
- Tạo, chỉnh sửa và xóa đề thi
- Tìm kiếm đề thi theo danh mục và tên
- Tham gia phòng thi bằng mã phòng
- Làm bài kiểm tra theo từng câu hỏi
- Lưu lại câu trả lời và xem kết quả sau khi hoàn thành
- Theo dõi bảng điểm theo phòng và theo từng người tham gia
- Quản lý hoạt động thi và đề bài từ vai trò quản trị

Dự án phù hợp cho các hoạt động học tập, kiểm tra kiến thức, đánh giá năng lực và tổ chức thi trực tuyến trong môi trường giáo dục hoặc đào tạo.

## Các chức năng đã hoàn thiện

### 1. Quản lý tài khoản
- Đăng ký tài khoản mới
- Đăng nhập vào hệ thống
- Đăng xuất tài khoản
- Phân quyền quản trị và người dùng thông thường

### 2. Quản lý đề thi
- Tạo đề thi mới
- Cập nhật thông tin đề thi
- Xóa đề thi không còn sử dụng
- Xem danh sách đề thi
- Lọc và tìm kiếm đề thi theo tên và lĩnh vực

### 3. Quản lý câu hỏi và đáp án
- Thêm câu hỏi cho từng đề thi
- Cung cấp danh sách đáp án cho từng câu hỏi
- Lưu lựa chọn của người làm bài
- Tạo đề thi từ hình ảnh bằng hỗ trợ nhận dạng nội dung

### 4. Làm bài thi
- Bắt đầu lượt làm bài
- Hiển thị từng câu hỏi theo từng phần
- Lưu đáp án đã chọn
- Xem thời gian làm bài và trạng thái bài thi

### 5. Chấm điểm và báo cáo
- Tính điểm cho từng lượt làm bài
- Xem kết quả của từng người tham gia
- Xem điểm tổng theo phòng thi
- So sánh kết quả giữa các thành viên trong cùng phòng

### 6. Phòng thi trực tuyến
- Tạo phòng thi mới
- Mời người tham gia bằng mã phòng
- Bật và kết thúc phòng thi
- Theo dõi danh sách người trong phòng
- Quản lý tiến độ và điểm số trong buổi thi

### 7. Quản lý vận hành
- Theo dõi hoạt động thi từ phía quản trị
- Quản lý đề thi và phòng thi trên hệ thống
- Điều phối quá trình kiểm tra và đánh giá

## Cấu trúc dự án

- app/: giao diện người dùng
- server/: phần xử lý dữ liệu và API của hệ thống
- docker-compose.yml: cấu hình chạy các dịch vụ chính
- .github/workflows/ci.yml: kiểm tra tự động khi có thay đổi

## Cách chạy dự án

### Sử dụng Docker Compose
```bash
docker compose up --build
```

### Dừng dịch vụ
```bash
docker compose down -v
```
