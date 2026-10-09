import subprocess
import sys
import unittest
from pathlib import Path

from core import parse_questions


class File2ExamCliTests(unittest.TestCase):
    def test_help_prints_usage(self):
        project_dir = Path(__file__).resolve().parent
        result = subprocess.run(
            [sys.executable, "file2exam.py", "--help"],
            cwd=str(project_dir),
            capture_output=True,
            text=True,
            timeout=10,
        )

        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertIn("usage", result.stdout.lower())

    def test_parse_questions_skips_bullet_options_and_answer_line(self):
        text = '''Câu 25. Trung vị của dãy số 2, 5, 7, 9, 11 là:
- A. 5
- B. 7
- C. 9
- D. 6,8

Đáp án: B. Dãy đã sắp xếp có 5 số, giá trị đứng giữa là 7.'''

        questions = parse_questions(text)

        self.assertEqual(len(questions), 1)
        self.assertEqual(questions[0]["number"], 25)
        self.assertEqual(questions[0]["question"], "Trung vị của dãy số 2, 5, 7, 9, 11 là:")
        self.assertEqual(questions[0]["options"], {"A": "5", "B": "7", "C": "9", "D": "6,8"})
        self.assertNotIn("Đáp án", questions[0]["question"])

    def test_parse_questions_strips_trailing_hyphen_noise(self):
        text = '''Câu 26. Một tập hợp có 3 phần tử thì có tất cả bao nhiêu tập con? -
- A. 3 -
- B. 6 -
- C. 8 -
- D. 9'''

        questions = parse_questions(text)

        self.assertEqual(len(questions), 1)
        self.assertEqual(questions[0]["question"], "Một tập hợp có 3 phần tử thì có tất cả bao nhiêu tập con?")
        self.assertEqual(questions[0]["options"], {"A": "3", "B": "6", "C": "8", "D": "9"})

    def test_parse_questions_handles_markdown_format(self):
        text = '''# Bài kiểm tra

## Câu 1

Trung vị của dãy số 2, 5, 7, 9, 11 là:

- A. 5
- B. 7
- C. 9
- D. 6,8

**Đáp án:** B'''

        questions = parse_questions(text)

        self.assertEqual(len(questions), 1)
        self.assertEqual(questions[0]["number"], 1)
        self.assertEqual(questions[0]["question"], "Trung vị của dãy số 2, 5, 7, 9, 11 là:")
        self.assertEqual(questions[0]["options"], {"A": "5", "B": "7", "C": "9", "D": "6,8"})

    def test_parse_questions_skips_numbered_section_heading(self):
        text = '''Câu 15. Thể tích hình cầu bán kính 3 là:
- A. 12 pi
- B. 36 pi
- C. 27 pi
- D. 108 pi

Đáp án: B. V = (4/3) x pi x 3^3 = (4/3) x pi x 27 = 36 pi.

9.4 Lượng giác
Câu 16. Giá trị của sin 30 độ là:
- A. 1/2
- B. căn 3 / 2
- C. căn 2 / 2
- D. 1'''

        questions = parse_questions(text)

        self.assertEqual(len(questions), 2)
        self.assertEqual(questions[0]["question"], "Thể tích hình cầu bán kính 3 là:")
        self.assertEqual(questions[0]["options"]["D"], "108 pi")
        self.assertEqual(questions[1]["question"], "Giá trị của sin 30 độ là:")
        self.assertEqual(questions[1]["options"]["B"], "căn 3 / 2")


if __name__ == "__main__":
    unittest.main()
