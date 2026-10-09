# Kiến thức Toán học cơ bản

Tài liệu này tổng hợp kiến thức toán học nền tảng, được viết theo từng mục độc lập (mỗi mục nêu rõ chủ đề) để phù hợp với việc nạp vào cơ sở tri thức và truy xuất bằng RAG.

---

## 1. Số học

### 1.1 Các tập hợp số
- Số tự nhiên (N): 0, 1, 2, 3, ...
- Số nguyên (Z): ..., -2, -1, 0, 1, 2, ...
- Số hữu tỉ (Q): số viết được dưới dạng a/b với a, b nguyên và b khác 0.
- Số vô tỉ: số không viết được dưới dạng phân số, ví dụ căn bậc hai của 2, số pi.
- Số thực (R): gồm toàn bộ số hữu tỉ và số vô tỉ.
- Quan hệ bao hàm: N nằm trong Z, Z nằm trong Q, Q nằm trong R.

### 1.2 Tính chia hết
- Một số chia hết cho 2 nếu chữ số tận cùng là số chẵn (0, 2, 4, 6, 8).
- Một số chia hết cho 3 nếu tổng các chữ số chia hết cho 3.
- Một số chia hết cho 5 nếu chữ số tận cùng là 0 hoặc 5.
- Một số chia hết cho 9 nếu tổng các chữ số chia hết cho 9.
- Một số chia hết cho 4 nếu hai chữ số cuối tạo thành số chia hết cho 4.

### 1.3 Số nguyên tố, ƯCLN và BCNN
- Số nguyên tố là số tự nhiên lớn hơn 1 chỉ có đúng hai ước là 1 và chính nó. Ví dụ: 2, 3, 5, 7, 11, 13.
- Số 2 là số nguyên tố chẵn duy nhất.
- Phân tích ra thừa số nguyên tố: mọi số tự nhiên lớn hơn 1 đều phân tích được duy nhất thành tích các số nguyên tố. Ví dụ: 60 = 2^2 x 3 x 5.
- ƯCLN (ước chung lớn nhất) của hai số là số lớn nhất chia hết cả hai số.
- BCNN (bội chung nhỏ nhất) của hai số là số nhỏ nhất chia hết cho cả hai số.
- Công thức liên hệ: ƯCLN(a, b) x BCNN(a, b) = a x b.
- Thuật toán Euclid tìm ƯCLN: chia a cho b lấy dư r, rồi thay (a, b) bằng (b, r), lặp lại đến khi dư bằng 0; số chia cuối cùng là ƯCLN.

### 1.4 Phân số, tỉ lệ và phần trăm
- Cộng hai phân số cùng mẫu: a/c + b/c = (a + b)/c.
- Cộng hai phân số khác mẫu: quy đồng mẫu số rồi cộng.
- Nhân phân số: (a/b) x (c/d) = (a x c)/(b x d).
- Chia phân số: (a/b) : (c/d) = (a/b) x (d/c).
- Phần trăm: p% của số A bằng A x p / 100.
- Tỉ lệ thuận: y = k x x, khi x tăng gấp đôi thì y tăng gấp đôi.
- Tỉ lệ nghịch: y = k / x, khi x tăng gấp đôi thì y giảm một nửa.

### 1.5 Lũy thừa và căn
- a^m x a^n = a^(m+n).
- a^m : a^n = a^(m-n) (với a khác 0).
- (a^m)^n = a^(m x n).
- a^0 = 1 (với a khác 0).
- a^(-n) = 1 / a^n.
- Căn bậc hai của a (a >= 0) là số không âm x sao cho x^2 = a.

---

## 2. Đại số

### 2.1 Hằng đẳng thức đáng nhớ
- (a + b)^2 = a^2 + 2ab + b^2
- (a - b)^2 = a^2 - 2ab + b^2
- a^2 - b^2 = (a - b)(a + b)
- (a + b)^3 = a^3 + 3a^2b + 3ab^2 + b^3
- (a - b)^3 = a^3 - 3a^2b + 3ab^2 - b^3
- a^3 + b^3 = (a + b)(a^2 - ab + b^2)
- a^3 - b^3 = (a - b)(a^2 + ab + b^2)

### 2.2 Phương trình bậc nhất một ẩn
- Dạng: ax + b = 0 (a khác 0).
- Nghiệm: x = -b / a.
- Ví dụ: 2x + 6 = 0 cho x = -3.

