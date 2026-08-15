-- =========================================================
-- Seed data mẫu cho hệ thống thi trắc nghiệm
-- Thứ tự insert: domain -> exam -> question -> answer -> answer_map
-- Lưu ý: chạy sau khi đã `diesel migration run` để tạo schema
-- =========================================================

BEGIN;

-- ---------------------------------------------------------
-- 1. DOMAIN
-- ---------------------------------------------------------
INSERT INTO domain (id, name) VALUES
    (1, 'Toán học'),
    (2, 'Vật lý'),
    (3, 'Hóa học');

-- ---------------------------------------------------------
-- 2. EXAM
-- ---------------------------------------------------------
INSERT INTO exam (id, domain_id, name, duration) VALUES
    (1, 1, 'Kiểm tra 15 phút - Đại số', 15),
    (2, 1, 'Kiểm tra 15 phút - Hình học', 15),
    (3, 2, 'Kiểm tra 15 phút - Cơ học', 15),
    (4, 2, 'Kiểm tra 15 phút - Điện học', 15),
    (5, 3, 'Kiểm tra 15 phút - Hóa vô cơ', 15),
    (6, 3, 'Kiểm tra 15 phút - Hóa hữu cơ', 15);

-- ---------------------------------------------------------
-- 3. QUESTION
-- ---------------------------------------------------------
INSERT INTO question (id, exam_id, content) VALUES
    -- Exam 1: Đại số
    (1, 1, 'Phương trình 2x + 4 = 0 có nghiệm là?'),
    (2, 1, 'Giá trị của biểu thức (3 + 5) x 2 là bao nhiêu?'),
    (3, 1, 'Nếu x = 3 thì x^2 bằng bao nhiêu?'),

    -- Exam 2: Hình học
    (4, 2, 'Tổng ba góc trong một tam giác bằng bao nhiêu độ?'),
    (5, 2, 'Hình vuông có bao nhiêu trục đối xứng?'),
    (6, 2, 'Diện tích hình chữ nhật có chiều dài 5, chiều rộng 3 là bao nhiêu?'),

    -- Exam 3: Cơ học
    (7, 3, 'Đơn vị đo lực trong hệ SI là gì?'),
    (8, 3, 'Công thức tính vận tốc là gì?'),
    (9, 3, 'Trọng lực là lực gì?'),

    -- Exam 4: Điện học
    (10, 4, 'Đơn vị đo cường độ dòng điện là gì?'),
    (11, 4, 'Công thức định luật Ôm là gì?'),
    (12, 4, 'Điện trở có ký hiệu là gì?'),

    -- Exam 5: Hóa vô cơ
    (13, 5, 'Công thức hóa học của nước là gì?'),
    (14, 5, 'Kim loại nào nhẹ nhất?'),
    (15, 5, 'NaCl là hợp chất của nguyên tố nào?'),

    -- Exam 6: Hóa hữu cơ
    (16, 6, 'Công thức hóa học của khí metan là gì?'),
    (17, 6, 'Rượu etylic có công thức hóa học là gì?'),
    (18, 6, 'Chất nào sau đây là hydrocacbon no?');

