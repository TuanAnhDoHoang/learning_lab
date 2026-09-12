import React, { useState, useEffect } from 'react';
import { Exam } from '..';
import { updateExam } from '../api/apicaller';

const DEFAULT_DOMAINS = [
  'Toán học',
  'Vật lý',
  'Hóa học',
  'Lịch sử',
  'Địa lý',
  'Sinh học',
  'Tin học',
  'Ngữ văn',
  'Tiếng Anh',
  'GDCD',
];

interface EditExamModalProps {
  isOpen: boolean;
  exam: Exam | null;
  onClose: () => void;
  onSuccess: (updatedExam: Exam) => void;
}

export const EditExamModal: React.FC<EditExamModalProps> = ({
  isOpen,
  exam,
  onClose,
  onSuccess,
}) => {
  const [examName, setExamName] = useState('');
  const [domain, setDomain] = useState('');
  const [duration, setDuration] = useState<number>(15);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (exam && isOpen) {
      setExamName(exam.name || '');
      const defaultDomain = DEFAULT_DOMAINS[exam.domain_id - 1] || '';
      setDomain(defaultDomain);
      setDuration(exam.duration && exam.duration > 0 ? exam.duration : 15);
      setErrorMsg(null);
    }
  }, [exam, isOpen]);

  if (!isOpen || !exam) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examName.trim()) {
      setErrorMsg('Tên đề thi không được để trống.');
      return;
    }
    if (!domain.trim()) {
      setErrorMsg('Vui lòng chọn hoặc nhập môn học / lĩnh vực.');
      return;
    }
    if (duration < 1) {
      setErrorMsg('Thời gian làm bài phải tối thiểu là 1 phút.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      await updateExam(exam.id, {
        exam_name: examName.trim(),
        domain: domain.trim(),
        duration: Number(duration),
      });

      const updated: Exam = {
        ...exam,
        name: examName.trim(),
        duration: Number(duration),
      };

      onSuccess(updated);
      onClose();
    } catch (err: any) {
      console.error('Lỗi khi cập nhật đề thi:', err);
      setErrorMsg(err.message || 'Không thể cập nhật đề thi. Vui lòng kiểm tra lại quyền hạn.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay open" onClick={onClose} style={{ zIndex: 1100 }}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <button className="modal-close" onClick={onClose} disabled={submitting}>
          &times;
        </button>

        <div className="modal-header">
          <span className="modal-tag">#Chỉnh sửa đề thi</span>
          <h2>Cập nhật thông tin đề thi</h2>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ padding: '0 0 16px 0' }}>
            {errorMsg && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '0.88rem',
                  marginBottom: '16px',
                }}
              >
                {errorMsg}
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>
                Tên đề thi <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                className="ce-input"
                style={{ width: '100%' }}
                placeholder="Nhập tên đề thi..."
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                disabled={submitting}
                autoFocus
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>
                Lĩnh vực / Môn học <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                list="domain-options"
                className="ce-input"
                style={{ width: '100%' }}
                placeholder="Chọn hoặc nhập tên môn học..."
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                disabled={submitting}
              />
              <datalist id="domain-options">
                {DEFAULT_DOMAINS.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>

            <div style={{ marginBottom: '8px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>
                Thời gian làm bài (phút) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="number"
                min="1"
                max="300"
                className="ce-input"
                style={{ width: '100%' }}
                placeholder="15"
                value={duration}
                onChange={(e) => setDuration(Math.max(1, parseInt(e.target.value) || 1))}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="modal-footer" style={{ marginTop: '16px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={submitting}
              style={{ opacity: submitting ? 0.7 : 1 }}
            >
              {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
