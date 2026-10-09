import os, re, json, subprocess, tempfile, unicodedata

def _fitz():
    try:
        import pymupdf as fitz
    except ImportError:
        fitz = _fitz()
    return fitz


# Import lười: parser chạy được dù chưa cài pymupdf / python-docx
# pip install pymupdf python-docx charset-normalizer

# "Câu 1." / "Câu 1:" / "Câu 1)" / "Câu 1 nội dung..."
Q_RE = re.compile(r'^\s*(?:Câu|CÂU|Question)\s*(\d+)\s*(?:[\.:\)]\s*|\s+|$)(.*)', re.I)
# Dạng sách tiếng Anh: "1. Which of ..." (đánh số trơn, chỉ nhận trong mục Review Questions)
Q_PLAIN_RE = re.compile(r'^\s*(\d+)[\.\)]\s+(.*)')
OPT_RE = re.compile(r'^\s*(?:[-*•]\s*)?\(?([A-Da-d])[\.\)]\s*(.*)')
INLINE_OPT_RE = re.compile(r'(?:^|\s)\(?([A-Da-d])[\.\)]\s+')
ANSWER_RE = re.compile(
    r'^\s*(?:Đáp\s+án|Answer|Key|Giải\s+thích|Lời\s+giải|Explanation|Solution)\s*[:.]?\s*(?:[A-Da-d][\.\)]\s*)?.*$',
    re.I,
)
SECTION_RE = re.compile(r'^\s*\d+(?:\.\d+)+\s+\S.*$')
START_SCOPE_RE = re.compile(r'^\s*Review Questions\s*$', re.I)
END_SCOPE_RE = re.compile(r'^\s*(?:Key Terms|Hands-On Projects|Case Projects|Chapter Summary|Summary)\s*$', re.I)
FOOTER_RE = re.compile(r'Cengage Learning|Editorial review has deemed|^\s*WCN\s+\d', re.I)

# Dòng header/footer hay dính vào đáp án cuối: "Trang 12", "Page 3/10", "- 12 -"
NOISE_RE = re.compile(r'^\s*(?:Copyright\b.*|(?:Trang|Page)\s*\d+(?:\s*/\s*\d+)?|[-–—]\s*\d+\s*[-–—])\s*$', re.I)

LIGATURES = {'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬀ': 'ff', 'ﬃ': 'ffi', 'ﬄ': 'ffl'}
INVISIBLE = dict.fromkeys(map(ord, '\u00ad\u200b\u200c\u200d\u2060\ufeff'), None)


def clean_text(text: str) -> str:
    text = unicodedata.normalize('NFC', text)
    text = text.translate(INVISIBLE).replace('\xa0', ' ').replace('\f', '\n')
    text = re.sub(r'^\s{0,3}#{1,6}\s*', '', text, flags=re.M)
    text = text.replace('**', '').replace('__', '').replace('`', '')
    for k, v in LIGATURES.items():
        text = text.replace(k, v)
    return text


# ---------------------------------------------------------------- đọc file
def extract_docx(path):
    """Đọc đoạn văn và bảng theo đúng thứ tự trong tài liệu.
    Lưu ý: số/chữ tự động của Word (auto-numbering) KHÔNG nằm trong text → xem fallback PDF ở run()."""
    from docx import Document
    from docx.table import Table
    from docx.text.paragraph import Paragraph
    doc = Document(path)
    lines = []
    for child in doc.element.body.iterchildren():
        if child.tag.endswith('}p'):
            lines.append(Paragraph(child, doc).text)
        elif child.tag.endswith('}tbl'):
            for row in Table(child, doc).rows:
                lines.append('  '.join(c.text.strip() for c in row.cells))
    return '\n'.join(lines)


def _page_text(page) -> str:
    """Đọc trang theo đúng thứ tự: chia dải ngang tại các tiêu đề (Key Terms, Review Questions...),
    trong mỗi dải đọc cột trái rồi cột phải."""
    import bisect
    mid = page.rect.width / 2
    items = []
    for b in page.get_text("blocks"):
        if b[6] != 0:                               # bỏ block ảnh
            continue
        txt = b[4].strip()
        if not txt or FOOTER_RE.search(txt):        # bỏ footer bản quyền
            continue
        items.append((b[0], b[1], txt))
    heading_ys = sorted(y for x, y, t in items
                        if '\n' not in t and (START_SCOPE_RE.match(t) or END_SCOPE_RE.match(t)))

    def key(it):
        x, y, _ = it
        return (bisect.bisect_right(heading_ys, y + 2), 0 if x < mid else 1, y, x)

    return '\n'.join(t for _, _, t in sorted(items, key=key))