-- ---------------------------------------------------------
-- 4. ANSWER (mỗi câu hỏi có 4 đáp án)
-- ---------------------------------------------------------
INSERT INTO answer (id, question_id, content) VALUES
    -- Q1
    (1, 1, 'x = -2'),
    (2, 1, 'x = 2'),
    (3, 1, 'x = 0'),
    (4, 1, 'x = 4'),
    -- Q2
    (5, 2, '16'),
    (6, 2, '13'),
    (7, 2, '10'),
    (8, 2, '8'),
    -- Q3
    (9, 3, '6'),
    (10, 3, '9'),
    (11, 3, '3'),
    (12, 3, '12'),
    -- Q4
    (13, 4, '90 độ'),
    (14, 4, '180 độ'),
    (15, 4, '360 độ'),
    (16, 4, '270 độ'),
    -- Q5
    (17, 5, '2'),
    (18, 5, '4'),
    (19, 5, '1'),
    (20, 5, '0'),
    -- Q6
    (21, 6, '15'),
    (22, 6, '8'),
    (23, 6, '10'),
    (24, 6, '20'),
    -- Q7
    (25, 7, 'Newton (N)'),
    (26, 7, 'Joule (J)'),
    (27, 7, 'Watt (W)'),
    (28, 7, 'Pascal (Pa)'),
    -- Q8
    (29, 8, 'v = s / t'),
    (30, 8, 'v = s x t'),
    (31, 8, 'v = t / s'),
    (32, 8, 'v = s + t'),
    -- Q9
    (33, 9, 'Lực hút của Trái Đất'),
    (34, 9, 'Lực đẩy của không khí'),
    (35, 9, 'Lực ma sát'),
    (36, 9, 'Lực đàn hồi'),
    -- Q10
    (37, 10, 'Ampe (A)'),
    (38, 10, 'Volt (V)'),
    (39, 10, 'Ohm (Ω)'),
    (40, 10, 'Watt (W)'),
    -- Q11
    (41, 11, 'I = U / R'),
    (42, 11, 'I = U x R'),
    (43, 11, 'I = R / U'),
    (44, 11, 'I = U + R'),
    -- Q12
    (45, 12, 'R'),
    (46, 12, 'I'),
    (47, 12, 'U'),
    (48, 12, 'P'),
    -- Q13
    (49, 13, 'H2O'),
    (50, 13, 'CO2'),
    (51, 13, 'O2'),
    (52, 13, 'H2O2'),
    -- Q14
    (53, 14, 'Liti (Li)'),
    (54, 14, 'Sắt (Fe)'),
    (55, 14, 'Nhôm (Al)'),
    (56, 14, 'Đồng (Cu)'),
    -- Q15
    (57, 15, 'Natri và Clo'),
    (58, 15, 'Kali và Clo'),
    (59, 15, 'Natri và Oxy'),
    (60, 15, 'Canxi và Clo'),
    -- Q16
    (61, 16, 'CH4'),
    (62, 16, 'C2H6'),
    (63, 16, 'C2H4'),
    (64, 16, 'C2H2'),
    -- Q17
    (65, 17, 'C2H5OH'),
    (66, 17, 'CH3OH'),
    (67, 17, 'C2H4O2'),
    (68, 17, 'C3H7OH'),
    -- Q18
    (69, 18, 'Metan (CH4)'),
    (70, 18, 'Etilen (C2H4)'),
    (71, 18, 'Axetilen (C2H2)'),
    (72, 18, 'Benzen (C6H6)');

-- ---------------------------------------------------------
-- 5. ANSWER_MAP (đáp án đúng cho mỗi câu hỏi)
-- ---------------------------------------------------------
INSERT INTO answer_map (question_id, answer_id) VALUES
    (1, 1),   -- x = -2
    (2, 5),   -- 16
    (3, 10),  -- 9
    (4, 14),  -- 180 độ
    (5, 18),  -- 4
    (6, 21),  -- 15
    (7, 25),  -- Newton (N)
    (8, 29),  -- v = s / t
    (9, 33),  -- Lực hút của Trái Đất
    (10, 37), -- Ampe (A)
    (11, 41), -- I = U / R
    (12, 45), -- R
    (13, 49), -- H2O
    (14, 53), -- Liti (Li)
    (15, 57), -- Natri và Clo
    (16, 61), -- CH4
    (17, 65), -- C2H5OH
    (18, 69); -- Metan (CH4)


-- ---------------------------------------------------------
-- 6. USERS (Thông tin người dùng)
-- ---------------------------------------------------------
INSERT INTO users (id, email, name, password, role) VALUES
    (1, 'anhdoo1211@gmail.com', 'anhdoo', '$2b$12$13Wi9KoLf5rjyKZiXKQit.l8sAyrmP4JjFoPoi4GaZItEHffEWNES', 'admin'),
    (2, 'user@gmail.com', 'scibidi', '$2b$12$wrR6huHjUvxxCf8aPvgJJejbCsnbZwbmnC/DWWHrmw9axRPhGTFMu', 'user'),
    (3, 'anhdoo@gmail.com', 'anhdoo9090', '$2b$12$oErhlNnbBnXZr.wCBF4dV.xKskcoXbdaolMYGQFgWMwGe0Z4.ydQq', 'admin');

-- ---------------------------------------------------------
-- 7. Đồng bộ lại sequence sau khi insert id thủ công
-- (bắt buộc vì các cột id là SERIAL/auto-increment)
-- ---------------------------------------------------------
SELECT setval(pg_get_serial_sequence('domain', 'id'), (SELECT MAX(id) FROM domain));
SELECT setval(pg_get_serial_sequence('exam', 'id'), (SELECT MAX(id) FROM exam));
SELECT setval(pg_get_serial_sequence('question', 'id'), (SELECT MAX(id) FROM question));
SELECT setval(pg_get_serial_sequence('answer', 'id'), (SELECT MAX(id) FROM answer));
SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT MAX(id) FROM users));

COMMIT;