### 2.3 Phương trình bậc hai
- Dạng: ax^2 + bx + c = 0 (a khác 0).
- Biệt thức: Delta = b^2 - 4ac.
- Nếu Delta > 0: phương trình có hai nghiệm phân biệt x1 = (-b + căn Delta) / (2a) và x2 = (-b - căn Delta) / (2a).
- Nếu Delta = 0: phương trình có nghiệm kép x = -b / (2a).
- Nếu Delta < 0: phương trình vô nghiệm trong tập số thực.
- Định lý Vi-ét: nếu x1, x2 là hai nghiệm thì x1 + x2 = -b / a và x1 x x2 = c / a.
- Ví dụ: x^2 - 5x + 6 = 0 có Delta = 1, hai nghiệm x = 2 và x = 3.

### 2.4 Hệ phương trình bậc nhất hai ẩn
- Phương pháp thế: rút một ẩn từ phương trình này rồi thế vào phương trình kia.
- Phương pháp cộng đại số: nhân các vế để hệ số của một ẩn đối nhau, sau đó cộng hai phương trình.
- Hệ có thể có một nghiệm duy nhất, vô nghiệm, hoặc vô số nghiệm.

### 2.5 Bất đẳng thức
- Khi nhân hoặc chia cả hai vế của bất đẳng thức với một số âm, chiều bất đẳng thức đổi ngược lại.
- Bất đẳng thức Cauchy (AM-GM) cho hai số không âm: (a + b) / 2 >= căn(a x b), dấu bằng xảy ra khi a = b.

### 2.6 Hàm số và đồ thị
- Hàm số bậc nhất: y = ax + b. Đồ thị là đường thẳng; a là hệ số góc, b là tung độ gốc. Hàm đồng biến khi a > 0, nghịch biến khi a < 0.
- Hàm số bậc hai: y = ax^2 + bx + c. Đồ thị là parabol với đỉnh có hoành độ x = -b / (2a). Parabol quay lên khi a > 0 và quay xuống khi a < 0.

### 2.7 Cấp số cộng và cấp số nhân
- Cấp số cộng: mỗi số hạng bằng số hạng trước cộng công sai d. Số hạng tổng quát: u_n = u_1 + (n - 1)d. Tổng n số hạng đầu: S_n = n x (u_1 + u_n) / 2.
- Cấp số nhân: mỗi số hạng bằng số hạng trước nhân công bội q. Số hạng tổng quát: u_n = u_1 x q^(n-1). Tổng n số hạng đầu (q khác 1): S_n = u_1 x (1 - q^n) / (1 - q).

---

## 3. Hình học

### 3.1 Hình phẳng: chu vi và diện tích
- Hình vuông cạnh a: chu vi 4a, diện tích a^2.
- Hình chữ nhật dài a, rộng b: chu vi 2(a + b), diện tích a x b.
- Hình tam giác đáy a, chiều cao h: diện tích = (1/2) x a x h.
- Hình bình hành đáy a, chiều cao h: diện tích = a x h.
- Hình thang hai đáy a, b, chiều cao h: diện tích = (a + b) x h / 2.
- Hình tròn bán kính r: chu vi = 2 x pi x r, diện tích = pi x r^2 (pi xấp xỉ 3,14159).

### 3.2 Định lý Pythagore
- Trong tam giác vuông, bình phương cạnh huyền bằng tổng bình phương hai cạnh góc vuông: c^2 = a^2 + b^2.
- Ví dụ: tam giác vuông có hai cạnh góc vuông 3 và 4 thì cạnh huyền bằng 5.
- Định lý đảo: nếu một tam giác có c^2 = a^2 + b^2 thì tam giác đó vuông tại đỉnh đối diện cạnh c.

### 3.3 Tam giác đồng dạng
- Hai tam giác đồng dạng khi các góc tương ứng bằng nhau và các cạnh tương ứng tỉ lệ.
- Các trường hợp đồng dạng: cạnh - cạnh - cạnh, cạnh - góc - cạnh, góc - góc.
- Tỉ số diện tích của hai tam giác đồng dạng bằng bình phương tỉ số đồng dạng.

### 3.4 Tổng các góc
- Tổng ba góc trong một tam giác bằng 180 độ.
- Tổng các góc trong của đa giác n cạnh bằng (n - 2) x 180 độ.
- Hai góc phụ nhau có tổng 90 độ; hai góc bù nhau có tổng 180 độ.

### 3.5 Hình khối: thể tích và diện tích
- Hình hộp chữ nhật (dài a, rộng b, cao c): thể tích a x b x c; diện tích xung quanh 2c(a + b); diện tích toàn phần 2(ab + bc + ca).
- Hình lập phương cạnh a: thể tích a^3; diện tích toàn phần 6a^2.
- Hình trụ (bán kính đáy r, chiều cao h): thể tích pi x r^2 x h; diện tích xung quanh 2 x pi x r x h.
- Hình nón (bán kính đáy r, chiều cao h, đường sinh l): thể tích (1/3) x pi x r^2 x h; diện tích xung quanh pi x r x l.
- Hình cầu bán kính r: thể tích (4/3) x pi x r^3; diện tích mặt cầu 4 x pi x r^2.
- Hình chóp (diện tích đáy S, chiều cao h): thể tích (1/3) x S x h.

