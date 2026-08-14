import React from 'react';
import { Exam } from '..';

// Map domain_id to domain name
const DOMAIN_MAP: Record<number, string> = {
  1: 'Toán học',
  2: 'Vật lý',
  3: 'Hóa học',
};

interface ExamCardProps {
  exam: Exam;
  onOpenDetail: (exam: Exam) => void;
}

export const ExamCard: React.FC<ExamCardProps> = ({ exam, onOpenDetail }) => {
  const domainName = DOMAIN_MAP[exam.domain_id] || `Domain ${exam.domain_id}`;

  return (
    <div className="exam-card">
      <div>
        <h3 className="card-title">{exam.name}</h3>
        <div className="card-meta-list">
          <div className="meta-row">
            <span>{domainName}</span>
          </div>
        </div>
        <div className="card-tags">
          <span className="tag-badge">#{domainName}</span>
        </div>
      </div>
      <button className="btn-detail" onClick={() => onOpenDetail(exam)}>Chi tiết</button>
    </div>
  );
};
