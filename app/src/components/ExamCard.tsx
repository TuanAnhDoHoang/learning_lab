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

// delete exam if owner_id matches current user id
export const canDeleteExam = (exam: Exam, currentUserId: number): boolean => {
  return Boolean(exam?.owner_id && currentUserId && exam.owner_id === currentUserId);
}

// update exam if owner_id matches current user id
export const canUpdateExam = (exam: Exam, currentUserId: number): boolean => {
  return Boolean(exam?.owner_id && currentUserId && exam.owner_id === currentUserId);
}

interface ExamCardProps {
  exam: Exam;
  currentUser?: { username: string; email: string; userid?: number } | null;
  onOpenDetail: (exam: Exam) => void;
  onEdit?: (exam: Exam) => void;
  onDelete?: (exam: Exam) => void;
}

export const ExamCard: React.FC<ExamCardProps> = ({
  exam,
  currentUser,
  onOpenDetail,
  onEdit,
  onDelete,
}) => {
  const domainName = DOMAIN_MAP[exam.domain_id] || `Domain ${exam.domain_id}`;
  const isOwner = Boolean(currentUser?.userid && exam.owner_id === currentUser.userid);

  return (
    <div className="exam-card">
      <div>
        <h3 className="card-title">{exam.name}</h3>
        <div className="card-meta-list">
          <div className="meta-row">
            <span>{domainName}</span>
            {exam.duration && (
              <span style={{ marginLeft: '10px', color: 'var(--text-muted)' }}>
                {exam.duration} phút
              </span>
            )}
          </div>
        </div>
        <div className="card-tags">
          <span className="tag-badge">#{domainName}</span>
          {isOwner && (
            <span
              className="tag-badge"
              style={{
                background: 'rgba(99, 102, 241, 0.15)',
                color: 'var(--primary-color)',
                marginLeft: '6px',
              }}
            >
              Tác giả
            </span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px', alignItems: 'center' }}>
        <button
          className="btn-detail"
          style={{ flex: 1 }}
          onClick={() => onOpenDetail(exam)}
        >
          Chi tiết
        </button>
        {isOwner && (
          <>
            <button
              type="button"
              title="Chỉnh sửa đề thi"
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(exam);
              }}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-surface-hover)',
                color: 'var(--text-main)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.82rem',
              }}
            >
              Sửa
            </button>
            <button
              type="button"
              title="Xóa đề thi"
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(exam);
              }}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.82rem',
              }}
            >
              Xóa
            </button>
          </>
        )}
      </div>
    </div>
  );
};
