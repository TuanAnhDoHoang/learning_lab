import React, { useState, useRef } from 'react';
import { CreateExamPayload, QuestionPayload } from '../index';
import { createExam, createExamByImage, parseExamFile } from '../api/apicaller';

export interface QuickAnswerParsed {
  indices: number[];
  labels: { questionNum: number; answerChar: string; index: number }[];
  error?: string;
}

export function parseQuickAnswerString(raw: string): QuickAnswerParsed {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { indices: [], labels: [] };
  }

  // Case 1: Pattern matching numbered answers like "1A", "Câu 1: B", "1. C", "1-D", "1: A"
  const regexNumbered = /(?:câu\s*|c\s*)?(\d+)[\s.:\-_/)]*([A-Da-d])\b/gi;
  const matches = Array.from(trimmed.matchAll(regexNumbered));

  if (matches.length > 0) {
    const items = matches.map((m) => {
      const num = parseInt(m[1], 10);
      const char = m[2].toUpperCase();
      const index = char.charCodeAt(0) - 65;
      return { questionNum: num, answerChar: char, index };
    });

    // Sort by question number to ensure sequential order
    items.sort((a, b) => a.questionNum - b.questionNum);

    return {
      indices: items.map((it) => it.index),
      labels: items,
    };
  }

  // Case 2: Space/comma/semicolon/dash separated letters like "A B C D", "A, B, C, D", "A - B - C - D"
  const tokens = trimmed.split(/[\s,;|\-]+/).filter(Boolean);
  const allSingleLetters = tokens.length > 0 && tokens.every((t) => /^[A-Da-d]$/.test(t));
  if (allSingleLetters) {
    const items = tokens.map((t, idx) => {
      const char = t.toUpperCase();
      const index = char.charCodeAt(0) - 65;
      return { questionNum: idx + 1, answerChar: char, index };
    });

    return {
      indices: items.map((it) => it.index),
      labels: items,
    };
  }

  // Case 3: Continuous letters like "ABCDABCD"
  if (/^[A-Da-d]+$/.test(trimmed)) {
    const items = trimmed.toUpperCase().split('').map((c, idx) => {
      const index = c.charCodeAt(0) - 65;
      return { questionNum: idx + 1, answerChar: c, index };
    });

    return {
      indices: items.map((it) => it.index),
      labels: items,
    };
  }

  return {
    indices: [],
    labels: [],
    error: 'Định dạng đáp án chưa hợp lệ. Bạn có thể nhập dạng: 1A, 2B, 3C, 4D... hoặc A B C D.',
  };
}

interface CreateExamPageProps {
  onBackToHome: () => void;
}

