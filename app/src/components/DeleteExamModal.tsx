import React, { useState } from 'react';
import { Exam } from '..';
import { deleteExam } from '../api/apicaller';

interface DeleteExamModalProps {
  isOpen: boolean;
  exam: Exam | null;
  onClose: () => void;
  onSuccess: (deletedExamId: number) => void;
}

export const DeleteExamModal: React.FC<DeleteExamModalProps> = ({
  isOpen,
  exam,
  onClose,
  onSuccess,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !exam) return null;

  const handleConfirmDelete = async () => {
    setSubmitting(true);
    setErrorMsg(null);

    try {
      await deleteExam(exam.id);
      onSuccess(exam.id);
      onClose();
    } catch (err: any) {
      console.error('Lỗi khi xóa đề thi:', err);
      setErrorMsg(err.message || 'Không thể xóa đề thi. Vui lòng kiểm tra lại quyền tác giả.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay open" onClick={onClose} style={{ zIndex: 1100 }}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <button className="modal-close" onClick={onClose} disabled={submitting}>
          &times;
        </button>

        <div className="modal-header">
          <span className="modal-tag" style={{ color: '#ef4444' }}>#Xác nhận xóa</span>
          <h2 style={{ color: '#ef4444' }}>Xóa vĩnh viễn đề thi</h2>
        </div>

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

          <p style={{ color: 'var(--text-main)', fontSize: '0.95rem', marginBottom: '12px' }}>
            Bạn có chắc chắn muốn xóa đề thi: <strong>{exam.name}</strong> (Mã #{exam.id}) không?
          </p>

          <div
            style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '0.84rem',
              color: 'var(--text-muted)',
              lineHeight: 1.5,
            }}
          >
            Lưu ý: Hành động này sẽ xóa vĩnh viễn toàn bộ câu hỏi, danh sách đáp án và cấu hình liên quan đến đề thi này khỏi hệ thống. Thao tác này không thể hoàn tác.
          </div>
        </div>

        <div className="modal-footer" style={{ marginTop: '16px' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            className="btn-danger-exit"
            onClick={handleConfirmDelete}
            disabled={submitting}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Đang xóa...' : 'Xác nhận xóa'}
          </button>
        </div>
      </div>
    </div>
  );
};