def pdf_pages_text(doc, start=1, end=None) -> str:
    """start, end: số trang từ 1, gồm cả hai đầu."""
    total = len(doc)
    end = total if end is None else end
    if start < 1 or start > total:
        raise ValueError(f"Trang bắt đầu {start} không hợp lệ (file chỉ có {total} trang)")
    end = min(end, total)
    if start > end:
        raise ValueError(f"Khoảng trang {start}-{end} không hợp lệ (file có {total} trang)")
    text = '\n'.join(_page_text(doc[i]) for i in range(start - 1, end))
    if len(text.strip()) < 20 * (end - start + 1):
        raise RuntimeError(f"Trang {start}-{end} gần như không có text (PDF scan?) → cần OCR")
    return text


def _soffice():
    import shutil
    for name in ("soffice", "libreoffice"):
        if p := shutil.which(name):
            return p
    for base in (os.environ.get("ProgramFiles", r"C:\Program Files"),
                 os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")):
        p = os.path.join(base, "LibreOffice", "program", "soffice.exe")
        if os.path.exists(p):
            return p
    return None


def to_pdf(path: str) -> str:
    """DOCX/DOC -> PDF: ưu tiên LibreOffice headless, không có thì dùng Microsoft Word qua docx2pdf."""
    out = tempfile.mkdtemp()
    pdf = os.path.join(out, os.path.splitext(os.path.basename(path))[0] + ".pdf")
    if exe := _soffice():
        subprocess.run([exe, "--headless", "--convert-to", "pdf", "--outdir", out, path], check=True)
        converted = os.path.join(out, os.path.splitext(os.path.basename(path))[0] + ".pdf")
        if os.path.exists(converted):
            return converted
        return pdf
    try:
        from docx2pdf import convert          # pip install docx2pdf (cần cài Microsoft Word)
        convert(os.path.abspath(path), pdf)
        return pdf
    except ImportError:
        pass
    raise RuntimeError("Cần LibreOffice hoặc Word để chuyển DOCX sang PDF. "
                       "Cài LibreOffice, hoặc `pip install docx2pdf` (máy có Word), "
                       "hoặc tự xuất file ra PDF rồi chạy trên PDF.")


def _ext(path):
    return path.lower().rsplit('.', 1)[-1]


def extract_text(path: str) -> str:
    ext = _ext(path)
    if ext == 'txt':
        from charset_normalizer import from_bytes
        with open(path, 'rb') as f:
            return str(from_bytes(f.read()).best())
    if ext == 'md':
        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read()
    if ext == 'docx':
        return extract_docx(path)
    if ext == 'pdf':
        fitz = _fitz()
        with fitz.open(path) as doc:
            return pdf_pages_text(doc)
    raise ValueError("Định dạng không hỗ trợ")


def get_page_count(path: str) -> int:
    ext = _ext(path)
    if ext in ("docx", "doc"):
        path, ext = to_pdf(path), "pdf"
    if ext == "pdf":
        fitz = _fitz()
        with fitz.open(path) as doc:
            return len(doc)
    if ext in ("txt", "md"):
        with open(path, encoding="utf-8", errors="ignore") as f:
            text = f.read()
        return 1 if text.strip() else 0
    raise ValueError("Định dạng không hỗ trợ")


def extract_text_pages(path: str, start: int, end: int) -> str:
    ext = _ext(path)
    if ext in ("docx", "doc"):
        path, ext = to_pdf(path), "pdf"
    if ext == "pdf":
        fitz = _fitz()
        with fitz.open(path) as doc:
            return pdf_pages_text(doc, start, end)
    if ext in ("txt", "md"):
        with open(path, encoding="utf-8", errors="ignore") as f:
            text = f.read()
        if ext == "txt":
            pages = text.split("\f")
            if len(pages) == 1:
                raise ValueError("File TXT không có ngắt trang, hãy chọn theo số dòng")
            return "\n".join(pages[start - 1:end])
        lines = text.splitlines()
        return "\n".join(lines[start - 1:end]) if lines else ""
    raise ValueError("Định dạng không hỗ trợ")


# ---------------------------------------------------------------- parser
def split_inline_options(line):
    """'A. 5  B. 6  C. 7  D. 8' -> (prefix, [('A','5'),...]) hoặc None.
    Chỉ nhận khi nhãn tăng dần (A,B,C,D) để tránh bắt nhầm 'điểm A. ...' trong câu hỏi."""
    marks, expected = [], None
    for m in INLINE_OPT_RE.finditer(line):
        letter = m.group(1).upper()
        if expected is None or letter == expected:
            marks.append((m, letter))
            expected = chr(ord(letter) + 1)
    if len(marks) < 2:
        return None
    prefix = line[:marks[0][0].start()].strip()
    parts = [(L, line[m.end(): marks[i + 1][0].start() if i + 1 < len(marks) else None].strip())
             for i, (m, L) in enumerate(marks)]
    return prefix, parts


def parse_questions(text: str):
    text = clean_text(text)
    has_scope = any(START_SCOPE_RE.match(l) for l in text.splitlines())
    in_scope = not has_scope        # có "Review Questions" thì chỉ nhận số trơn sau tiêu đề đó
    questions, cur, last = [], None, None

    def new_q(num, body):
        nonlocal cur, last
        cur = {"number": num, "question": body.strip(), "type": "single", "options": {},
               "correct_answer": None, "warnings": []}
        questions.append(cur)
        last = "q"

    def append(line):
        if last == "q":
            cur["question"] = (cur["question"] + " " + line).strip()
        elif last:
            cur["options"][last] = (cur["options"][last] + " " + line).strip()

    for line in text.splitlines():
        line = re.sub(r'[ \t]+', ' ', line).strip()
        if not line or NOISE_RE.match(line):
            continue
        if START_SCOPE_RE.match(line):
            in_scope, cur, last = True, None, None
            continue
        if END_SCOPE_RE.match(line):
            in_scope, cur, last = False, None, None
            continue
        if ANSWER_RE.match(line):
            continue
        if cur and SECTION_RE.match(line):
            cur, last = None, None
            continue

        if m := Q_RE.match(line):                              # "Câu 1." / "Question 1:"
            new_q(int(m[1]), m[2])
        elif in_scope and (m := Q_PLAIN_RE.match(line)) and \
                ((cur is None and int(m[1]) == 1) or
                 (cur is not None and int(m[1]) in (cur["number"] + 1, 1))):
            new_q(int(m[1]), m[2])                             # "1. Which of ..."
        elif cur and (res := split_inline_options(line)):
            prefix, parts = res
            if prefix:
                append(prefix)
            for k, v in parts:
                cur["options"][k] = v
                last = k
        elif cur and (m := OPT_RE.match(line)):
            k = m[1].upper()
            cur["options"][k] = m[2].strip()
            last = k
        elif cur:
            append(line)

        footer_tail = re.compile(r'\s*[-–—]*\s*HẾT\s*[-–—]*\s*$', re.I)
        page_header = re.compile(r'\s*Đề\s+kiểm\s+tra[^\n]*?Mã\s+đề\s*\d+', re.I)

    def strip_noise(t):
        t = footer_tail.sub('', page_header.sub('', t)).strip()
        t = re.sub(r'\s*[-–—]+\s*$', '', t)
        return t

    for q in questions:
        q["question"] = strip_noise(q["question"])
        for k in q["options"]:
            q["options"][k] = strip_noise(q["options"][k])
            
    for q in questions:
        qt = q["question"]
        if not q["options"] and re.search(r'true\s+or\s+false|đúng\s+hay\s+sai', qt, re.I):
            q["type"] = "true_false"
            continue
        if re.search(r'choose all|select all|chọn tất cả|nhiều đáp án', qt, re.I):
            q["type"] = "multiple"
        if not qt:
            q["warnings"].append("Câu hỏi rỗng")
        if missing := sorted(set("ABCD") - q["options"].keys()):
            q["warnings"].append(f"Thiếu đáp án: {missing}")
        if empty := sorted(k for k, v in q["options"].items() if not v):
            q["warnings"].append(f"Đáp án rỗng: {empty}")
    return questions


# ---------------------------------------------------------------- API
def _result(path, qs):
    return {"source_file": os.path.basename(path), "total_questions": len(qs), "questions": qs}


def run(path):
    qs = parse_questions(extract_text(path))
    if not qs and _ext(path) in ("docx", "doc"):   # có thể do auto-numbering → đọc qua PDF
        qs = parse_questions(extract_text(to_pdf(path)))
    return _result(path, qs)


def run_range(path, start, end, debug=False):
    ext = _ext(path)
    if ext in ("docx", "doc"):         # chuyển PDF một lần duy nhất
        path_for_read = to_pdf(path)
    else:
        path_for_read = path
    total_pages = get_page_count(path_for_read)
    print("Tong so trang:", total_pages)
    raw = extract_text_pages(path_for_read, start, end)
    qs = parse_questions(raw)
    if debug or not qs:
        print("----- TEXT THÔ (1500 ký tự đầu) -----\n" + raw[:1500] + "\n--------------------------------------")
    res = _result(path, qs)
    res["pages"] = [max(1, start), min(end, total_pages)]
    return res


if __name__ == "__main__":
    import sys
    # python pqq.py de_thi.docx            -> toàn bộ file
    # python pqq.py de_thi.pdf 438 440     -> theo khoảng trang
    p = sys.argv[1] if len(sys.argv) > 1 else "de_thi.pdf"
    if len(sys.argv) >= 4:
        result = run_range(p, int(sys.argv[2]), int(sys.argv[3]))
    else:
        result = run(p)
    print(json.dumps(result, ensure_ascii=False, indent=2))
