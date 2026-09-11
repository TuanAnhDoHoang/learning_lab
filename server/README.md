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

## 🧪 Test End-to-End

### 1. Chạy test route toàn diện

```bash
cargo test --test api -- --nocapture
```

Test này kiểm tra luồng nghiệp vụ thực tế của hệ thống từ lúc tạo admin, tạo bài thi, tạo phòng, người dùng tham gia phòng, bắt đầu làm bài, lưu đáp án, đóng phòng và kiểm tra các API điểm số.

#### Luồng test được thực hiện
- Đăng nhập admin
- Tạo exam và room
- Tạo 3 user test và join phòng
- Bật trạng thái room đang diễn ra
- Tạo `exam_attempt` cho từng user
- Lấy `exam_content` từ response và trích xuất `question_id` / `answer_id`
- Gửi đáp án theo từng câu hỏi
- Gọi API kiểm tra room score và member score
- Xóa room sau khi hoàn tất

> Test này giúp validate các route chính theo hướng end-to-end, phù hợp để kiểm tra logic tích hợp giữa auth, exam, room và scoring.

---

## 📡 API Reference

### Tổng hợp các route hiện có

#### 1) Authentication
- `POST /auth/register` — đăng ký tài khoản mới
- `POST /auth/login` — đăng nhập, trả về access token + refresh token + cookie
- `POST /auth/refresh` — làm mới access/refresh token
- `POST /auth/logout` — revoke refresh token hiện tại

#### 2) Public / external
- `GET /` — check server đang chạy (hello message)
- `GET /api/exams` — lấy danh sách tất cả bài thi

#### 3) Exam / question / score
- `POST /api/new_exam` — tạo bài thi mới (chỉ admin)
- `POST /api/new_exam_by_image` — tạo bài thi mới từ ảnh bằng OCR, nhận multipart gồm `payload` JSON và file ảnh
- `GET /api/questions?exam_id=<id>` — lấy danh sách câu hỏi và đáp án theo exam_id
- `POST /api/score` — chấm điểm bài thi theo payload truyền lên (không khuyên dùng)
- `POST /api/start_exam_attempt` — bắt đầu lượt làm bài, trả về `exam_attempt_id` và nội dung bài thi
- `POST /api/start_exam_attempt_by_room` — bắt đầu lượt làm bài theo phòng thi, đồng bộ với `room_member`
- `POST /api/time_attempt_end` — lấy timestamp hiện tại và thời gian kết thúc bài làm
- `GET /api/attempt?exam_attempt_id=<id>` — lấy danh sách câu hỏi của lượt thi và lựa chọn đáp án gần nhất của user
- `GET /api/score_attempt?exam_attempt_id=<id>` — tính điểm của lượt làm bài (ưu tiên dùng)
- `POST /api/save_user_answer` — lưu lịch sử chọn đáp án của người dùng cho một câu hỏi

#### 4) Room / matchmaking
- `POST /api/create_room` — tạo phòng thi mới với `name`, `exam_id`, `duration`
- `POST /api/start_room` — chuyển phòng sang trạng thái `ongoing` và sinh exam attempt cho tất cả thành viên
- `POST /api/close_room` — đóng phòng thi (`closed`)
- `POST /api/room_scores` — lấy bảng điểm tổng của phòng
- `POST /api/room_member_score` — lấy điểm chi tiết của một member trong phòng
- `POST /api/my_room_score` — lấy điểm của user hiện tại trong phòng
- `POST /api/delete_room` — xóa phòng và tất cả member trong phòng
- `POST /api/join_room` — tham gia phòng bằng `room_code`, chỉ cho phép khi phòng đang `open`
- `POST /api/leave_room` — rời phòng theo `room_code`
- `GET /api/room_by_user` — lấy danh sách `room_id` mà user đang tham gia

#### 5) Admin
- `POST /<ADMIN_ROUTE>/provide_priviliged` — cấp quyền admin cho user khác

> Lưu ý: các route dưới `/api` và `/<ADMIN_ROUTE>` đều đi qua middleware xác thực token, trừ các route public `/auth/register`, `/auth/login`, `/auth/refresh` và `/api/exams`.

