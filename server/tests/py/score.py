"""
MCQ Grader Module - Chấm bài trắc nghiệm 1 câu hỏi / 4 đáp án bằng Gemini 3.6 Flash
Tuân thủ đầy đủ đặc tả:
  - RAG trên tài liệu người dùng (chunking + embedding hoặc File Search tool)
  - Google Search grounding chỉ khi cần
  - Structured output theo JSON schema bắt buộc
  - Guardrail độc lập: schema, citation-match, self-consistency, LLM-as-judge, confidence threshold
  - Logging / audit đầy đủ
  - Hàng đợi needs_human_review
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

from google import genai
from google.genai import types
from pydantic import BaseModel, Field, ValidationError, field_validator

# ---------------------------------------------------------------------------
# Dependencies khuyến nghị (cài đặt):
#   pip install google-genai pydantic pypdf python-docx
# ---------------------------------------------------------------------------

logger = logging.getLogger(__name__)

DEFAULT_API_KEY = "<API KEY>"

# ========================== CONFIG ==========================

@dataclass
class GraderConfig:
    """Cấu hình có thể chỉnh sửa, không hardcode ngưỡng."""
    model: str = "gemini-3.6-flash"
    embedding_model: str = "gemini-embedding-001"  # hoặc gemini-embedding-2
    temperature: float = 0.1
    max_output_tokens: int = 2048
    top_k_chunks: int = 5
    chunk_size_tokens: int = 400          # ~300-500 token
    chunk_overlap_tokens: int = 50
    retrieval_similarity_threshold: float = 0.45
    confidence_threshold: float = 0.70
    self_consistency_runs: int = 2                 # số lần gọi để check consistency (2-3)
    enable_file_search: bool = True                # ưu tiên dùng File Search tool nếu có
    enable_web_search_fallback: bool = False       # web search bị vô hiệu hóa theo yêu cầu
    citation_fuzzy_threshold: float = 0.65         # độ tương đồng tối thiểu cho evidence_quote
    thinking_level: Optional[str] = "medium"       # nếu model hỗ trợ
    log_dir: str = "./mcq_grader_logs"


# ========================== STRUCTURED OUTPUT SCHEMA ==========================

class GradingResult(BaseModel):
    """Schema bắt buộc theo mục 5.3 của đặc tả."""
    correct_option: str = Field(..., description="A, B, C hoặc D")
    confidence: float = Field(..., ge=0.0, le=1.0)
    evidence_quote: Optional[str] = Field(None, description="Trích dẫn nguyên văn ngắn (≤1 câu)")
    evidence_source: str = Field(..., description="Nguồn trích dẫn (file/page hoặc URL)")
    reasoning: Optional[str] = Field(None)
    insufficient_evidence: bool = Field(...)

    @field_validator("correct_option")
    @classmethod
    def validate_option(cls, v: str) -> str:
        v = v.strip().upper()
        if v not in {"A", "B", "C", "D"}:
            raise ValueError("correct_option phải là A, B, C hoặc D")
        return v


# Schema JSON thuần cho response_json_schema
GRADING_JSON_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "correct_option": {"type": "string", "enum": ["A", "B", "C", "D"]},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        "evidence_quote": {"type": "string"},
        "evidence_source": {"type": "string"},
        "reasoning": {"type": "string"},
        "insufficient_evidence": {"type": "boolean"},
    },
    "required": [
        "correct_option",
        "confidence",
        "evidence_source",
        "insufficient_evidence",
    ],
}


# ========================== DATA CLASSES ==========================

@dataclass
class Chunk:
    id: str
    content: str
    source: str                    # tên file hoặc "web"
    page: Optional[int] = None
    similarity: float = 0.0


@dataclass
class AuditLog:
    request_id: str
    timestamp: str
    question: str
    options: Dict[str, str]
    retrieved_chunks: List[Dict[str, Any]] = field(default_factory=list)
    web_search_used: bool = False
    web_sources: List[str] = field(default_factory=list)
    model_outputs: List[Dict[str, Any]] = field(default_factory=list)
    guardrail_results: Dict[str, Any] = field(default_factory=dict)
    final_status: str = "pending"          # auto_graded | needs_human_review
    final_result: Optional[Dict[str, Any]] = None
    reason: Optional[str] = None


# ========================== DOCUMENT PROCESSING ==========================

def extract_text_from_file(file_path: Union[str, Path]) -> str:
    """Trích xuất text từ PDF / DOCX / TXT."""
    path = Path(file_path)
    suffix = path.suffix.lower()

    if suffix == ".txt":
        return path.read_text(encoding="utf-8", errors="ignore")

    if suffix == ".pdf":
        try:
            from pypdf import PdfReader
            reader = PdfReader(str(path))
            texts = []
            for i, page in enumerate(reader.pages):
                t = page.extract_text() or ""
                if t.strip():
                    texts.append(f"[Trang {i+1}]\n{t}")
            return "\n\n".join(texts)
        except Exception as e:
            logger.warning("Không đọc được PDF %s: %s", path, e)
            return ""

    if suffix in {".docx", ".doc"}:
        try:
            from docx import Document
            doc = Document(str(path))
            return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        except Exception as e:
            logger.warning("Không đọc được DOCX %s: %s", path, e)
            return ""

    raise ValueError(f"Định dạng không hỗ trợ: {suffix}")


def simple_chunk_text(
    text: str,
    source: str,
    chunk_size: int = 400,
    overlap: int = 50,
) -> List[Chunk]:
    """Chunk đơn giản theo số từ (xấp xỉ token)."""
    words = text.split()
    chunks: List[Chunk] = []
    i = 0
    idx = 0
    while i < len(words):
        piece = " ".join(words[i : i + chunk_size])
        # Cố gắng lấy page number nếu có
        page_match = re.search(r"\[Trang\s+(\d+)\]", piece)
        page = int(page_match.group(1)) if page_match else None
        chunks.append(
            Chunk(
                id=f"{source}::chunk_{idx}",
                content=piece.strip(),
                source=source,
                page=page,
            )
        )
        i += max(1, chunk_size - overlap)
        idx += 1
    return chunks


# ========================== EMBEDDING + RETRIEVAL ==========================

def cosine_similarity(a: List[float], b: List[float]) -> float:
    import math
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


class SimpleRAG:
    """RAG in-memory dùng embedding của Gemini (không cần vector DB ngoài)."""

    def __init__(self, client: genai.Client, config: GraderConfig):
        self.client = client
        self.config = config
        self.chunks: List[Chunk] = []
        self.embeddings: List[List[float]] = []

    def add_documents(self, file_paths: List[Union[str, Path]]) -> None:
        for fp in file_paths:
            text = extract_text_from_file(fp)
            if not text.strip():
                continue
            source = Path(fp).name
            new_chunks = simple_chunk_text(
                text,
                source=source,
                chunk_size=self.config.chunk_size_tokens,
                overlap=self.config.chunk_overlap_tokens,
            )
            self.chunks.extend(new_chunks)

        if not self.chunks:
            return

        # Embed theo batch nhỏ
        batch_size = 16
        for i in range(0, len(self.chunks), batch_size):
            batch = self.chunks[i : i + batch_size]
            texts = [c.content for c in batch]
            try:
                resp = self.client.models.embed_content(
                    model=self.config.embedding_model,
                    contents=texts,
                    config=types.EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT"),
                )
                for emb in resp.embeddings:
                    self.embeddings.append(list(emb.values))
            except Exception as e:
                logger.error("Embedding failed: %s", e)
                # Fallback: zero vector
                for _ in batch:
                    self.embeddings.append([0.0] * 768)

    def retrieve(self, query: str, top_k: Optional[int] = None) -> List[Chunk]:
        if not self.chunks:
            return []
        top_k = top_k or self.config.top_k_chunks
        try:
            q_resp = self.client.models.embed_content(
                model=self.config.embedding_model,
                contents=query,
                config=types.EmbedContentConfig(task_type="RETRIEVAL_QUERY"),
            )
            q_emb = list(q_resp.embeddings[0].values)
        except Exception as e:
            logger.error("Query embedding failed: %s", e)
            return self.chunks[:top_k]

        scored: List[Tuple[float, Chunk]] = []
        for emb, chunk in zip(self.embeddings, self.chunks):
            sim = cosine_similarity(q_emb, emb)
            chunk.similarity = sim
            scored.append((sim, chunk))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [c for _, c in scored[:top_k]]


# ========================== PROMPTS ==========================

SYSTEM_INSTRUCTION = """Bạn là giám khảo chấm trắc nghiệm. Chỉ dựa vào NGỮ CẢNH được cung cấp bên dưới
để xác định đáp án đúng trong 4 lựa chọn A/B/C/D. Không được suy luận từ kiến
thức nền ngoài ngữ cảnh. Nếu ngữ cảnh không đủ để xác định chắc chắn, đặt
insufficient_evidence = true và không đoán. Mọi câu trả lời phải kèm trích dẫn
cụ thể (nguyên văn ngắn, tối đa 1 câu) từ ngữ cảnh, ghi rõ nguồn.
Chỉ được chọn đúng 1 trong 4 giá trị: A, B, C, D."""


def build_user_prompt(
    question: str,
    options: Dict[str, str],
    context_chunks: List[Chunk],
    web_context: str = "",
) -> str:
    opts = "\n".join(f"{k}. {v}" for k, v in sorted(options.items()))
    ctx_parts = []
    for c in context_chunks:
        src = c.source
        if c.page:
            src += f", trang {c.page}"
        ctx_parts.append(f"[Nguồn: {src} | similarity={c.similarity:.3f}]\n{c.content}")

    context_block = "\n\n---\n\n".join(ctx_parts) if ctx_parts else "(Không có tài liệu nội bộ)"
    if web_context:
        context_block += f"\n\n=== KẾT QUẢ TÌM KIẾM WEB ===\n{web_context}"

    return f"""NGỮ CẢNH:
{context_block}

