"""
API upload file đề thi -> trả JSON danh sách câu hỏi.

Cài đặt:  pip install fastapi uvicorn python-multipart pymupdf python-docx charset-normalizer
Chạy:     uvicorn api:app --host 0.0.0.0 --port 8000
Yêu cầu:  file parser của bạn được lưu là pqq.py, cùng thư mục với file này.

Gọi thử:
  curl -F "file=@de_thi.docx" http://localhost:8000/parse
  curl -F "file=@sach.pdf" -F "start=438" -F "end=440" http://localhost:8000/parse
"""
import argparse
import json
import logging
import os
import subprocess
import sys
import tempfile
from typing import Optional

try:
    from fastapi import FastAPI, File, Form, HTTPException, UploadFile
except ModuleNotFoundError:  # pragma: no cover - CLI/help path should still work
    FastAPI = None
    File = Form = HTTPException = UploadFile = None

import core  # parser gốc

log = logging.getLogger("file2exam-api")

ALLOWED_EXT = {"pdf", "docx", "doc", "txt", "md"}
MAX_UPLOAD_MB = 50
CHUNK = 1024 * 1024

app = FastAPI(title="Question Parser API", version="1.0") if FastAPI is not None else None


if app is not None:
    @app.get("/health")
    def health():
        return {"status": "ok"}


    @app.post("/parse")
    def parse(
        file: UploadFile = File(..., description="PDF / DOCX / DOC / TXT"),
        start: Optional[int] = Form(None, description="Trang bắt đầu (từ 1), tuỳ chọn"),
        end: Optional[int] = Form(None, description="Trang kết thúc (gồm cả), tuỳ chọn"),
        debug: bool = Form(False),
    ):
        # Dùng `def` (không phải `async def`) để FastAPI tự chạy trong threadpool,
        # vì parser là code đồng bộ và có thể chạy LibreOffice khá lâu.
        original_name = file.filename or "upload"
        ext = original_name.lower().rsplit(".", 1)[-1] if "." in original_name else ""
        if ext not in ALLOWED_EXT:
            raise HTTPException(400, f"Định dạng '.{ext}' không hỗ trợ. Chấp nhận: {sorted(ALLOWED_EXT)}")
        if (start is None) != (end is None):
            raise HTTPException(400, "Phải truyền cả start và end, hoặc bỏ cả hai")

        with tempfile.TemporaryDirectory() as tmp:
            # Không dùng tên file của client để tránh path traversal
            path = os.path.join(tmp, f"upload.{ext}")
            size = 0
            with open(path, "wb") as out:
                while chunk := file.file.read(CHUNK):
                    size += len(chunk)
                    if size > MAX_UPLOAD_MB * CHUNK:
                        raise HTTPException(413, f"File vượt quá {MAX_UPLOAD_MB}MB")
                    out.write(chunk)
            if size == 0:
                raise HTTPException(400, "File rỗng")

            try:
                if start is not None:
                    result = core.run_range(path, start, end, debug=debug)
                else:
                    if ext == "doc":                      # run() không đọc trực tiếp .doc
                        path = core.to_pdf(path)
                    result = core.run(path)
            except ValueError as e:                       # trang sai, định dạng sai...
                raise HTTPException(400, str(e))
            except RuntimeError as e:                     # PDF scan, thiếu LibreOffice/Word...
                raise HTTPException(422, str(e))
            except subprocess.CalledProcessError:
                raise HTTPException(500, "Chuyển DOCX sang PDF thất bại")
            except ImportError as e:
                raise HTTPException(500, f"Thiếu thư viện trên server: {e}")
            except Exception:
                log.exception("Parse lỗi")
                raise HTTPException(500, "Lỗi không xác định khi phân tích file")

        result["source_file"] = original_name             # thay tên file tạm bằng tên gốc
        return result


def _run_cli(args):
    file_path = args.file
    if not file_path:
        print("Không có file để xử lý. Chạy: python3 file2exam.py <file.pdf|file.docx> [--start 1 --end 5]\n")
        return 0

    if (args.start is None) != (args.end is None):
        raise SystemExit("Vui lòng truyền cả --start và --end hoặc bỏ cả hai.")

    if args.start is not None:
        result = core.run_range(file_path, args.start, args.end, debug=args.debug)
    else:
        result = core.run(file_path)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def _run_server(args):
    if app is None:
        raise SystemExit("Thiếu dependency FastAPI. Cài đặt: pip install fastapi uvicorn python-multipart pymupdf python-docx charset-normalizer")
    import uvicorn
    uvicorn.run(app, host=args.host, port=args.port)
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser(description="Parser file đề thi sang JSON hoặc khởi động API FastAPI.")
    parser.add_argument("file", nargs="?", help="Đường dẫn file PDF/DOCX/DOC/TXT cần phân tích")
    parser.add_argument("--start", type=int, help="Trang bắt đầu (từ 1), dùng cùng --end")
    parser.add_argument("--end", type=int, help="Trang kết thúc (gồm cả), dùng cùng --start")
    parser.add_argument("--debug", action="store_true", help="In ra text thô để debug")
    parser.add_argument("--serve", action="store_true", help="Khởi động API thay vì chạy CLI parse")
    parser.add_argument("--host", default="0.0.0.0", help="Host khi chạy API")
    parser.add_argument("--port", type=int, default=8000, help="Port khi chạy API")
    args = parser.parse_args(argv)

    if args.serve:
        return _run_server(args)
    if args.file or args.start is not None or args.end is not None:
        return _run_cli(args)
    parser.print_help()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
