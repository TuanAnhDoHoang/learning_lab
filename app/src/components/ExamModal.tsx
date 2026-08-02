import React from 'react';
import { Exam } from '../types';

interface ExamModalProps {
  exam: Exam | null;
  onClose: () => void;
}

export const ExamModal: React.FC<ExamModalProps> = ({ exam, onClose }) => {
  if (!exam) return null;

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>&times;</button>
        <div className="modal-header">
          <span className="modal-tag">{exam.tags[0] || '#Algorithm'}</span>
          <h2>{exam.title}</h2>
        </div>
        <div className="modal-body">
          <div className="modal-meta-grid">
            <div className="meta-item">
              <span className="meta-icon">⏱</span>
              <div>
                <strong>Thời gian</strong>
                <p>{exam.duration} phút</p>
              </div>
            </div>
            <div className="meta-item">
              <span className="meta-icon">📝</span>
              <div>
                <strong>Cấu trúc</strong>
                <p>{exam.sections} phần thi | {exam.questions} câu hỏi</p>
              </div>
            </div>
            <div className="meta-item">
              <span className="meta-icon">👥</span>
              <div>
                <strong>Lượt hoàn thành</strong>
                <p>{exam.takers.toLocaleString('vi-VN')} lượt</p>
              </div>
            </div>
          </div>
          <div className="modal-desc">
            <p>Bộ đề được biên soạn chuẩn cấu trúc mới nhất của Lab Train. Tích hợp phân tích lỗi sai và gợi ý đáp án tự động từ AI Note Engine.</p>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary">Thi Full Test</button>
          <button className="btn-primary">Luyện thi rút gọn</button>
        </div>
      </div>
    </div>
  );
};
