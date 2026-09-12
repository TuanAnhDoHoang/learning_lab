import React from 'react';
import { Exam } from '..';

// Map domain_id to domain name
const DOMAIN_MAP: Record<number, string> = {
  1: 'Toán học',
  2: 'Vật lý',
  3: 'Hóa học',
  4: 'Lịch sử',
  5: 'Địa lý',
  6: 'Sinh học',
  7: 'Tin học',
  8: 'Ngữ văn',
  9: 'Tiếng Anh',
  10: 'GDCD',
};

interface ExamModalProps {
  exam: Exam | null;
  currentUser?: { username: string; email: string; userid?: number } | null;
  onClose: () => void;
  onStartExam?: (exam: Exam) => void;
  onEdit?: (exam: Exam) => void;
  onDelete?: (exam: Exam) => void;
}

export const ExamModal: React.FC<ExamModalProps> = ({
  exam,
  currentUser,
  onClose,
  onStartExam,
  onEdit,
  onDelete,
}) => {
  if (!exam) return null;

  const domainName = DOMAIN_MAP[exam.domain_id] || `Domain ${exam.domain_id}`;
  const isOwner = Boolean(currentUser?.userid && exam.owner_id === currentUser.userid);

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>&times;</button>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="modal-tag">#{domainName}</span>
            {isOwner && (
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: 'rgba(99, 102, 241, 0.15)',
                  color: 'var(--primary-color)',
                  fontWeight: 700,
                }}
              >
                Đề của bạn
              </span>
            )}
          </div>
          <h2>{exam.name}</h2>
        </div>
        <div className="modal-body">
          <div className="modal-meta-grid">
            <div className="meta-item">
              <div>
                <strong>Lĩnh vực</strong>
                <p>{domainName}</p>
              </div>
            </div>
            <div className="meta-item">
              <div>
                <strong>Mã đề thi</strong>
                <p>#{exam.id}</p>
              </div>
            </div>
            <div className="meta-item">
              <div>
                <strong>Thời lượng</strong>
                <p>{exam.duration ? `${exam.duration} phút` : '15 phút'}</p>
              </div>
            </div>
          </div>

          <div className="modal-desc">
            <p>Bộ đề được biên soạn chuẩn cấu trúc mới nhất của Lab Train. Tích hợp phân tích lỗi sai và gợi ý đáp án tự động từ AI Note Engine.</p>
          </div>

          {isOwner && (
            <div
              style={{
                display: 'flex',
                gap: '10px',
                padding: '12px',
                marginBottom: '16px',
                background: 'var(--bg-primary)',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Quản lý đề thi của bạn:
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEdit?.(exam);
                  }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-main)',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Chỉnh sửa
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onDelete?.(exam);
                  }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Xóa đề
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={() => { if (onStartExam && exam) { onStartExam(exam); } }}>
            Thi Full Test
          </button>
          <button className="btn-primary">Luyện thi rút gọn</button>
        </div>
      </div>
    </div>
  );
};
