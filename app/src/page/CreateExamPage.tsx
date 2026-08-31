import React, { useState } from 'react';
import { CreateExamPayload, QuestionPayload } from '../index';
import { createExam } from '../api/apicaller';

interface CreateExamPageProps {
  onBackToHome: () => void;
}

export const CreateExamPage: React.FC<CreateExamPageProps> = ({ onBackToHome }) => {
  const [examName, setExamName] = useState('');
  const [domain, setDomain] = useState('');
  const [questions, setQuestions] = useState<QuestionPayload[]>([
    { question: '', answers: ['', '', '', ''], right_answer: 0 }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic Validation
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
        questions: questions
      };
      
      await createExam(payload);
      
      // Success, go back to home
      alert('Tạo đề thi thành công!');
      onBackToHome();
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra khi tạo đề thi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ce-container">
      <div className="ce-page-header">
        <h2 className="ce-page-title">Tạo Đề Thi Mới</h2>
      </div>

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
        </div>

        {/* QUESTIONS HEADER */}
        <div className="ce-questions-header">
          <h3 className="ce-questions-title">Danh sách câu<br/>hỏi ({questions.length})</h3>
          <button type="button" className="ce-btn-add" onClick={handleAddQuestion}>
            + Thêm câu hỏi
          </button>
        </div>

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
                    Xóa
                  </button>
                )}
              </div>
              
              <div className="ce-field-group">
                <label>Nội dung câu hỏi <span className="ce-required">*</span></label>
                <textarea 
                  className="ce-input ce-textarea" 
                  placeholder="Nhập nội dung câu hỏi..." 
                  value={q.question}
                  onChange={(e) => handleQuestionChange(qIndex, 'question', e.target.value)}
                />
              </div>

              <div className="ce-answers-wrapper">
                <label className="ce-answers-label">Các lựa chọn đáp án (Tích chọn đáp án đúng):</label>
                <div className="ce-answers-grid">
                  {q.answers.map((ans, aIndex) => {
                    const isCorrect = q.right_answer === aIndex;
                    const letter = String.fromCharCode(65 + aIndex); // A, B, C, D
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
    </div>
  );
};