---

## 4. Lượng giác

### 4.1 Tỉ số lượng giác trong tam giác vuông
- sin = cạnh đối / cạnh huyền.
- cos = cạnh kề / cạnh huyền.
- tan = cạnh đối / cạnh kề.
- cot = cạnh kề / cạnh đối.
- Ghi nhớ: "Sin đi học, Cos không hư, Tan đoàn kết, Cot kết đoàn".

### 4.2 Giá trị các góc đặc biệt
- 30 độ: sin = 1/2, cos = căn 3 / 2, tan = 1 / căn 3.
- 45 độ: sin = căn 2 / 2, cos = căn 2 / 2, tan = 1.
- 60 độ: sin = căn 3 / 2, cos = 1/2, tan = căn 3.
- 90 độ: sin = 1, cos = 0.

### 4.3 Công thức lượng giác cơ bản
- sin^2(x) + cos^2(x) = 1.
- tan(x) = sin(x) / cos(x).
- sin(2x) = 2 sin(x) cos(x).
- cos(2x) = cos^2(x) - sin^2(x) = 1 - 2 sin^2(x) = 2 cos^2(x) - 1.
- sin(a + b) = sin(a)cos(b) + cos(a)sin(b).
- cos(a + b) = cos(a)cos(b) - sin(a)sin(b).

### 4.4 Định lý hàm số trong tam giác bất kỳ
- Định lý hàm số sin: a / sin(A) = b / sin(B) = c / sin(C) = 2R (R là bán kính đường tròn ngoại tiếp).
- Định lý hàm số cos: a^2 = b^2 + c^2 - 2bc x cos(A).

### 4.5 Đổi đơn vị góc
- 180 độ = pi radian.
- Đổi độ sang radian: nhân với pi / 180.
- Đổi radian sang độ: nhân với 180 / pi.

---

## 5. Giải tích

### 5.1 Giới hạn
- Giới hạn của hàm số f(x) khi x tiến tới a là giá trị mà f(x) tiến gần tới khi x tiến gần a.
- Giới hạn quan trọng: giới hạn của sin(x) / x khi x tiến tới 0 bằng 1.
- Giới hạn của (1 + 1/n)^n khi n tiến tới vô cùng bằng e (xấp xỉ 2,71828).

### 5.2 Đạo hàm
- Đạo hàm của hàm số tại một điểm cho biết tốc độ thay đổi tức thời của hàm số tại điểm đó; về mặt hình học, đó là hệ số góc của tiếp tuyến.
- (hằng số)' = 0
- (x^n)' = n x x^(n-1)
- (sin x)' = cos x
- (cos x)' = -sin x
- (e^x)' = e^x
- (ln x)' = 1 / x
- Đạo hàm của tổng: (u + v)' = u' + v'.
- Đạo hàm của tích: (u x v)' = u' x v + u x v'.
- Đạo hàm của thương: (u / v)' = (u' x v - u x v') / v^2.
- Đạo hàm hàm hợp: (f(g(x)))' = f'(g(x)) x g'(x).

### 5.3 Ứng dụng của đạo hàm
- Nếu f'(x) > 0 trên một khoảng thì hàm số đồng biến trên khoảng đó; nếu f'(x) < 0 thì nghịch biến.
- Điểm cực trị thường nằm tại nơi f'(x) = 0 hoặc f'(x) không xác định; đổi dấu của f' quanh điểm đó cho biết đó là cực đại hay cực tiểu.
- Tìm giá trị lớn nhất, nhỏ nhất: so sánh giá trị hàm tại các điểm cực trị và tại hai đầu mút của đoạn đang xét.

### 5.4 Tích phân
- Nguyên hàm của f(x) là hàm F(x) có đạo hàm bằng f(x).
- Tích phân của x^n bằng x^(n+1) / (n + 1) + C (n khác -1).
- Tích phân của 1/x bằng ln|x| + C.
- Tích phân của e^x bằng e^x + C.
- Tích phân của cos x bằng sin x + C; tích phân của sin x bằng -cos x + C.
- Công thức Newton - Leibniz: tích phân từ a đến b của f(x) bằng F(b) - F(a).
- Ý nghĩa hình học: tích phân xác định của f(x) không âm từ a đến b bằng diện tích hình phẳng giới hạn bởi đồ thị f(x), trục hoành và hai đường x = a, x = b.

---

## 6. Tổ hợp, xác suất và thống kê

### 6.1 Quy tắc đếm
- Quy tắc cộng: nếu một việc làm theo phương án A (m cách) hoặc phương án B (n cách), không trùng nhau, thì có m + n cách.
- Quy tắc nhân: nếu một việc gồm hai bước liên tiếp, bước 1 có m cách và bước 2 có n cách, thì có m x n cách.

