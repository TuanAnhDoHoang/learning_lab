---

# 📚 Exam Management Service (Axum + Diesel + PostgreSQL)

Dịch vụ backend RESTful API phục vụ quản lý bài thi, lĩnh vực (domain), câu hỏi và đáp án. Được xây dựng bằng ngôn ngữ **Rust**, framework **Axum**, ORM **Diesel** và chạy trên môi trường **Docker Compose**.

---

## 🛠️ Công nghệ sử dụng (Tech Stack)

* **Language:** Rust (Edition 2021/2024)
* **Web Framework:** Axum
* **Database & ORM:** PostgreSQL, Diesel ORM
* **Runtime:** Tokio Async Framework
* **Containerization:** Docker & Docker Compose

---

## 🚀 Hướng dẫn khởi chạy

### 1. Khởi động chương trình

Lệnh bên dưới sẽ tự động build image, khởi chạy container PostgreSQL và dịch vụ backend:

```bash
docker compose up --build

```

### 2. Tắt chương trình & Dọn dẹp dữ liệu

Để dừng tất cả các dịch vụ và xóa toàn bộ volumes (dữ liệu DB tạm):

```bash
docker compose down -v

```

---

## 📡 API Reference

### 1. Tạo bài kiểm tra mới (Create Exam)

* **Endpoint:** `POST /new_exam`
* **Content-Type:** `application/json`

#### 📥 Example Request Payload:

```json
{
  "exam_name": "Bài thi Kiến thức Rust & Database",
  "domain": "Lập trình Backend",
  "questions": [
    {
      "question": "Trong Diesel, hàm nào dùng để mở một Transaction?",
      "answers": [
        "conn.start_transaction()",
        "conn.transaction()",
        "conn.begin()",
        "conn.execute_transaction()"
      ],
      "right_answer": 1
    },
    {
      "question": "Từ khóa nào trong SQL được dùng để xóa bảng?",
      "answers": [
        "DELETE TABLE",
        "REMOVE TABLE",
        "DROP TABLE",
        "CLEAR TABLE"
      ],
      "right_answer": 2
    }
  ]
}

```

#### 📤 Response Mẫu:

* **Success (200 OK):**
```json
"Exam created successfully!"

```


* **Error (400 Bad Request / 500 Internal Error):**
```json
"Transaction failed! All changes rolled back. Error: Invalid right_answer index in request payload"

```