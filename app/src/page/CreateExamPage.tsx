import React, { useState, useRef } from 'react';
import { CreateExamPayload, QuestionPayload, QuestionAnswer } from '../index';
import { createExam, createExamByImage, fetchQuestions } from '../api/apicaller';

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
  const [extractedQuestions, setExtractedQuestions] = useState<QuestionAnswer[] | null>(null);
  const [createdExamId, setCreatedExamId] = useState<number | null>(null);
  const [quickAnswerInput, setQuickAnswerInput] = useState('');
  const [appliedAnswers, setAppliedAnswers] = useState<number[]>([]);
  const [manualQuickAnswerInput, setManualQuickAnswerInput] = useState('');
  const [manualQuickAnswerMessage, setManualQuickAnswerMessage] = useState<string | null>(null);
  const [showManualQuickInput, setShowManualQuickInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // RAG Reference Document State for Answer Extraction
  const [answerMethodTab, setAnswerMethodTab] = useState<'string' | 'rag_doc'>('string');
  const [ragDocFile, setRagDocFile] = useState<File | null>(null);
  const ragFileInputRef = useRef<HTMLInputElement | null>(null);

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

  /* ── Submit Create Exam by Image ── */
  /* ── Submit Create Exam by Image ── */
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
      // Step 1: Extract questions from image (send answers: [] first so AI parses all questions)
      const res = await createExamByImage(
        {
          exam_name: examName.trim(),
          domain: domain.trim(),
          duration: duration,
          answers: [],
        },
        imageFile
      );

      setCreatedExamId(res.exam_id);

      // Step 2: Fetch the parsed questions so user can review immediately
      try {
        const questionsData = await fetchQuestions(res.exam_id);
        const list: QuestionAnswer[] = Array.isArray(questionsData)
          ? questionsData
          : (questionsData?.questions || []);
        setExtractedQuestions(list);
        setAppliedAnswers(new Array(list.length).fill(-1));
        setQuickAnswerInput('');
      } catch {
        setExtractedQuestions([]);
      }
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

  const handleResetImageMode = () => {
    handleClearImage();
    setExtractedQuestions(null);
    setCreatedExamId(null);
    setAppliedAnswers([]);
    setQuickAnswerInput('');
    setImageError(null);
    setAnswerMethodTab('string');
    setRagDocFile(null);
  };

  const handleSelectQuestionAnswer = (qIndex: number, aIndex: number) => {
    const totalQ = extractedQuestions?.length || 0;
    const next = appliedAnswers.length === totalQ 
      ? [...appliedAnswers] 
      : new Array(totalQ).fill(-1);

    next[qIndex] = next[qIndex] === aIndex ? -1 : aIndex;
    setAppliedAnswers(next);

    // Reconstruct input string
    const parts: string[] = [];
    next.forEach((ansIdx, idx) => {
      if (ansIdx !== undefined && ansIdx >= 0 && ansIdx < 4) {
        parts.push(`${idx + 1}${String.fromCharCode(65 + ansIdx)}`);
      }
    });
    setQuickAnswerInput(parts.join(' '));
  };

  const handleQuickAnswerChange = (val: string) => {
    setQuickAnswerInput(val);
    const parsed = parseQuickAnswerString(val);
    const totalQ = extractedQuestions?.length || 0;
    if (parsed.indices.length > 0) {
      const next = new Array(totalQ).fill(-1);
      parsed.labels.forEach((item) => {
        const qIdx = item.questionNum - 1;
        if (qIdx >= 0 && qIdx < totalQ && item.index >= 0 && item.index < 4) {
          next[qIdx] = item.index;
        }
      });
      setAppliedAnswers(next);
    } else if (!val.trim()) {
      setAppliedAnswers(new Array(totalQ).fill(-1));
    }
  };

  const handleClearQuickAnswers = () => {
    setQuickAnswerInput('');
    setAppliedAnswers(new Array(extractedQuestions?.length || 0).fill(-1));
  };

  const handleTransferToManual = () => {
    if (!extractedQuestions || extractedQuestions.length === 0) return;
    const converted: QuestionPayload[] = extractedQuestions.map((qa, qIndex) => {
      const cleanedAnswers = qa.answers.map((a) => {
        return a.content.replace(/^[A-Da-d][.\s)]*\s*/, '').trim() || a.content;
      });
      while (cleanedAnswers.length < 4) {
        cleanedAnswers.push('');
      }
      const rightAnswer = appliedAnswers[qIndex] !== undefined && appliedAnswers[qIndex] >= 0 && appliedAnswers[qIndex] < 4
        ? appliedAnswers[qIndex]
        : 0;
      return {
        question: qa.question.content,
        answers: cleanedAnswers.slice(0, 4),
        right_answer: rightAnswer,
      };
    });

    setQuestions(converted);
    setCreateMode('manual');
    setExtractedQuestions(null);
    setCreatedExamId(null);
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
              Sắp ra mắt
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
      {createMode === 'image' && (
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
          ) : extractedQuestions !== null ? (
            /* Result Screen: Display Extracted Questions */
            <div style={{ 
              background: 'var(--bg-surface)', 
              border: '1px solid var(--border-color)', 
              borderRadius: '16px', 
              padding: '32px 24px',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(34, 197, 94, 0.12)', color: '#16a34a', padding: '4px 12px', borderRadius: '6px', fontWeight: 700, fontSize: '0.82rem', marginBottom: '8px' }}>
                    Trích xuất thành công
                  </div>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px 0' }}>
                    Đã nhận diện {extractedQuestions.length} câu hỏi (Mã đề #{createdExamId})
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
                    {appliedAnswers.length > 0
                      ? `Đã lưu đề thi và thiết lập đáp án đúng cho ${Math.min(appliedAnswers.length, extractedQuestions.length)}/${extractedQuestions.length} câu hỏi.`
                      : 'Đề thi đã được lưu vào hệ thống. Bạn có thể kiểm tra danh sách câu hỏi và đáp án bên dưới:'}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleTransferToManual}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '8px',
                      border: '1px solid var(--primary-color)',
                      background: 'rgba(99, 102, 241, 0.1)',
                      color: 'var(--primary-color)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: '0.88rem',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    Chỉnh sửa trong Soạn thủ công
                  </button>
                  <button
                    type="button"
                    onClick={handleResetImageMode}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-main)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: '0.88rem',
                    }}
                  >
                    Tạo đề khác
                  </button>
                  <button
                    type="button"
                    onClick={onBackToHome}
                    style={{
                      padding: '10px 22px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'var(--primary-color)',
                      color: '#fff',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: '0.88rem',
                    }}
                  >
                    Hoàn tất & Về danh sách đề
                  </button>
                </div>
              </div>

              {/* TUY CHON THIET LAP BANG DAP AN (OPTIONAL) */}
              <div style={{
                marginTop: '10px',
                marginBottom: '24px',
                padding: '20px 24px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <label style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)', margin: 0 }}>
                    Tùy chọn thiết lập bảng đáp án (Optional)
                  </label>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', background: 'var(--bg-surface)', padding: '3px 10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    Không bắt buộc
                  </span>
                </div>

                {/* Tabs / Tags chuyen doi phuong thuc lay dap an */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setAnswerMethodTab('string')}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid ' + (answerMethodTab === 'string' ? 'var(--primary-color)' : 'var(--border-color)'),
                      background: answerMethodTab === 'string' ? 'var(--primary-color)' : 'var(--bg-surface)',
                      color: answerMethodTab === 'string' ? '#fff' : 'var(--text-main)',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    Nhập chuỗi đáp án (Thủ công)
                  </button>

                  <button
                    type="button"
                    onClick={() => setAnswerMethodTab('rag_doc')}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid ' + (answerMethodTab === 'rag_doc' ? 'var(--primary-color)' : 'var(--border-color)'),
                      background: answerMethodTab === 'rag_doc' ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-surface)',
                      color: answerMethodTab === 'rag_doc' ? 'var(--primary-color)' : 'var(--text-main)',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    Trích xuất từ tài liệu tham khảo (AI RAG)
                  </button>
                </div>

                {/* Tab 1: Nhap chuoi dap an thu cong */}
                {answerMethodTab === 'string' && (
                  <div>
                    <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.5 }}>
                      Cho phép người dùng nhập nhanh chuỗi đáp án nếu có sẵn (ví dụ: 1A, 2B, 3C, 4D... hoặc A B C D), hoặc để trống nếu muốn tạo đề trước rồi chỉnh sửa sau.
                    </p>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        className="ce-input"
                        placeholder="Ví dụ: 1B, 2A, 3B, 4D, 5C, 6B, 7C, 8A hoặc B A B D C B C A"
                        value={quickAnswerInput}
                        onChange={(e) => handleQuickAnswerChange(e.target.value)}
                        style={{ flex: 1, minWidth: '280px', fontFamily: 'monospace', fontSize: '0.95rem' }}
                      />
                      {quickAnswerInput && (
                        <button
                          type="button"
                          onClick={handleClearQuickAnswers}
                          style={{
                            padding: '10px 16px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-surface)',
                            color: 'var(--text-main)',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                          }}
                        >
                          Xóa đáp án
                        </button>
                      )}
                    </div>

                    {/* Live parsed badges */}
                    {(() => {
                      const parsed = parseQuickAnswerString(quickAnswerInput);
                      if (parsed.error && quickAnswerInput.trim()) {
                        return (
                          <div style={{ marginTop: '8px', fontSize: '0.82rem', color: '#ef4444', fontWeight: 600 }}>
                            {parsed.error}
                          </div>
                        );
                      }
                      const activeCount = appliedAnswers.filter((a) => a >= 0 && a < 4).length;
                      if (activeCount > 0) {
                        return (
                          <div style={{ marginTop: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#16a34a' }}>
                                Đã chọn đáp án cho {activeCount}/{extractedQuestions.length} câu:
                              </span>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {appliedAnswers.map((ansIdx, qIdx) => {
                                if (ansIdx < 0 || ansIdx >= 4) return null;
                                return (
                                  <span
                                    key={qIdx}
                                    style={{
                                      fontSize: '0.78rem',
                                      fontWeight: 700,
                                      padding: '3px 8px',
                                      borderRadius: '6px',
                                      background: 'rgba(34, 197, 94, 0.12)',
                                      color: '#16a34a',
                                      border: '1px solid rgba(34, 197, 94, 0.25)',
                                    }}
                                  >
                                    Câu {qIdx + 1}: {String.fromCharCode(65 + ansIdx)}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Đang để trống: Bạn có thể nhập chuỗi đáp án ở trên hoặc click trực tiếp vào các phương án A, B, C, D ở từng câu hỏi bên dưới.
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Tab 2: Trich xuat tu tai lieu tham khao (AI RAG) */}
                {answerMethodTab === 'rag_doc' && (
                  <div>
                    <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.5 }}>
                      Tải lên tài liệu học tập, giáo trình hoặc đề cương (.pdf, .docx, .txt). Hệ thống sẽ sử dụng AI RAG để đọc nội dung tài liệu, tìm kiếm bằng chứng đối chiếu và đưa ra gợi ý đáp án kèm đoạn trích dẫn (citation) để bạn kiểm duyệt.
                    </p>

                    <div style={{
                      border: '2px dashed var(--border-color)',
                      borderRadius: '10px',
                      padding: '24px',
                      textAlign: 'center',
                      background: 'var(--bg-surface)',
                      transition: 'border-color 0.2s ease',
                      marginBottom: '14px',
                    }}>
                      <input
                        type="file"
                        ref={ragFileInputRef}
                        accept=".pdf,.docx,.doc,.txt"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setRagDocFile(file);
                        }}
                      />

                      {!ragDocFile ? (
                        <div>
                          <p style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-main)', margin: '0 0 6px 0' }}>
                            Chọn tài liệu tham khảo (.pdf, .docx, .txt)
                          </p>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 14px 0' }}>
                            Chỉ tải các tài liệu dạng văn bản để AI trích xuất nội dung trực tiếp
                          </p>
                          <button
                            type="button"
                            onClick={() => ragFileInputRef.current?.click()}
                            style={{
                              padding: '8px 18px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              background: 'var(--bg-primary)',
                              color: 'var(--text-main)',
                              fontWeight: 600,
                              fontSize: '0.85rem',
                              cursor: 'pointer',
                            }}
                          >
                            Duyệt file tài liệu
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                          <div style={{ textAlign: 'left' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)', display: 'block' }}>
                              {ragDocFile.name}
                            </span>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              {(ragDocFile.size / 1024).toFixed(1)} KB
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              type="button"
                              onClick={() => ragFileInputRef.current?.click()}
                              style={{
                                padding: '6px 14px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-primary)',
                                color: 'var(--text-main)',
                                fontSize: '0.82rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Đổi file khác
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRagDocFile(null);
                                if (ragFileInputRef.current) ragFileInputRef.current.value = '';
                              }}
                              style={{
                                padding: '6px 14px',
                                borderRadius: '6px',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                background: 'rgba(239, 68, 68, 0.1)',
                                color: '#ef4444',
                                fontSize: '0.82rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Xóa file
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>

              {/* Extracted Questions List */}
              <div className="ce-questions-list">
                {extractedQuestions.map((qa, qIndex) => {
                  const correctIndex = appliedAnswers[qIndex];
                  const hasCorrectAnswer = correctIndex !== undefined && correctIndex >= 0 && correctIndex < qa.answers.length;

                  return (
                    <div key={qIndex} className="ce-q-card" style={{ background: 'var(--bg-primary)' }}>
                      <div className="ce-q-card-top" style={{ marginBottom: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className="ce-q-badge">Câu {qIndex + 1}</span>
                          {hasCorrectAnswer ? (
                            <span style={{
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              padding: '3px 10px',
                              borderRadius: '6px',
                              background: 'rgba(34, 197, 94, 0.15)',
                              color: '#16a34a',
                              border: '1px solid rgba(34, 197, 94, 0.3)',
                            }}>
                              Đáp án đúng: {String.fromCharCode(65 + correctIndex)}
                            </span>
                          ) : (
                            <span style={{
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              padding: '3px 10px',
                              borderRadius: '6px',
                              background: 'var(--bg-surface)',
                              color: 'var(--text-muted)',
                              border: '1px solid var(--border-color)',
                            }}>
                              Chưa gán đáp án
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Click vào phương án để chọn đáp án đúng
                        </span>
                      </div>

                      <p style={{
                        fontWeight: 600,
                        color: 'var(--text-main)',
                        fontSize: '1rem',
                        marginBottom: '16px',
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                      }}>
                        {qa.question.content}
                      </p>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                        {qa.answers.map((ans, aIndex) => {
                          const letter = String.fromCharCode(65 + aIndex);
                          const isSelectedCorrect = hasCorrectAnswer && correctIndex === aIndex;

                          return (
                            <div 
                              key={aIndex} 
                              onClick={() => handleSelectQuestionAnswer(qIndex, aIndex)}
                              style={{ 
                                display: 'flex', 
                                alignItems: 'flex-start', 
                                gap: '12px', 
                                padding: '12px 16px', 
                                background: isSelectedCorrect ? 'rgba(34, 197, 94, 0.08)' : 'var(--bg-surface)', 
                                borderRadius: '10px', 
                                border: isSelectedCorrect ? '2px solid #22c55e' : '1px solid var(--border-color)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                userSelect: 'none',
                              }}
                            >
                              <span style={{ 
                                width: '28px', 
                                height: '28px', 
                                minWidth: '28px',
                                borderRadius: '50%', 
                                background: isSelectedCorrect ? '#22c55e' : 'var(--bg-primary)', 
                                color: isSelectedCorrect ? '#fff' : 'var(--text-main)',
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                fontWeight: 800, 
                                fontSize: '0.85rem',
                                border: isSelectedCorrect ? 'none' : '1px solid var(--border-color)'
                              }}>
                                {letter}
                              </span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <span style={{
                                  fontSize: '0.92rem',
                                  color: 'var(--text-main)',
                                  fontWeight: isSelectedCorrect ? 700 : 400,
                                  lineHeight: 1.5,
                                  display: 'block'
                                }}>
                                  {ans.content}
                                </span>
                                {isSelectedCorrect && (
                                  <span style={{
                                    display: 'inline-block',
                                    marginTop: '4px',
                                    fontSize: '0.72rem',
                                    fontWeight: 800,
                                    color: '#16a34a',
                                    background: 'rgba(34, 197, 94, 0.15)',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                  }}>
                                    Đáp án đúng
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Actions */}
              <div style={{
                marginTop: '28px',
                padding: '20px',
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
                    Bạn muốn chỉnh sửa nội dung câu hỏi hoặc thay đổi đáp án?
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                    Chuyển sang trình Soạn thủ công để kiểm tra từng câu hỏi, tinh chỉnh câu chữ và lưu lại bài thi hoàn chỉnh.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={handleTransferToManual}
                    style={{
                      padding: '10px 20px',
                      borderRadius: '8px',
                      border: '1px solid var(--primary-color)',
                      background: 'var(--primary-color)',
                      color: '#fff',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                    }}
                  >
                    Chuyển sang Soạn thủ công
                  </button>
                  <button
                    type="button"
                    onClick={onBackToHome}
                    style={{
                      padding: '10px 20px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-main)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                    }}
                  >
                    Trở về Trang chủ
                  </button>
                </div>
              </div>
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

      {/* MODE 3: CREATE FROM PDF (COMING SOON) */}
      {createMode === 'pdf' && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '36px 24px', textAlign: 'center', marginTop: '24px' }}>
          <div style={{ display: 'inline-block', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: '4px 14px', borderRadius: '20px', fontWeight: 800, fontSize: '0.82rem', marginBottom: '14px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
            Tính năng đang phát triển — Sắp ra mắt
          </div>
          <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>
            Tạo Đề Thi Tự Động Từ Tài Liệu PDF (AI Parser)
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', maxWidth: '560px', margin: '0 auto 28px auto', lineHeight: 1.6 }}>
            Tải lên tài liệu hoặc bộ đề PDF, AI sẽ tự động phân tích cấu trúc, nhận diện bảng biểu, phân đoạn từng câu hỏi và đáp án đúng.
          </p>

          <div
            style={{
              border: '2px dashed var(--border-color)',
              borderRadius: '12px',
              padding: '40px 20px',
              maxWidth: '520px',
              margin: '0 auto 24px auto',
              background: 'var(--bg-primary)',
              cursor: 'not-allowed',
            }}
          >
            <p style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>Kéo thả tệp PDF vào đây hoặc bấm để chọn tệp</p>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>Hỗ trợ định dạng: PDF tài liệu đề thi (Tối đa 25MB)</p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <button
              type="button"
              onClick={onBackToHome}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-surface)',
                color: 'var(--text-main)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Quay lại
            </button>
            <button
              type="button"
              disabled
              style={{
                padding: '10px 24px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--primary-color)',
                color: '#fff',
                fontWeight: 700,
                opacity: 0.5,
                cursor: 'not-allowed',
              }}
            >
              Phân tích tài liệu PDF (Sắp ra mắt)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