export const CreateExamPage: React.FC<CreateExamPageProps> = ({ onBackToHome }) => {
  const [createMode, setCreateMode] = useState<'manual' | 'image' | 'pdf'>('manual');
  const [examName, setExamName] = useState('');
  const [domain, setDomain] = useState('');
  const [duration, setDuration] = useState(60); // Default duration in minutes
  const [questions, setQuestions] = useState<QuestionPayload[]>([
    { question: '', answers: ['', '', '', ''], right_answer: 0 }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Image Creation Mode State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [manualQuickAnswerInput, setManualQuickAnswerInput] = useState('');
  const [manualQuickAnswerMessage, setManualQuickAnswerMessage] = useState<string | null>(null);
  const [showManualQuickInput, setShowManualQuickInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfStartPage, setPdfStartPage] = useState('');
  const [pdfEndPage, setPdfEndPage] = useState('');
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const pdfFileInputRef = useRef<HTMLInputElement | null>(null);

  // PDF review state: parsed questions waiting for user review before createExam
  const [parsedExamQuestions, setParsedExamQuestions] = useState<QuestionPayload[] | null>(null);
  const [isApplyingPdf, setIsApplyingPdf] = useState(false);
  const [applyPdfError, setApplyPdfError] = useState<string | null>(null);

  // RAG Reference Document State for Answer Extraction (Removed for image mode, maybe used elsewhere?)

  const handleAddQuestion = () => {
    setQuestions([
      ...questions,
      { question: '', answers: ['', '', '', ''], right_answer: 0 }
    ]);
  };

  const handleRemoveQuestion = (index: number) => {
    if (questions.length === 1) return;
    const newQuestions = [...questions];
    newQuestions.splice(index, 1);
    setQuestions(newQuestions);
  };

  const handleQuestionChange = (index: number, field: keyof QuestionPayload, value: any) => {
    const newQuestions = [...questions];
    newQuestions[index] = { ...newQuestions[index], [field]: value };
    setQuestions(newQuestions);
  };

  const handleAnswerChange = (qIndex: number, aIndex: number, value: string) => {
    const newQuestions = [...questions];
    const newAnswers = [...newQuestions[qIndex].answers];
    newAnswers[aIndex] = value;
    newQuestions[qIndex].answers = newAnswers;
    setQuestions(newQuestions);
  };

  const handleDurationChange = (value: number) => {
    if (value < 1) value = 1;
    setDuration(value);
  };

  /* ── Submit Manual Exam ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!examName.trim()) {
      setError('Vui lòng nhập tên đề thi');
      return;
    }
    if (!domain.trim()) {
      setError('Vui lòng nhập lĩnh vực');
      return;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question.trim()) {
        setError(`Câu hỏi ${i + 1} không được để trống nội dung`);
        return;
      }
      for (let j = 0; j < 4; j++) {
        if (!q.answers[j].trim()) {
          setError(`Câu hỏi ${i + 1}: Đáp án ${j + 1} không được để trống`);
          return;
        }
      }
    }

    setLoading(true);
    try {
      const payload: CreateExamPayload = {
        exam_name: examName.trim(),
        domain: domain.trim(),
        questions: questions,
        duration: duration,
      };

      await createExam(payload);
      alert('Tạo đề thi thành công!');
      onBackToHome();
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra khi tạo đề thi');
    } finally {
      setLoading(false);
    }
  };

  /* ── Image Upload Handlers ── */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) {
        setImageError('Vui lòng chọn đúng tệp định dạng hình ảnh (JPG, PNG, WEBP).');
        return;
      }
      setImageError(null);
      setImageFile(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  };

  const handleClearImage = () => {
    setImageFile(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePdfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] ?? null;
    if (!selectedFile) {
      setPdfFile(null);
      return;
    }

    const allowedExtensions = ['pdf', 'docx', 'doc', 'txt', 'md'];
    const extension = selectedFile.name.split('.').pop()?.toLowerCase();
    if (!extension || !allowedExtensions.includes(extension)) {
      setPdfError('Vui lòng chọn file PDF, DOCX, DOC, TXT hoặc MD.');
      setPdfFile(null);
      if (pdfFileInputRef.current) {
        pdfFileInputRef.current.value = '';
      }
      return;
    }

    setPdfError(null);
    setPdfFile(selectedFile);
  };

  const handleClearPdfFile = () => {
    setPdfFile(null);
    setPdfStartPage('');
    setPdfEndPage('');
    if (pdfFileInputRef.current) {
      pdfFileInputRef.current.value = '';
    }
  };

  const handleCreateByFile = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!pdfFile) {
      setPdfError('Vui lòng tải lên file đề thi để tiếp tục.');
      return;
    }
    if (!examName.trim()) {
      setPdfError('Vui lòng nhập tên đề thi.');
      return;
    }
    if (!domain.trim()) {
      setPdfError('Vui lòng chọn lĩnh vực / môn học.');
      return;
    }

    const hasRange = pdfStartPage.trim() !== '' || pdfEndPage.trim() !== '';
    if (hasRange) {
      const startValue = Number(pdfStartPage);
      const endValue = Number(pdfEndPage);

      if (!pdfStartPage.trim() || !pdfEndPage.trim()) {
        setPdfError('Vui lòng nhập cả số trang bắt đầu và kết thúc khi chọn phân trang.');
        return;
      }
      if (!Number.isInteger(startValue) || !Number.isInteger(endValue) || startValue < 1 || endValue < 1) {
        setPdfError('Số trang bắt đầu và kết thúc phải là số nguyên dương.');
        return;
      }
      if (startValue > endValue) {
        setPdfError('Số trang bắt đầu không được lớn hơn số trang kết thúc.');
        return;
      }
    }

    setPdfError(null);
    setIsParsingPdf(true);

    try {
      const parsedQuestions = await parseExamFile(
        pdfFile,
        pdfStartPage.trim() === '' ? undefined : Number(pdfStartPage),
        pdfEndPage.trim() === '' ? undefined : Number(pdfEndPage)
      );

      if (!parsedQuestions.length) {
        throw new Error('Không tìm thấy câu hỏi nào trong file đã chọn. Vui lòng kiểm tra lại file hoặc chọn khoảng trang khác.');
      }

      // Show review screen instead of immediately creating the exam
      setParsedExamQuestions(parsedQuestions);
      setApplyPdfError(null);
    } catch (err: any) {
      setPdfError(err.message || 'Không thể tạo đề thi từ file.');
    } finally {
      setIsParsingPdf(false);
    }
  };

  /* ── PDF review: handlers for editing parsed questions ── */
  const handleParsedQuestionChange = (index: number, field: keyof QuestionPayload, value: any) => {
    if (!parsedExamQuestions) return;
    const next = [...parsedExamQuestions];
    next[index] = { ...next[index], [field]: value };
    setParsedExamQuestions(next);
  };

  const handleParsedAnswerChange = (qIndex: number, aIndex: number, value: string) => {
    if (!parsedExamQuestions) return;
    const next = [...parsedExamQuestions];
    const newAnswers = [...next[qIndex].answers];
    newAnswers[aIndex] = value;
    next[qIndex] = { ...next[qIndex], answers: newAnswers };
    setParsedExamQuestions(next);
  };

  const handleAddParsedQuestion = () => {
    if (!parsedExamQuestions) return;
    setParsedExamQuestions([...parsedExamQuestions, { question: '', answers: ['', '', '', ''], right_answer: 0 }]);
  };

  const handleRemoveParsedQuestion = (index: number) => {
    if (!parsedExamQuestions || parsedExamQuestions.length <= 1) return;
    const next = [...parsedExamQuestions];
    next.splice(index, 1);
    setParsedExamQuestions(next);
  };

  /* ── Apply parsed exam: validate and call createExam ── */
  const handleApplyParsedExam = async () => {
    if (!parsedExamQuestions) return;

    // Basic validation
    for (let i = 0; i < parsedExamQuestions.length; i++) {
      const q = parsedExamQuestions[i];
      if (!q.question.trim()) {
        setApplyPdfError(`Câu hỏi ${i + 1} không được để trống nội dung.`);
        return;
      }
      for (let j = 0; j < 4; j++) {
        if (!q.answers[j]?.trim()) {
          setApplyPdfError(`Câu hỏi ${i + 1}: Đáp án ${String.fromCharCode(65 + j)} không được để trống.`);
          return;
        }
      }
    }

    setApplyPdfError(null);
    setIsApplyingPdf(true);
    try {
      const payload: CreateExamPayload = {
        exam_name: examName.trim(),
        domain: domain.trim(),
        questions: parsedExamQuestions,
        duration,
      };
      await createExam(payload);
      alert('Tạo đề thi từ file thành công!');
      onBackToHome();
    } catch (err: any) {
      setApplyPdfError(err.message || 'Không thể tạo đề thi. Vui lòng thử lại.');
    } finally {
      setIsApplyingPdf(false);
    }
  };

  const handleCreateByImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageFile) {
      setImageError('Vui lòng tải lên ảnh đề thi để tiếp tục.');
      return;
    }
    if (!examName.trim()) {
      setImageError('Vui lòng nhập tên đề thi.');
      return;
    }
    if (!domain.trim()) {
      setImageError('Vui lòng chọn lĩnh vực / môn học.');
      return;
    }

    setImageError(null);
    setIsAnalyzingImage(true);
    try {
      const parsedQuestions = await createExamByImage(
        {
          exam_name: examName.trim(),
          domain: domain.trim(),
          duration: duration,
          answers: [],
        },
        imageFile
      );

      if (!parsedQuestions.length) {
        throw new Error('Không tìm thấy câu hỏi nào trong ảnh.');
      }

      setParsedExamQuestions(parsedQuestions);
      setApplyPdfError(null);
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('Không tìm thấy câu hỏi')) {
        setImageError('Không tìm thấy câu hỏi nào trong ảnh. Vui lòng kiểm tra lại ảnh chụp rõ nét hơn (chụp thẳng, đủ sáng và có số thứ tự Câu 1, Câu 2...).');
      } else if (msg.includes('uploaded file is too large')) {
        setImageError('Dung lượng ảnh vượt quá giới hạn 1MB. Vui lòng chọn ảnh dung lượng nhỏ hơn.');
      } else {
        setImageError(msg || 'Lỗi khi trích xuất đề thi từ ảnh.');
      }
    } finally {
      setIsAnalyzingImage(false);
    }
  };



  const handleApplyManualQuickAnswers = () => {
    const parsed = parseQuickAnswerString(manualQuickAnswerInput);
    if (parsed.error && manualQuickAnswerInput.trim()) {
      setManualQuickAnswerMessage(parsed.error);
      return;
    }
    if (parsed.indices.length === 0) {
      setManualQuickAnswerMessage('Vui lòng nhập chuỗi đáp án (ví dụ: 1A, 2B, 3C...)');
      return;
    }

    const newQuestions = [...questions];
    let updatedCount = 0;
    parsed.labels.forEach((item) => {
      const qIdx = item.questionNum - 1;
      if (qIdx >= 0 && qIdx < newQuestions.length && item.index >= 0 && item.index < 4) {
        newQuestions[qIdx] = { ...newQuestions[qIdx], right_answer: item.index };
        updatedCount++;
      }
    });

    setQuestions(newQuestions);
    setManualQuickAnswerMessage(`Đã cập nhật đáp án cho ${updatedCount} câu hỏi.`);
  };

  return (
    <div className="ce-container">
      <div className="ce-page-header">
        <h2 className="ce-page-title">Tạo Đề Thi Mới</h2>

        {/* Creation Mode Switcher */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setCreateMode('manual')}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: createMode === 'manual' ? 'var(--primary-color)' : 'var(--bg-surface)',
              color: createMode === 'manual' ? '#fff' : 'var(--text-main)',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            Soạn thủ công
          </button>

          <button
            type="button"
            onClick={() => setCreateMode('image')}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: createMode === 'image' ? 'var(--primary-color)' : 'var(--bg-surface)',
              color: createMode === 'image' ? '#fff' : 'var(--text-main)',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease',
            }}
          >
            Tạo đề từ ảnh
            <span
              style={{
                fontSize: '0.72rem',
                background: createMode === 'image' ? 'rgba(255,255,255,0.25)' : 'rgba(34, 197, 94, 0.15)',
                color: createMode === 'image' ? '#fff' : '#22c55e',
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 800,
              }}
            >
              Mới
            </span>
          </button>

          <button
            type="button"
            onClick={() => setCreateMode('pdf')}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: createMode === 'pdf' ? 'var(--primary-color)' : 'var(--bg-surface)',
              color: createMode === 'pdf' ? '#fff' : 'var(--text-main)',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease',
            }}
          >
            Tạo đề từ file PDF
            <span
              style={{
                fontSize: '0.72rem',
                background: createMode === 'pdf' ? 'rgba(255,255,255,0.25)' : 'rgba(245, 158, 11, 0.15)',
                color: createMode === 'pdf' ? '#fff' : '#f59e0b',
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 800,
                border: createMode === 'pdf' ? 'none' : '1px solid rgba(245, 158, 11, 0.3)',
              }}
            >
              Mới
            </span>
          </button>
        </div>
      </div>

      {/* MODE 1: MANUAL CREATION */}
      {createMode === 'manual' && (
        <form className="ce-form" onSubmit={handleSubmit}>
          {/* TOP SECTION: Info */}
          <div className="ce-top-info">
            <div className="ce-field-group ce-flex-2">
              <label>Tên đề thi <span className="ce-required">*</span></label>
              <input
                type="text"
                className="ce-input"
                placeholder="Ví dụ: Đề kiểm tra 15 phút - Lượng giác"
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
              />
            </div>
            <div className="ce-field-group ce-flex-1">
              <label>Lĩnh vực / Môn học</label>
              <select
                className="ce-input ce-select"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              >
                <option value="">Chọn môn học...</option>
                <option value="Toán học">Toán học</option>
                <option value="Vật lý">Vật lý</option>
                <option value="Hóa học">Hóa học</option>
                <option value="Sinh học">Sinh học</option>
                <option value="Ngữ văn">Ngữ văn</option>
                <option value="Tiếng Anh">Tiếng Anh</option>
                <option value="Lập trình">Lập trình</option>
              </select>
            </div>
            <div className="ce-field-group ce-flex-1">
              <label>Thời gian làm bài (phút) <span className="ce-required">*</span></label>
              <input
                type="number"
                min="1"
                max="300"
                className="ce-input"
                placeholder="60"
                value={duration}
                onChange={(e) => handleDurationChange(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>

          {/* QUESTIONS HEADER */}
          <div className="ce-questions-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <h3 className="ce-questions-title" style={{ margin: 0 }}>Danh sách câu hỏi ({questions.length})</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowManualQuickInput(!showManualQuickInput)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: showManualQuickInput ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-surface)',
                  color: showManualQuickInput ? 'var(--primary-color)' : 'var(--text-main)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                {showManualQuickInput ? 'Đóng nhập nhanh' : 'Nhập nhanh bảng đáp án'}
              </button>
              <button type="button" className="ce-btn-add" onClick={handleAddQuestion}>
                + Thêm câu hỏi
              </button>
            </div>
          </div>

          {/* Quick Answer Input Toolbar for Manual Mode */}
          {showManualQuickInput && (
            <div style={{
              padding: '16px 20px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              marginBottom: '20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                  Nhập nhanh đáp án cho các câu hỏi bên dưới (1A, 2B, 3C... hoặc A B C D)
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Tự động gán lựa chọn đúng
                </span>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="text"
                  className="ce-input"
                  placeholder="Ví dụ: 1A, 2B, 3C, 4D... hoặc A B C D"
                  value={manualQuickAnswerInput}
                  onChange={(e) => {
                    setManualQuickAnswerInput(e.target.value);
                    setManualQuickAnswerMessage(null);
                  }}
                  style={{ flex: 1, fontFamily: 'monospace' }}
                />
                <button
                  type="button"
                  onClick={handleApplyManualQuickAnswers}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'var(--primary-color)',
                    color: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Áp dụng
                </button>
              </div>
              {manualQuickAnswerMessage && (
                <div style={{ marginTop: '8px', fontSize: '0.82rem', color: manualQuickAnswerMessage.includes('cập nhật') ? '#16a34a' : '#ef4444', fontWeight: 600 }}>
                  {manualQuickAnswerMessage}
                </div>
              )}
            </div>
          )}

          {/* QUESTIONS LIST */}
          <div className="ce-questions-list">
            {questions.map((q, qIndex) => (
              <div key={qIndex} className="ce-q-card">
                <div className="ce-q-card-top">
                  <span className="ce-q-badge">Câu {qIndex + 1}</span>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      className="ce-btn-remove"
                      onClick={() => handleRemoveQuestion(qIndex)}
                      title="Xóa câu hỏi này"
                    >
                      Xóa câu hỏi
                    </button>
                  )}
                </div>

                <div className="ce-field-group">
                  <label>Nội dung câu hỏi <span className="ce-required">*</span></label>
                  <textarea
                    className="ce-input ce-textarea"
                    placeholder="Nhập nội dung câu hỏi..."
                    rows={2}
                    value={q.question}
                    onChange={(e) => handleQuestionChange(qIndex, 'question', e.target.value)}
                  />
                </div>

                <div className="ce-answers-wrapper">
                  <label className="ce-answers-label">Các lựa chọn đáp án (Tích chọn đáp án đúng):</label>
                  <div className="ce-answers-grid">
                    {q.answers.map((ans, aIndex) => {
                      const letter = String.fromCharCode(65 + aIndex);
                      const isCorrect = q.right_answer === aIndex;
                      return (
                        <div key={aIndex} className={`ce-answer-row ${isCorrect ? 'is-correct' : ''}`}>
                          <label className="ce-radio-wrap">
                            <input
                              type="radio"
                              name={`correct-answer-${qIndex}`}
                              className="ce-radio"
                              checked={isCorrect}
                              onChange={() => handleQuestionChange(qIndex, 'right_answer', aIndex)}
                            />
                            <span className="ce-letter">{letter}</span>
                          </label>
                          <input
                            type="text"
                            className="ce-answer-input"
                            placeholder={`Đáp án ${letter}...`}
                            value={ans}
                            onChange={(e) => handleAnswerChange(qIndex, aIndex, e.target.value)}
                          />
                          {isCorrect && <span className="ce-badge-correct">Đúng</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {error && (
            <div className="ce-error-banner">
              {error}
            </div>
          )}

          <div className="ce-form-actions">
            <button type="button" className="ce-btn-cancel" onClick={onBackToHome} disabled={loading}>
              Hủy
            </button>
            <button type="submit" className="ce-btn-submit" disabled={loading}>
              {loading ? 'Đang lưu...' : 'Lưu Bài Thi'}
            </button>
          </div>
        </form>
      )}

      {/* MODE 2: CREATE FROM IMAGE */}
      {createMode === 'image' && parsedExamQuestions === null && (
        <div style={{ marginTop: '24px' }}>
          {isAnalyzingImage ? (
            /* Loading State during AI OCR Analysis */
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              padding: '60px 24px',
              textAlign: 'center',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{
                width: '56px',
                height: '56px',
                border: '4px solid var(--border-color)',
                borderTopColor: 'var(--primary-color)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 20px auto'
              }} />
              <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>
                Ứng dụng đang phân tích hình ảnh...
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', maxWidth: '520px', margin: '0 auto', lineHeight: 1.6 }}>
                Hệ thống đang quét chữ, trích xuất câu hỏi và các phương án A, B, C, D từ ảnh đề thi. Quá trình này có thể mất từ 5 đến 15 giây, vui lòng không đóng trình duyệt.
              </p>
            </div>
          ) : (
            /* Upload Image Form */
            <form className="ce-form" onSubmit={handleCreateByImage}>
              {/* TOP SECTION: Info */}
              <div className="ce-top-info">
                <div className="ce-field-group ce-flex-2">
                  <label>Tên đề thi <span className="ce-required">*</span></label>
                  <input
                    type="text"
                    className="ce-input"
                    placeholder="Ví dụ: Đề thi thử THPT Quốc Gia môn Lịch sử"
                    value={examName}
                    onChange={(e) => setExamName(e.target.value)}
                  />
                </div>
                <div className="ce-field-group ce-flex-1">
                  <label>Lĩnh vực / Môn học</label>
                  <select
                    className="ce-input ce-select"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                  >
                    <option value="">Chọn môn học...</option>
                    <option value="Toán học">Toán học</option>
                    <option value="Vật lý">Vật lý</option>
                    <option value="Hóa học">Hóa học</option>
                    <option value="Sinh học">Sinh học</option>
                    <option value="Lịch sử">Lịch sử</option>
                    <option value="Địa lý">Địa lý</option>
                    <option value="Ngữ văn">Ngữ văn</option>
                    <option value="Tiếng Anh">Tiếng Anh</option>
                    <option value="Lập trình">Lập trình</option>
                  </select>
                </div>
                <div className="ce-field-group ce-flex-1">
                  <label>Thời gian làm bài (phút) <span className="ce-required">*</span></label>
                  <input
                    type="number"
                    min="1"
                    max="300"
                    className="ce-input"
                    placeholder="45"
                    value={duration}
                    onChange={(e) => handleDurationChange(parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>

              {/* IMAGE UPLOAD DROPZONE */}
              <div style={{ marginTop: '20px' }}>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)', marginBottom: '8px' }}>
                  Ảnh chụp đề thi <span className="ce-required">*</span>
                </label>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />

                {!imageFile ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: '2px dashed var(--border-color)',
                      borderRadius: '12px',
                      padding: '48px 20px',
                      textAlign: 'center',
                      background: 'var(--bg-primary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '12px',
                      background: 'rgba(99, 102, 241, 0.1)',
                      color: 'var(--primary-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 12px auto'
                    }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    </div>
                    <p style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px', fontSize: '1rem' }}>
                      Bấm để chọn ảnh đề thi hoặc kéo thả tệp vào đây
                    </p>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
                      Hỗ trợ: JPG, PNG, WEBP (Hệ thống tự động tối ưu hóa kích thước dưới 1MB)
                    </p>
                  </div>
                ) : (
                  <div style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '16px',
                    background: 'var(--bg-surface)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    flexWrap: 'wrap'
                  }}>
                    {imagePreview && (
                      <img
                        src={imagePreview}
                        alt="Đề thi đã chọn"
                        style={{ width: '120px', height: '90px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <p style={{ fontWeight: 700, color: 'var(--text-main)', margin: '0 0 4px 0', fontSize: '0.95rem' }}>
                        {imageFile.name}
                      </p>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
                        Dung lượng gốc: {(imageFile.size / 1024).toFixed(1)} KB
                      </p>
                      <p style={{ fontSize: '0.78rem', color: '#22c55e', margin: '4px 0 0 0', fontWeight: 600 }}>
                        Đã sẵn sàng bóc tách
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearImage}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        background: 'transparent',
                        color: '#ef4444',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                      }}
                    >
                      Đổi ảnh khác
                    </button>
                  </div>
                )}
              </div>

              {/* Notice Box */}
              <div style={{
                marginTop: '16px',
                padding: '12px 16px',
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                borderRadius: '8px',
                fontSize: '0.84rem',
                color: 'var(--text-main)',
                lineHeight: 1.5
              }}>
                <strong>Mẹo chụp ảnh đề thi:</strong> Chụp thẳng góc, đủ ánh sáng, rõ nét số thứ tự từng câu hỏi (ví dụ "Câu 1.", "Câu 2.") và các phương án A, B, C, D để đạt độ chính xác cao nhất.
              </div>

              {imageError && (
                <div className="ce-error-banner" style={{ marginTop: '16px' }}>
                  {imageError}
                </div>
              )}

              <div className="ce-form-actions" style={{ marginTop: '24px' }}>
                <button type="button" className="ce-btn-cancel" onClick={onBackToHome}>
                  Hủy
                </button>
                <button
                  type="submit"
                  className="ce-btn-submit"
                  disabled={!imageFile || !examName.trim() || isAnalyzingImage}
                  style={{
                    background: (!imageFile || !examName.trim()) ? 'var(--border-color)' : 'var(--primary-color)',
                    cursor: (!imageFile || !examName.trim()) ? 'not-allowed' : 'pointer'
                  }}
                >
                  Trích xuất đề thi bằng AI
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* MODE 3: CREATE FROM FILE */}
      {createMode === 'pdf' && parsedExamQuestions === null && (
        <div style={{ marginTop: '24px' }}>
          {/* ── STEP 1: Upload form ── */}
          <form onSubmit={handleCreateByFile} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px' }}>
            <div style={{ display: 'inline-block', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: '4px 14px', borderRadius: '20px', fontWeight: 800, fontSize: '0.82rem', marginBottom: '14px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
              Tạo đề từ file
            </div>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>
              Tải lên file đề thi và phân tích tự động
            </h3>

            <div className="ce-top-info" style={{ marginTop: '16px' }}>
              <div className="ce-field-group ce-flex-2">
                <label>Tên đề thi <span className="ce-required">*</span></label>
                <input
                  type="text"
                  className="ce-input"
                  placeholder="Ví dụ: Đề Tài liệu Toán - Chương 3"
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                />
              </div>
              <div className="ce-field-group ce-flex-1">
                <label>Lĩnh vực / Môn học</label>
                <select
                  className="ce-input ce-select"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                >
                  <option value="">Chọn môn học...</option>
                  <option value="Toán học">Toán học</option>
                  <option value="Vật lý">Vật lý</option>
                  <option value="Hóa học">Hóa học</option>
                  <option value="Sinh học">Sinh học</option>
                  <option value="Ngữ văn">Ngữ văn</option>
                  <option value="Tiếng Anh">Tiếng Anh</option>
                  <option value="Lập trình">Lập trình</option>
                </select>
              </div>
              <div className="ce-field-group ce-flex-1">
                <label>Thời gian làm bài (phút) <span className="ce-required">*</span></label>
                <input
                  type="number"
                  min="1"
                  max="300"
                  className="ce-input"
                  value={duration}
                  onChange={(e) => handleDurationChange(parseInt(e.target.value) || 1)}
                />
              </div>
            </div>

            <div style={{ marginTop: '20px', marginBottom: '18px', border: '2px dashed var(--border-color)', borderRadius: '12px', padding: '24px 20px', background: 'var(--bg-primary)' }}>
              <label htmlFor="pdf-file-input" style={{ display: 'block', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
                Tệp đề thi
              </label>
              <input
                id="pdf-file-input"
                ref={pdfFileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt,.md"
                onChange={handlePdfFileChange}
                style={{ width: '100%', color: 'var(--text-main)' }}
              />

              {pdfFile && (
                <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', padding: '10px 12px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{pdfFile.name}</span>
                  <button type="button" onClick={handleClearPdfFile} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-main)', cursor: 'pointer' }}>
                    Bỏ chọn
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '18px' }}>
              <div style={{ minWidth: '160px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--text-main)' }}>Trang bắt đầu</label>
                <input
                  type="number"
                  min="1"
                  className="ce-input"
                  placeholder="Tùy chọn"
                  value={pdfStartPage}
                  onChange={(e) => setPdfStartPage(e.target.value)}
                />
              </div>
              <div style={{ minWidth: '160px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--text-main)' }}>Trang kết thúc</label>
                <input
                  type="number"
                  min="1"
                  className="ce-input"
                  placeholder="Tùy chọn"
                  value={pdfEndPage}
                  onChange={(e) => setPdfEndPage(e.target.value)}
                />
              </div>
            </div>

            <p style={{ margin: '0 0 18px 0', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
              Nếu không nhập, hệ thống sẽ xử lý toàn bộ file. Nếu nhập, phải điền cả bắt đầu và kết thúc và bắt đầu phải nhỏ hơn hoặc bằng kết thúc.
            </p>

            {pdfError && (
              <div className="ce-error-banner" style={{ marginBottom: '18px' }}>
                {pdfError}
              </div>
            )}

            {isParsingPdf ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <div style={{
                  width: '48px', height: '48px',
                  border: '4px solid var(--border-color)',
                  borderTopColor: 'var(--primary-color)',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 16px auto',
                }} />
                <p style={{ color: 'var(--text-main)', fontWeight: 700, marginBottom: '4px' }}>Đang phân tích file...</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem' }}>Hệ thống đang trích xuất câu hỏi và đáp án. Vui lòng chờ.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                <button type="button" onClick={onBackToHome} className="ce-btn-cancel">
                  Quay lại
                </button>
                <button type="submit" className="ce-btn-submit" disabled={!pdfFile} style={{ opacity: !pdfFile ? 0.5 : 1 }}>
                  Phân tích file
                </button>
              </div>
            )}
          </form>
        </div>
      )}

      {/* ── STEP 2: Review & Edit parsed questions (Shared for Image & PDF modes) ── */}
      {parsedExamQuestions !== null && (
        <div style={{ marginTop: '24px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '28px 24px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(245, 158, 11, 0.15)', color: '#d97706', padding: '4px 12px', borderRadius: '6px', fontWeight: 700, fontSize: '0.82rem', marginBottom: '8px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                Bước 2 / 2 — Kiểm tra & chỉnh sửa
              </div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px 0' }}>
                Xem lại {parsedExamQuestions.length} câu hỏi trích xuất từ file
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>
                Chỉnh sửa nội dung câu hỏi, đáp án và đánh dấu đáp án đúng trước khi tạo đề thi.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => { setParsedExamQuestions(null); setApplyPdfError(null); }}
                style={{
                  padding: '10px 18px', borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-main)', fontWeight: 600,
                  cursor: 'pointer', fontSize: '0.88rem',
                }}
              >
                ← Sửa lại file
              </button>
              <button
                type="button"
                onClick={handleAddParsedQuestion}
                style={{
                  padding: '10px 18px', borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-main)', fontWeight: 600,
                  cursor: 'pointer', fontSize: '0.88rem',
                }}
              >
                + Thêm câu hỏi
              </button>
            </div>
          </div>

          {/* Exam info summary banner */}
          <div style={{
            padding: '14px 18px',
            background: 'rgba(99, 102, 241, 0.07)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            borderRadius: '10px',
            marginBottom: '24px',
            display: 'flex', flexWrap: 'wrap', gap: '24px',
          }}>
            <div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Tên đề thi</span>
              <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.92rem' }}>{examName || '(chưa nhập)'}</span>
            </div>
            <div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Môn học</span>
              <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.92rem' }}>{domain || '(chưa chọn)'}</span>
            </div>
            <div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Thời gian</span>
              <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.92rem' }}>{duration} phút</span>
            </div>
            <div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Số câu hỏi</span>
              <span style={{ fontWeight: 700, color: 'var(--primary-color)', fontSize: '0.92rem' }}>{parsedExamQuestions.length} câu</span>
            </div>
          </div>

          {/* Editable questions list */}
          <div className="ce-questions-list">
            {parsedExamQuestions.map((q, qIndex) => (
              <div key={qIndex} className="ce-q-card" style={{ background: 'var(--bg-primary)' }}>
                <div className="ce-q-card-top">
                  <span className="ce-q-badge">Câu {qIndex + 1}</span>
                  {parsedExamQuestions.length > 1 && (
                    <button
                      type="button"
                      className="ce-btn-remove"
                      onClick={() => handleRemoveParsedQuestion(qIndex)}
                      title="Xóa câu hỏi này"
                    >
                      Xóa câu hỏi
                    </button>
                  )}
                </div>

                <div className="ce-field-group">
                  <label>Nội dung câu hỏi <span className="ce-required">*</span></label>
                  <textarea
                    className="ce-input ce-textarea"
                    placeholder="Nhập nội dung câu hỏi..."
                    rows={2}
                    value={q.question}
                    onChange={(e) => handleParsedQuestionChange(qIndex, 'question', e.target.value)}
                  />
                </div>

                <div className="ce-answers-wrapper">
                  <label className="ce-answers-label">Các lựa chọn đáp án (Tích chọn đáp án đúng):</label>
                  <div className="ce-answers-grid">
                    {q.answers.slice(0, 4).map((ans, aIndex) => {
                      const letter = String.fromCharCode(65 + aIndex);
                      const isCorrect = q.right_answer === aIndex;
                      return (
                        <div key={aIndex} className={`ce-answer-row ${isCorrect ? 'is-correct' : ''}`}>
                          <label className="ce-radio-wrap">
                            <input
                              type="radio"
                              name={`parsed-correct-${qIndex}`}
                              className="ce-radio"
                              checked={isCorrect}
                              onChange={() => handleParsedQuestionChange(qIndex, 'right_answer', aIndex)}
                            />
                            <span className="ce-letter">{letter}</span>
                          </label>
                          <input
                            type="text"
                            className="ce-answer-input"
                            placeholder={`Đáp án ${letter}...`}
                            value={ans}
                            onChange={(e) => handleParsedAnswerChange(qIndex, aIndex, e.target.value)}
                          />
                          {isCorrect && <span className="ce-badge-correct">Đúng</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Error banner */}
          {applyPdfError && (
            <div className="ce-error-banner" style={{ marginTop: '20px' }}>
              {applyPdfError}
            </div>
          )}

          {/* Bottom action bar */}
          <div style={{
            marginTop: '28px',
            padding: '20px 24px',
            background: 'var(--bg-primary)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
          }}>
            <div>
              <p style={{ fontWeight: 700, color: 'var(--text-main)', margin: '0 0 4px 0', fontSize: '0.95rem' }}>
                Bộ đề đã sẵn sàng tạo
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                Nhấn <strong>Áp dụng &amp; Tạo Đề</strong> để lưu đề thi vào hệ thống sau khi đã review xong.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => { setParsedExamQuestions(null); setApplyPdfError(null); }}
                style={{
                  padding: '11px 22px', borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-main)', fontWeight: 600,
                  cursor: 'pointer', fontSize: '0.9rem',
                }}
                disabled={isApplyingPdf}
              >
                ← Sửa lại file
              </button>
              <button
                type="button"
                onClick={handleApplyParsedExam}
                disabled={isApplyingPdf}
                style={{
                  padding: '11px 28px', borderRadius: '8px',
                  border: 'none',
                  background: isApplyingPdf ? 'var(--border-color)' : 'var(--primary-color)',
                  color: '#fff', fontWeight: 700,
                  cursor: isApplyingPdf ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}
              >
                {isApplyingPdf ? (
                  <>
                    <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                    Đang tạo đề...
                  </>
                ) : '✓ Áp dụng & Tạo Đề'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