### 6.2 Hoán vị, chỉnh hợp, tổ hợp
- Giai thừa: n! = 1 x 2 x 3 x ... x n, và 0! = 1.
- Hoán vị của n phần tử: P_n = n!.
- Chỉnh hợp chập k của n phần tử (có thứ tự): A(n, k) = n! / (n - k)!.
- Tổ hợp chập k của n phần tử (không thứ tự): C(n, k) = n! / (k! x (n - k)!).
- Tính chất: C(n, k) = C(n, n - k).
- Ví dụ: chọn 2 người từ 5 người có C(5, 2) = 10 cách.

### 6.3 Xác suất
- Xác suất của biến cố A trong phép thử có các kết quả đồng khả năng: P(A) = số kết quả thuận lợi cho A / tổng số kết quả có thể.
- Xác suất luôn nằm trong khoảng từ 0 đến 1.
- Biến cố đối: P(không A) = 1 - P(A).
- Hai biến cố xung khắc: P(A hoặc B) = P(A) + P(B).
- Hai biến cố độc lập: P(A và B) = P(A) x P(B).
- Ví dụ: tung một đồng xu cân đối, xác suất ra mặt sấp là 1/2.

### 6.4 Thống kê mô tả
- Số trung bình cộng: tổng các giá trị chia cho số lượng giá trị.
- Trung vị: giá trị đứng giữa khi sắp xếp dữ liệu theo thứ tự tăng dần (nếu số lượng chẵn thì lấy trung bình hai giá trị giữa).
- Mốt: giá trị xuất hiện nhiều nhất.
- Phương sai: trung bình của bình phương độ lệch so với số trung bình.
- Độ lệch chuẩn: căn bậc hai của phương sai, đo mức độ phân tán của dữ liệu.

---

## 7. Tập hợp và logic

### 7.1 Tập hợp
- Hợp của A và B: tập các phần tử thuộc A hoặc thuộc B.
- Giao của A và B: tập các phần tử thuộc cả A và B.
- Hiệu của A và B: tập các phần tử thuộc A nhưng không thuộc B.
- Tập con: A là tập con của B nếu mọi phần tử của A đều thuộc B.
- Số tập con của một tập có n phần tử là 2^n.

### 7.2 Mệnh đề và logic
- Mệnh đề là câu khẳng định có thể xác định được đúng hoặc sai.
- Phủ định của mệnh đề P ký hiệu là "không P"; nếu P đúng thì "không P" sai và ngược lại.
- Mệnh đề kéo theo "P suy ra Q" chỉ sai khi P đúng và Q sai.
- Mệnh đề đảo của "P suy ra Q" là "Q suy ra P"; mệnh đề đảo không nhất thiết đúng khi mệnh đề gốc đúng.
- Phản chứng: để chứng minh mệnh đề, giả sử nó sai rồi suy ra điều mâu thuẫn.
- Quy nạp toán học: chứng minh mệnh đề đúng với n = 1 (bước cơ sở), rồi chứng minh nếu đúng với n = k thì đúng với n = k + 1 (bước quy nạp).

---

## 8. Hỏi đáp nhanh

**Hỏi: Số nguyên tố là gì?**
Đáp: Là số tự nhiên lớn hơn 1 chỉ có hai ước là 1 và chính nó, ví dụ 2, 3, 5, 7.

**Hỏi: Công thức nghiệm của phương trình bậc hai?**
Đáp: Với ax^2 + bx + c = 0, tính Delta = b^2 - 4ac; nghiệm là x = (-b ± căn Delta) / (2a) khi Delta không âm.

**Hỏi: Diện tích hình tròn tính thế nào?**
Đáp: S = pi x r^2, với r là bán kính.

**Hỏi: Định lý Pythagore phát biểu thế nào?**
Đáp: Trong tam giác vuông, bình phương cạnh huyền bằng tổng bình phương hai cạnh góc vuông.

**Hỏi: Đạo hàm của x^n là gì?**
Đáp: (x^n)' = n x x^(n-1).

**Hỏi: Hoán vị, chỉnh hợp và tổ hợp khác nhau thế nào?**
Đáp: Hoán vị là sắp xếp tất cả n phần tử; chỉnh hợp là chọn k phần tử có tính đến thứ tự; tổ hợp là chọn k phần tử không tính thứ tự.

**Hỏi: Công thức tính tổng cấp số cộng?**
Đáp: S_n = n x (u_1 + u_n) / 2.

**Hỏi: Công thức sin bình phương cộng cos bình phương?**
Đáp: sin^2(x) + cos^2(x) = 1 với mọi x.