CÂU HỎI:
{question}

CÁC LỰA CHỌN:
{opts}

Hãy trả về đúng JSON theo schema đã định nghĩa. Không thêm bất kỳ text nào ngoài JSON."""


VERIFIER_SYSTEM = """Bạn là người kiểm định độc lập kết quả chấm trắc nghiệm.
Nhiệm vụ: Xác minh xem kết quả của giám khảo có hợp lý và được hỗ trợ bởi ngữ cảnh hay không.
Chỉ trả lời dựa trên ngữ cảnh được cung cấp. Không dùng kiến thức bên ngoài."""


def build_verifier_prompt(
    question: str,
    options: Dict[str, str],
    context: str,
    grader_output: Dict[str, Any],
) -> str:
    return f"""NGỮ CẢNH:
{context}

CÂU HỎI: {question}
LỰA CHỌN: {json.dumps(options, ensure_ascii=False)}

KẾT QUẢ CỦA GIÁM KHẢO:
{json.dumps(grader_output, ensure_ascii=False, indent=2)}

Hãy xác minh:
1. evidence_quote có thực sự xuất hiện (hoặc gần đúng) trong ngữ cảnh không?
2. reasoning có logic và chỉ dựa trên ngữ cảnh không?
3. correct_option có phải là đáp án đúng nhất dựa trên ngữ cảnh không?