### 0. User admin sample
```json
{
  "email":"anhdoo@gmail.com",
  "password":"Anhdoo#1004"
}
```

### 1. Tạo bài kiểm tra mới (Create Exam)

* **Endpoint:** `POST /api/new_exam`
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

* **Endpoint:** `GET /api/exams`

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

* **Endpoint:** `GET /api/questions`
* **Query Parameters:**

| Tham số | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `exam_id` | integer | Có | ID của bài kiểm tra cần lấy câu hỏi |

#### 📥 Example Request:
* **Endpoint:** `GET /api/questions?exam_id=9`
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

* **Endpoint:** `POST /api/score`
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

### 5.Đăng ký tài khoản  

* **Endpoint:** `POST /auth/register`
* **Content-Type:** `application/json`

#### 📥 Example Request Payload:
```json
{
    "email": "anhdoo@gmail.com",
    "username": "anhdoo",
    "password": "Anhdoo#1004",
    "role": "user"
}
```
#### 📤 Response Mẫu:

* **Success (200 OK):**
```json
{
  "userid": 1,
  "username": "anhdoo",
  "email": "anhdoo1211@gmail.com"
}
```

### 6.Đăng nhập tài khoản  

* **Endpoint:** `POST /auth/login`
* **Content-Type:** `application/json`

#### 📥 Example Request Payload:
```json
{
    "email": "anhdoo1211@gmail.com",
    "password": "Anhdoo#1004"
}
```
#### 📤 Response Mẫu:

* **Success (200 OK):**
```json
{
  "userid": 1,
  "username": "anhdoo",
  "email": "anhdoo1211@gmail.com"
}
```

### 7.Refresh token

* **Endpoint:** `POST /auth/refresh`
* **Content-Type:** `application/json`

#### 📥 Example Request Payload:
```json
{
  "refresh_token": "<YOUR_REFRESH_TOKEN>",
}
```
#### 📤 Response Mẫu:

* **Success (200 OK):**
```json
{
  "refresh_token":"<NEW_REFRESH_TOKEN>",
  "access_token": "<NEW_ACCESS_TOKEN>"
}
```

### 8.Provide admin role

* **Endpoint:** `POST /<secret route trong .env>/provide_priviliged`
* **Content-Type:** `application/json`

#### 📥 Example Request Payload:
```json
{
    "user_id": 2,
}
```
#### 📤 Response Mẫu:

* **Success (200 OK):**
```json
{
  "userid": 2,
  "role": "admin"
}
```

### 9.Logout

* **Endpoint:** `POST /auth/logout`
* **Content-Type:** `application/json`

#### 📥 Example Request Payload:
```json
{
  "refresh_token": "<YOUR REFRESH TOKEN>"
}
```
#### 📤 Response Mẫu:

* **Success (204 No Content):**

---

### 10. Bắt đầu làm bài kiểm tra

* **Endpoint:** `POST /api/start_exam_attempt`
* **Content-Type:** `application/json`

#### 📥 Example Request Payload:
```json
{
  "exam_id": 9
}
```

#### 📤 Response Mẫu:
```json
{
  "exam_attempt_id": 5
}
```

---

### 11. Lấy thời gian kết thúc bài làm

* **Endpoint:** `POST /api/time_attempt_end`
* **Content-Type:** `application/json`

#### 📥 Example Request Payload:
```json
{
  "exam_attempt_id": 5
}
```

#### 📤 Response Mẫu:
```json
{
  "now": 1723804800,
  "time_end": 1723808400
}
```

---

### 12. Lấy câu hỏi hiện tại của lượt thi

* **Endpoint:** `GET /api/attempt?exam_attempt_id=5`

#### 📤 Response Mẫu:
```json
{
  "question": "Trong Diesel, hàm nào dùng để mở một Transaction?",
  "answers": [
    "conn.start_transaction()",
    "conn.transaction()",
    "conn.begin()",
    "conn.execute_transaction()"
  ],
  "user_answer": 2
}
```

---

### 13. Chấm điểm lượt làm bài

* **Endpoint:** `GET /api/score_attempt?exam_attempt_id=5`

