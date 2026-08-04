import React from 'react';
import { Exam } from '../types';

interface ExamCardProps {
  exam: Exam;
  onOpenDetail: (exam: Exam) => void;
}

export const ExamCard: React.FC<ExamCardProps> = ({ exam, onOpenDetail }) => {
  return (
    <div className="exam-card">
      <div>
        <h3 className="card-title">{exam.title}</h3>
        <div className="card-meta-list">
          <div className="meta-row">
            <span>⏱ {exam.duration} phút</span>
            <span>|</span>
            <span>👥 {exam.takers.toLocaleString('vi-VN')}</span>
            <span>|</span>
            <span>💬 {exam.comments}</span>
          </div>
        </div>
        <div className="card-structure">
          {exam.sections} phần thi | {exam.questions} câu hỏi
        </div>
        <div className="card-tags">
          {exam.tags.map((tag, idx) => (
            <span key={idx} className="tag-badge">{tag}</span>
          ))}
        </div>
      </div>
      <button className="btn-detail" onClick={() => onOpenDetail(exam)}>Chi tiết</button>
    </div>
  );
};