Trả về JSON:
{{
  "is_valid": true/false,
  "confidence": 0.0-1.0,
  "issues": ["mô tả vấn đề nếu có"],
  "agreed_option": "A/B/C/D hoặc null nếu không đồng ý"
}}"""


# ========================== GUARDRAIL ==========================

def schema_validate(raw: Dict[str, Any]) -> Tuple[bool, Optional[GradingResult], str]:
    try:
        result = GradingResult.model_validate(raw)
        return True, result, ""
    except ValidationError as e:
        return False, None, str(e)

def citation_match(
    quote: Optional[str],
    sources_text: str,
    threshold: float = 0.65,
) -> Tuple[bool, float]:
    """Kiểm tra evidence_quote có xuất hiện trong ngữ cảnh (exact hoặc fuzzy đơn giản)."""
    if not quote or not quote.strip():
        return False, 0.0
    quote_clean = re.sub(r"\s+", " ", quote.strip().lower())
    sources_clean = re.sub(r"\s+", " ", sources_text.lower())

    # Exact substring
    if quote_clean in sources_clean:
        return True, 1.0

    # Fuzzy: tỷ lệ từ trùng
    q_words = set(quote_clean.split())
    if not q_words:
        return False, 0.0
    s_words = set(sources_clean.split())
    overlap = len(q_words & s_words) / len(q_words)
    return overlap >= threshold, overlap


def majority_vote(options: List[str]) -> Tuple[Optional[str], float]:
    if not options:
        return None, 0.0
    from collections import Counter
    cnt = Counter(options)
    most, count = cnt.most_common(1)[0]
    return most, count / len(options)

# ========================== MAIN GRADER ==========================

class MCQGrader:
    def __init__(
        self,
        api_key: Optional[str] = DEFAULT_API_KEY,
        config: Optional[GraderConfig] = None,
    ):
        self.config = config or GraderConfig()
        self.client = genai.Client(api_key=api_key or DEFAULT_API_KEY)
        self.rag = SimpleRAG(self.client, self.config)
        self.file_search_store_name: Optional[str] = None
        Path(self.config.log_dir).mkdir(parents=True, exist_ok=True)

    # ---------- Document ingestion ----------

    def ingest_documents(self, file_paths: List[Union[str, Path]]) -> None:
        """Nạp tài liệu vào RAG in-memory (và optionally File Search store)."""
        self.rag.add_documents(file_paths)

        if self.config.enable_file_search and file_paths:
            try:
                store = self.client.file_search_stores.create(
                    config={"display_name": f"mcq-grader-{uuid.uuid4().hex[:8]}"}
                )
                self.file_search_store_name = store.name
                for fp in file_paths:
                    op = self.client.file_search_stores.upload_to_file_search_store(
                        file_search_store_name=store.name,
                        file=str(fp),
                        config={"display_name": Path(fp).name},
                    )
                    # Chờ upload xong (đơn giản)
                    for _ in range(30):
                        if op.done:
                            break
                        time.sleep(2)
                        op = self.client.operations.get(op)
                logger.info("File Search store sẵn sàng: %s", self.file_search_store_name)
            except Exception as e:
                logger.warning("Không tạo được File Search store, dùng RAG in-memory: %s", e)
                self.file_search_store_name = None

    # ---------- Core generation ----------

    def _call_model(
        self,
        system: str,
        user_prompt: str,
        use_web_search: bool = False,
        use_file_search: bool = False,
        temperature: Optional[float] = None,
        max_retries: int = 3,
    ) -> Tuple[Optional[Dict[str, Any]], Any]:
        """Gọi Gemini với structured output + tools tùy chọn. Có retry khi 429."""
        tools = []
        if use_file_search and self.file_search_store_name:
            tools.append(
                types.Tool(
                    file_search=types.FileSearch(
                        file_search_store_names=[self.file_search_store_name]
                    )
                )
            )

        config_kwargs: Dict[str, Any] = {
            "system_instruction": system,
            "temperature": temperature if temperature is not None else self.config.temperature,
            "max_output_tokens": self.config.max_output_tokens,
            "response_mime_type": "application/json",
            "response_json_schema": GRADING_JSON_SCHEMA,
        }
        if tools:
            config_kwargs["tools"] = tools

        # Thinking level nếu model hỗ trợ (Gemini 3 family)
        if self.config.thinking_level:
            try:
                config_kwargs["thinking_config"] = types.ThinkingConfig(
                    thinking_level=self.config.thinking_level
                )
            except Exception:
                pass  # bỏ qua nếu SDK chưa hỗ trợ

        last_error = None
        for attempt in range(max_retries):
            try:
                response = self.client.models.generate_content(
                    model=self.config.model,
                    contents=user_prompt,
                    config=types.GenerateContentConfig(**config_kwargs),
                )
                # Parse JSON
                text = response.text or ""
                # Đôi khi model vẫn bọc markdown
                text = re.sub(r"^```json\s*|\s*```$", "", text.strip(), flags=re.MULTILINE)
                data = json.loads(text)
                return data, response
            except Exception as e:
                last_error = e
                err_str = str(e)
                # Retry khi bị rate-limit (429)
                if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                    wait = 2 ** attempt + 1  # 2, 3, 5 giây...
                    logger.warning(
                        "Rate limit (429), chờ %ds rồi thử lại (lần %d/%d)...",
                        wait, attempt + 1, max_retries,
                    )
                    time.sleep(wait)
                    continue
                logger.error("Model call failed: %s", e)
                return None, None

        logger.error("Model call failed sau %d lần thử: %s", max_retries, last_error)
        return None, None

    # ---------- Guardrail pipeline ----------

    def _run_guardrails(
        self,
        question: str,
        options: Dict[str, str],
        context_text: str,
        model_outputs: List[Dict[str, Any]],
        audit: AuditLog,
    ) -> Tuple[str, Optional[Dict[str, Any]], str]:
        """
        Trả về (status, final_result_dict, reason)
        status = "auto_graded" | "needs_human_review"
        """
        guard = {
            "schema_ok": False,
            "citation_ok": False,
            "consistency_ok": False,
            "verifier_ok": False,
            "confidence_ok": False,
            "details": {},
        }

        # 1. Schema validation trên tất cả output
        valid_results: List[GradingResult] = []
        for i, raw in enumerate(model_outputs):
            ok, res, err = schema_validate(raw)
            guard["details"][f"schema_run_{i}"] = {"ok": ok, "error": err}
            if ok and res:
                valid_results.append(res)

        if not valid_results:
            guard["schema_ok"] = False
            audit.guardrail_results = guard
            return "needs_human_review", None, "Không có output nào pass schema validation"

        guard["schema_ok"] = True

        # 2. Self-consistency
        options_list = [r.correct_option for r in valid_results]
        majority, ratio = majority_vote(options_list)
        guard["details"]["consistency"] = {
            "options": options_list,
            "majority": majority,
            "ratio": ratio,
        }
        guard["consistency_ok"] = ratio >= 0.67 and majority is not None  # ít nhất 2/3

        if not guard["consistency_ok"]:
            audit.guardrail_results = guard
            return (
                "needs_human_review",
                None,
                f"Self-consistency thấp (ratio={ratio:.2f}), các lần gọi không thống nhất",
            )

        # Lấy kết quả majority làm candidate
        candidate = next(r for r in valid_results if r.correct_option == majority)

        # 3. Citation grounding check
        cite_ok, cite_score = citation_match(
            candidate.evidence_quote,
            context_text,
            threshold=self.config.citation_fuzzy_threshold,
        )
        guard["citation_ok"] = cite_ok
        guard["details"]["citation"] = {
            "score": cite_score,
            "quote": candidate.evidence_quote,
        }

        if not cite_ok and not candidate.insufficient_evidence:
            # Hạ confidence hoặc reject
            candidate.confidence = min(candidate.confidence, 0.5)
            guard["details"]["citation_note"] = "Citation không khớp → hạ confidence"

        # 4. LLM-as-judge (verifier)
        verifier_prompt = build_verifier_prompt(
            question, options, context_text, candidate.model_dump()
        )
        # Verifier dùng schema đơn giản hơn
        verifier_schema = {
            "type": "object",
            "properties": {
                "is_valid": {"type": "boolean"},
                "confidence": {"type": "number"},
                "issues": {"type": "array", "items": {"type": "string"}},
                "agreed_option": {"type": "string"},
            },
            "required": ["is_valid", "confidence"],
        }
        try:
            v_resp = self.client.models.generate_content(
                model=self.config.model,
                contents=verifier_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=VERIFIER_SYSTEM,
                    temperature=0.0,
                    response_mime_type="application/json",
                    response_json_schema=verifier_schema,
                ),
            )
            v_text = re.sub(r"^```json\s*|\s*```$", "", (v_resp.text or "").strip(), flags=re.M)
            v_data = json.loads(v_text)
            guard["details"]["verifier"] = v_data
            agreed = (v_data.get("agreed_option") or "").upper()
            is_valid = bool(v_data.get("is_valid")) and (
                agreed == candidate.correct_option or agreed in ("", "NULL", "NONE")
            )
            guard["verifier_ok"] = is_valid
        except Exception as e:
            logger.warning("Verifier failed: %s", e)
            guard["verifier_ok"] = False
            guard["details"]["verifier_error"] = str(e)

        # 5. Confidence threshold
        conf_ok = (
            candidate.confidence >= self.config.confidence_threshold
            and not candidate.insufficient_evidence
        )
        guard["confidence_ok"] = conf_ok

        # Tổng hợp quyết định
        all_pass = (
            guard["schema_ok"]
            and guard["consistency_ok"]
            and guard["citation_ok"]
            and guard["verifier_ok"]
            and guard["confidence_ok"]
        )

        audit.guardrail_results = guard

        if all_pass:
            final = candidate.model_dump()
            final["status"] = "auto_graded"
            return "auto_graded", final, ""
        else:
            reasons = []
            if not guard["citation_ok"]:
                reasons.append("citation không khớp")
            if not guard["verifier_ok"]:
                reasons.append("verifier không đồng thuận")
            if not guard["confidence_ok"]:
                reasons.append(
                    f"confidence thấp ({candidate.confidence:.2f}) hoặc insufficient_evidence"
                )
            reason = " / ".join(reasons) or "không đạt một số kiểm tra guardrail"
            return "needs_human_review", None, reason

    # ---------- Public API ----------

    def grade(
        self,
        question: str,
        options: Dict[str, str],
        document_paths: Optional[List[Union[str, Path]]] = None,
    ) -> Dict[str, Any]:
        """
        Chấm một câu hỏi trắc nghiệm.

        Parameters
        ----------
        question : str
        options : dict  {"A": "...", "B": "...", "C": "...", "D": "..."}
        document_paths : list of file paths (optional)

        Returns
        -------
        dict  theo format mục 8 của đặc tả
        """
        if set(options.keys()) != {"A", "B", "C", "D"}:
            raise ValueError("options phải chứa đúng 4 key A, B, C, D")

        request_id = str(uuid.uuid4())
        audit = AuditLog(
            request_id=request_id,
            timestamp=datetime.now(timezone.utc).isoformat(),
            question=question,
            options=options,
        )

        # 1. Ingest nếu có document mới
        if document_paths:
            self.ingest_documents(document_paths)

        # 2. Retrieval nội bộ
        query = question + " " + " ".join(options.values())
        retrieved = self.rag.retrieve(query)
        audit.retrieved_chunks = [
            {
                "id": c.id,
                "source": c.source,
                "page": c.page,
                "similarity": c.similarity,
                "content_preview": c.content[:200],
            }
            for c in retrieved
        ]

        max_sim = max((c.similarity for c in retrieved), default=0.0)
        if not retrieved or max_sim < self.config.retrieval_similarity_threshold:
            reason = "Không tìm thấy căn cứ đủ trong tài liệu. Không thực hiện web search theo quy tắc hiện tại."
            audit.final_status = "needs_human_review"
            audit.reason = reason
            audit.model_outputs = []
            self._save_audit(audit)
            return {
                "status": "needs_human_review",
                "reason": reason,
                "request_id": request_id,
                "candidate_outputs": [],
            }

        context_text = "\n\n".join(c.content for c in retrieved)
        use_fs = bool(self.file_search_store_name)
        user_prompt = build_user_prompt(question, options, retrieved)

        model_outputs: List[Dict[str, Any]] = []

        # ------------------------------------------------------------------
        # Bước 3a: Gọi lần đầu dựa trên tài liệu nội bộ duy nhất
        # ------------------------------------------------------------------
        first_raw, _ = self._call_model(
            SYSTEM_INSTRUCTION,
            user_prompt,
            use_web_search=False,
            use_file_search=use_fs,
        )

        if first_raw:
            model_outputs.append(first_raw)

        # ------------------------------------------------------------------
        # Bước 3b: Self-consistency – gọi thêm các lần còn lại
        # ------------------------------------------------------------------
        remaining_runs = max(0, self.config.self_consistency_runs - len(model_outputs))
        for _ in range(remaining_runs):
            raw, _ = self._call_model(
                SYSTEM_INSTRUCTION,
                user_prompt,
                use_web_search=False,
                use_file_search=use_fs,
            )
            if raw:
                model_outputs.append(raw)

        audit.web_search_used = False
        audit.model_outputs = model_outputs

        # 4. Guardrail
        status, final, reason = self._run_guardrails(
            question, options, context_text, model_outputs, audit
        )
        audit.final_status = status
        audit.reason = reason
        audit.final_result = final

        # 5. Lưu audit log
        self._save_audit(audit)

        # 6. Trả kết quả
        if status == "auto_graded" and final:
            return final
        return {
            "status": "needs_human_review",
            "reason": reason or "Không đạt guardrail",
            "request_id": request_id,
            "candidate_outputs": model_outputs,  # để người review xem
        }

    def _save_audit(self, audit: AuditLog) -> None:
        path = Path(self.config.log_dir) / f"{audit.request_id}.json"
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(asdict(audit), f, ensure_ascii=False, indent=2)
            logger.info("Audit log saved: %s", path)
        except Exception as e:
            logger.error("Không lưu được audit log: %s", e)


# ========================== CLI / EXAMPLE ==========================

if __name__ == "__main__":
    import argparse

    logging.basicConfig(level=logging.INFO)

    parser = argparse.ArgumentParser(description="MCQ Grader với Gemini 3.6 Flash")
    parser.add_argument("--question", required=True, help="Câu hỏi")
    parser.add_argument("--A", required=True)
    parser.add_argument("--B", required=True)
    parser.add_argument("--C", required=True)
    parser.add_argument("--D", required=True)
    parser.add_argument("--docs", nargs="*", help="Đường dẫn tài liệu PDF/DOCX/TXT")
    parser.add_argument("--api-key", default=DEFAULT_API_KEY)
    args = parser.parse_args()

    grader = MCQGrader(api_key=args.api_key)
    result = grader.grade(
        question=args.question,
        options={"A": args.A, "B": args.B, "C": args.C, "D": args.D},
        document_paths=args.docs,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
