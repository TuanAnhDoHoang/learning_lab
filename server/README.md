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
{
  "exam_id": 9
}

```
### 2. Lấy danh sách bài kiểm tra (Get All Exams)

* **Endpoint:** `GET /exams`

#### 📤 Response Mẫu:

* **Success (200 OK):**
```json
[
  {
    "id": 1,
    "domain_id": 1,
    "name": "Kiểm tra 15 phút - Đại số"
  },
  {
    "id": 2,
    "domain_id": 1,
    "name": "Kiểm tra 15 phút - Hình học"
  },
  {
    "id": 7,
    "domain_id": 4,
    "name": "Bài thi Kiến thức Rust & Database"
  }
]
```

---

### 3. Lấy câu hỏi theo bài kiểm tra (Get Questions by Exam)

* **Endpoint:** `GET /questions`
* **Query Parameters:**

| Tham số | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `exam_id` | integer | Có | ID của bài kiểm tra cần lấy câu hỏi |

#### 📥 Example Request:
* **Endpoint:** `GET /questions?exam_id=9`
#### 📤 Response Mẫu:

* **Success (200 OK):**
```json
{
  "questions": [
    {
      "question": {
        "id": 23,
        "exam_id": 9,
        "content": "Trong Diesel, hàm nào dùng để mở một Transaction?"
      },
      "answers": [
        {
          "id": 89,
          "question_id": 23,
          "content": "conn.start_transaction()"
        },
        {
          "id": 90,
          "question_id": 23,
          "content": "conn.transaction()"
        },
        {
          "id": 91,
          "question_id": 23,
          "content": "conn.begin()"
        },
        {
          "id": 92,
          "question_id": 23,
          "content": "conn.execute_transaction()"
        }
      ]
    },
    {
      "question": {
        "id": 24,
        "exam_id": 9,
        "content": "Từ khóa nào trong SQL được dùng để xóa bảng?"
      },
      "answers": [
        {
          "id": 93,
          "question_id": 24,
          "content": "DELETE TABLE"
        },
        {
          "id": 94,
          "question_id": 24,
          "content": "REMOVE TABLE"
        },
        {
          "id": 95,
          "question_id": 24,
          "content": "DROP TABLE"
        },
        {
          "id": 96,
          "question_id": 24,
          "content": "CLEAR TABLE"
        }
      ]
    }
  ]
}
```

---

### 4. Chấm điểm bài làm (Submit & Score Exam)

* **Endpoint:** `POST /score`
* **Content-Type:** `application/json`

#### 📥 Example Request Payload:
```json
{
  "exam_id": 9,
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
{
  "score": 2,
  "sum_of_question": 2
}
```