#### 📤 Response Mẫu:
```json
{
  "score": 3,
  "sum_of_question": 10
}
```

---

### 14. Lưu đáp án người dùng

* **Endpoint:** `POST /api/save_user_answer`
* **Content-Type:** `application/json`

#### 📥 Example Request Payload:
```json
{
  "exam_attempt_id": 5,
  "question_id": 11,
  "answer_id": 43
}
```

#### 📤 Response Mẫu:
```json
{
  "time": 1723804920
}
```

---

### 15. Tạo và tham gia phòng thi

#### 15.1. Tạo phòng thi

* **Endpoint:** `POST /api/create_room`
* **Content-Type:** `application/json`

#### 📥 Example Request Payload:
```json
{
  "name": "PhongRust01",
  "exam_id": 9,
  "duration": 15
}
```

#### 📤 Response Mẫu:
```json
{
  "room_id": 3,
  "room_code": "ROOM-1-123456"
}
```

#### 15.2. Tham gia phòng theo mã phòng

* **Endpoint:** `POST /api/join_room`
* **Content-Type:** `application/json`

#### 📥 Example Request Payload:
```json
{
  "room_code": "ROOM-1-123456"
}
```

#### 📤 Response Mẫu:
```json
{
  "room_id": 3
}
```

> Chỉ cho phép join khi phòng đang ở trạng thái `open`. Nếu phòng đã bắt đầu hoặc đóng, API sẽ trả về lỗi `BAD_REQUEST`.

#### 15.3. Rời phòng

* **Endpoint:** `POST /api/leave_room`
* **Content-Type:** `application/json`

#### 📥 Example Request Payload:
```json
{
  "room_code": "ROOM-1-123456"
}
```

#### 📤 Response Mẫu:
```json
{
  "room_id": 3
}
```

#### 15.4. Lấy danh sách phòng của user

* **Endpoint:** `GET /api/room_by_user`

#### 📤 Response Mẫu:
```json
{
  "room_ids": [3, 8, 12]
}
```

#### 15.5. Bắt đầu lượt thi trong phòng

* **Endpoint:** `POST /api/start_exam_attempt_by_room`
* **Content-Type:** `application/json`

#### 📥 Example Request Payload:
```json
{
  "room_id": 3
}
```

#### 📤 Response Mẫu:
```json
{
  "exam_attempt_id": 12,
  "exam_content": {
    "exam_id": 9,
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
          }
        ]
      }
    ]
  }
}
```

> Khi gọi API này, bạn sẽ nhận trực tiếp `exam_content`, từ đó có thể lấy `question_id` và `answer_id` tương ứng để lưu đáp án.

#### 15.6. Lấy bảng điểm của phòng

* **Endpoint:** `POST /api/room_scores`
* **Content-Type:** `application/json`

#### 📥 Example Request Payload:
```json
{
  "room_id": 3
}
```

#### 📤 Response Mẫu:
```json
{
  "room_id": 3,
  "members": [
    {
      "user_id": 2,
      "score": {
        "score": 2,
        "sum_of_question": 2,
        "question_no_answer": []
      }
    },
    {
      "user_id": 5,
      "score": {
        "score": 1,
        "sum_of_question": 2,
        "question_no_answer": []
      }
    }
  ]
}
```

#### 15.7. Lấy điểm chi tiết của một user trong phòng

* **Endpoint:** `POST /api/room_member_score`
* **Content-Type:** `application/json`

#### 📥 Example Request Payload:
```json
{
  "room_id": 3,
  "user_id": 2
}
```

#### 📤 Response Mẫu:
```json
{
  "user_id": 2,
  "score": {
    "score": 2,
    "sum_of_question": 2,
    "question_no_answer": []
  }
}
```

#### 15.8. Lấy điểm của chính user hiện tại trong phòng

* **Endpoint:** `POST /api/my_room_score`
* **Content-Type:** `application/json`

#### 📥 Example Request Payload:
```json
{
  "room_id": 3
}
```

#### 📤 Response Mẫu:
```json
{
  "user_id": 2,
  "score": {
    "score": 2,
    "sum_of_question": 2,
    "question_no_answer": []
  }
}
```

---
