import React from 'react';
import { Exam } from '..';

// Map domain_id to domain name
const DOMAIN_MAP: Record<number, string> = {
  1: 'Toán học',
  2: 'Vật lý',
  3: 'Hóa học',
};

interface ExamModalProps {
  exam: Exam | null;
  onClose: () => void;
  onStartExam?: (exam: Exam) => void;
}

export const ExamModal: React.FC<ExamModalProps> = ({ exam, onClose, onStartExam }) => {
  if (!exam) return null;

  const domainName = DOMAIN_MAP[exam.domain_id] || `Domain ${exam.domain_id}`;

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>&times;</button>
        <div className="modal-header">
          <span className="modal-tag">#{domainName}</span>
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
          </div>
          <div className="modal-desc">
            <p>Bộ đề được biên soạn chuẩn cấu trúc mới nhất của Lab Train. Tích hợp phân tích lỗi sai và gợi ý đáp án tự động từ AI Note Engine.</p>
          </div>
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
