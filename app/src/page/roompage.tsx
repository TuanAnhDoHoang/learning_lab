import React, { useState, useEffect } from 'react';
import { Exam, QuestionPayload, CreateExamPayload } from '../index';
import { fetchExams, createRoom, joinRoom, createExam, isAuthenticated } from '../api/apicaller';

interface RoomPageProps {
  onRoomJoined: (
    roomId: number,
    roomCode: string,
    isHost: boolean,
    examId?: number,
    durationMinutes?: number,
    hostRole?: 'proctor' | 'participant'
  ) => void;
  onBackToHome: () => void;
}

export const RoomPage: React.FC<RoomPageProps> = ({ onRoomJoined }) => {
  /* Active Tab Switch: 'create' | 'join' */
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');

  /* State for Joining */
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  /* State for Creating */
  const [newRoomTitle, setNewRoomTitle] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number>(15);
  const [existingExams, setExistingExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<number | ''>('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  /* Host Role State */
  const [hostRole, setHostRole] = useState<'proctor' | 'participant'>('proctor');

  /* Exam Source Mode: existing vs custom */
  const [examSourceMode, setExamSourceMode] = useState<'existing' | 'custom'>('existing');
  
  /* Custom Exam Builder State */
  const [customExamName, setCustomExamName] = useState('');
  const [customDomain, setCustomDomain] = useState('Toán học');
  const [customQuestions, setCustomQuestions] = useState<QuestionPayload[]>([
    { question: '', answers: ['', '', '', ''], right_answer: 0 }
  ]);

  // Load existing exams on mount
  useEffect(() => {
    fetchExams()
      .then((data: Exam[]) => {
        setExistingExams(data);
        if (data.length > 0) {
          setSelectedExamId(data[0].id);
        }
      })
      .catch((err) => {
        console.error('Error fetching exams for room:', err);
      });
  }, []);

  const handleAddQuestion = () => {
    setCustomQuestions([
      ...customQuestions,
      { question: '', answers: ['', '', '', ''], right_answer: 0 }
    ]);
  };

  const handleRemoveQuestion = (index: number) => {
    if (customQuestions.length === 1) return;
    const newQuestions = [...customQuestions];
    newQuestions.splice(index, 1);
    setCustomQuestions(newQuestions);
  };

  const handleQuestionContentChange = (index: number, value: string) => {
    const newQuestions = [...customQuestions];
    newQuestions[index] = { ...newQuestions[index], question: value };
    setCustomQuestions(newQuestions);
  };

  const handleAnswerChange = (qIndex: number, aIndex: number, value: string) => {
    const newQuestions = [...customQuestions];
    const newAnswers = [...newQuestions[qIndex].answers];
    newAnswers[aIndex] = value;
    newQuestions[qIndex].answers = newAnswers;
    setCustomQuestions(newQuestions);
  };

  const handleRightAnswerChange = (qIndex: number, aIndex: number) => {
    const newQuestions = [...customQuestions];
    newQuestions[qIndex] = { ...newQuestions[qIndex], right_answer: aIndex };
    setCustomQuestions(newQuestions);
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);
    if (!joinCodeInput.trim()) return;

    if (!isAuthenticated()) {
      setJoinError('Phiên đăng nhập đã hết hạn hoặc chưa đăng nhập. Vui lòng đăng nhập lại.');
      return;
    }

    setIsJoining(true);
    try {
      const res = await joinRoom({ room_code: joinCodeInput.trim() });
      onRoomJoined(res.room_id, joinCodeInput.trim(), false);
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('JWT') || msg.includes('token') || msg.includes('header') || msg.includes('Unauthorized')) {
        setJoinError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để vào phòng thi.');
      } else {
        setJoinError(msg || 'Lỗi khi tham gia phòng');
      }
    } finally {
      setIsJoining(false);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!isAuthenticated()) {
      setCreateError('Phiên đăng nhập đã hết hạn hoặc chưa đăng nhập. Vui lòng đăng nhập lại.');
      return;
    }

    if (!newRoomTitle.trim()) {
      setCreateError('Vui lòng nhập tên phòng thi');
      return;
    }
    if (durationMinutes < 1) {
      setCreateError('Thời gian thi không hợp lệ');
      return;
    }

    setIsCreating(true);
    try {
      let examIdToUse: number;

      if (examSourceMode === 'custom') {
        // Validate custom exam
        if (!customExamName.trim()) {
          setCreateError('Vui lòng nhập tên đề thi');
          setIsCreating(false);
          return;
        }
        for (let i = 0; i < customQuestions.length; i++) {
          const q = customQuestions[i];
          if (!q.question.trim()) {
            setCreateError(`Câu hỏi ${i + 1} không được để trống`);
            setIsCreating(false);
            return;
          }
          for (let j = 0; j < 4; j++) {
            if (!q.answers[j].trim()) {
              setCreateError(`Câu hỏi ${i + 1}: Đáp án ${String.fromCharCode(65 + j)} không được để trống`);
              setIsCreating(false);
              return;
            }
          }
        }

        // Call createExam API
        const payload: CreateExamPayload = {
          exam_name: customExamName.trim(),
          domain: customDomain.trim(),
          questions: customQuestions,
          duration: durationMinutes, // duration in minutes
        };
        const examRes = await createExam(payload);
        examIdToUse = examRes.exam_id;
      } else {
        if (!selectedExamId) {
          setCreateError('Vui lòng chọn đề thi có sẵn');
          setIsCreating(false);
          return;
        }
        examIdToUse = Number(selectedExamId);
      }

      // Create Room
      const res = await createRoom({
        name: newRoomTitle.trim(),
        exam_id: examIdToUse,
        duration: durationMinutes,
      });

      // If host chose 'participant' role, auto-join the room so they are
      // registered in room_member table (backend only adds owner to room table,
      // not room_member). Without this, start_exam_attempt_by_room will fail
      // with "User X is not a member of room Y".
      if (hostRole === 'participant') {
        await joinRoom({ room_code: res.room_code });
      }

      onRoomJoined(res.room_id, res.room_code, true, examIdToUse, durationMinutes, hostRole);
    } catch (err: any) {
      setCreateError(err.message || 'Lỗi khi tạo phòng thi');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="room-page-wrapper">
      <div className="room-page-header" style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h2>Phòng Thi Trực Tuyến</h2>
        
        {/* Navigation Switch Tabs */}
        <div style={{ display: 'inline-flex', background: 'var(--bg-surface)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-color)', marginTop: '16px', gap: '6px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            style={{
              padding: '8px 22px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'create' ? 'var(--primary-color)' : 'transparent',
              color: activeTab === 'create' ? '#fff' : 'var(--text-main)',
              fontWeight: 700,
              fontSize: '0.92rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            Tạo phòng thi mới
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('join')}
            style={{
              padding: '8px 22px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'join' ? 'var(--primary-color)' : 'transparent',
              color: activeTab === 'join' ? '#fff' : 'var(--text-main)',
              fontWeight: 700,
              fontSize: '0.92rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            Tham gia phòng thi
          </button>
        </div>
      </div>

      <div className="room-cards-container" style={{ display: 'flex', justifyContent: 'center' }}>
        {/* CREATE ROOM VIEW */}
        {activeTab === 'create' && (
          <div className="room-card create-card" style={{ width: '100%', maxWidth: examSourceMode === 'custom' ? '700px' : '560px', transition: 'max-width 0.3s ease' }}>
            <div className="room-card-header">
              <h3>Tạo phòng thi mới</h3>
              <p>Dành cho giáo viên / Người tổ chức</p>
            </div>
            <div className="room-card-body">
              <form onSubmit={handleCreateRoom}>
                {createError && <div className="room-alert error">{createError}</div>}
                
                <div className="room-input-group">
                  <label>Tên phòng thi *</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Kiểm tra 15p Toán"
                    value={newRoomTitle}
                    onChange={e => setNewRoomTitle(e.target.value)}
                  />
                </div>

                {/* Host Role Selection */}
                <div className="room-input-group">
                  <label>Vai trò của bạn khi bắt đầu thi</label>
                  <div className="host-role-selector-grid">
                    <div
                      className={`role-select-card ${hostRole === 'proctor' ? 'selected' : ''}`}
                      onClick={() => setHostRole('proctor')}
                    >
                      <div className="role-card-radio">
                        <input
                          type="radio"
                          name="hostRole"
                          checked={hostRole === 'proctor'}
                          onChange={() => setHostRole('proctor')}
                        />
                      </div>
                      <div className="role-card-info">
                        <strong>Giám thị phòng thi</strong>
                        <p>Theo dõi trực tiếp tiến độ thí sinh (Không làm bài thi).</p>
                      </div>
                    </div>

                    <div
                      className={`role-select-card ${hostRole === 'participant' ? 'selected' : ''}`}
                      onClick={() => setHostRole('participant')}
                    >
                      <div className="role-card-radio">
                        <input
                          type="radio"
                          name="hostRole"
                          checked={hostRole === 'participant'}
                          onChange={() => setHostRole('participant')}
                        />
                      </div>
                      <div className="role-card-info">
                        <strong>Tham gia làm bài</strong>
                        <p>Làm bài cùng mọi người và tham gia tranh hạng.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Exam Source Mode Tab */}
                <div className="room-input-group" style={{ marginTop: '16px' }}>
                  <label>Nguồn đề thi</label>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                    <button
                      type="button"
                      onClick={() => setExamSourceMode('existing')}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: examSourceMode === 'existing' ? 'var(--primary-color)' : 'var(--bg-surface)',
                        color: examSourceMode === 'existing' ? '#fff' : 'inherit',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      Chọn đề có sẵn
                    </button>
                    <button
                      type="button"
                      onClick={() => setExamSourceMode('custom')}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: examSourceMode === 'custom' ? 'var(--primary-color)' : 'var(--bg-surface)',
                        color: examSourceMode === 'custom' ? '#fff' : 'inherit',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      Soạn đề mới ngay
                    </button>
                  </div>
                </div>
                
                {/* Option A: Select Existing Exam */}
                {examSourceMode === 'existing' && (
                  <div className="room-input-group">
                    <label>Chọn Đề Thi trong thư viện</label>
                    <select
                      value={selectedExamId}
                      onChange={e => setSelectedExamId(Number(e.target.value))}
                    >
                      <option value="">-- Chọn đề thi --</option>
                      {existingExams.map(ex => (
                        <option key={ex.id} value={ex.id}>
                          {ex.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Option B: Inline Custom Exam Builder */}
                {examSourceMode === 'custom' && (
                  <div className="inline-custom-exam-builder" style={{ background: 'var(--bg-surface-subtle, rgba(0,0,0,0.03))', padding: '16px', borderRadius: '10px', marginBottom: '16px', border: '1px solid var(--border-color)' }}>
                    <div className="room-input-group">
                      <label>Tên đề thi *</label>
                      <input
                        type="text"
                        placeholder="Ví dụ: Đề thi thử Toán 15p"
                        value={customExamName}
                        onChange={e => setCustomExamName(e.target.value)}
                      />
                    </div>

                    <div className="room-input-group">
                      <label>Lĩnh vực / Môn học</label>
                      <select
                        value={customDomain}
                        onChange={e => setCustomDomain(e.target.value)}
                      >
                        <option value="Toán học">Toán học</option>
                        <option value="Vật lý">Vật lý</option>
                        <option value="Hóa học">Hóa học</option>
                        <option value="Tiếng Anh">Tiếng Anh</option>
                        <option value="Tin học">Tin học</option>
                        <option value="Lập trình">Lập trình</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0 10px 0' }}>
                      <strong style={{ fontSize: '0.95rem' }}>Danh sách câu hỏi ({customQuestions.length})</strong>
                      <button
                        type="button"
                        onClick={handleAddQuestion}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          background: 'var(--primary-color)',
                          color: '#fff',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                        }}
                      >
                        + Thêm câu hỏi
                      </button>
                    </div>

                    {customQuestions.map((q, qIdx) => (
                      <div
                        key={qIdx}
                        style={{
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          padding: '12px',
                          marginBottom: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>Câu {qIdx + 1}</span>
                          {customQuestions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveQuestion(qIdx)}
                              style={{ background: 'transparent', border: 'none', color: 'var(--danger, #e74c3c)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                            >
                              Xóa
                            </button>
                          )}
                        </div>

                        <textarea
                          rows={2}
                          placeholder={`Nhập nội dung câu hỏi ${qIdx + 1}...`}
                          value={q.question}
                          onChange={e => handleQuestionContentChange(qIdx, e.target.value)}
                          style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', marginBottom: '8px', boxSizing: 'border-box' }}
                        />

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          {q.answers.map((ans, aIdx) => {
                            const letter = String.fromCharCode(65 + aIdx);
                            const isRight = q.right_answer === aIdx;
                            return (
                              <div
                                key={aIdx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  background: isRight ? 'var(--primary-light, rgba(79, 70, 229, 0.1))' : 'transparent',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  border: `1px solid ${isRight ? 'var(--primary-color)' : 'var(--border-color)'}`,
                                }}
                              >
                                <input
                                  type="radio"
                                  name={`inline_right_ans_${qIdx}`}
                                  checked={isRight}
                                  onChange={() => handleRightAnswerChange(qIdx, aIdx)}
                                  style={{ cursor: 'pointer' }}
                                />
                                <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>{letter}.</span>
                                <input
                                  type="text"
                                  placeholder={`Đáp án ${letter}...`}
                                  value={ans}
                                  onChange={e => handleAnswerChange(qIdx, aIdx, e.target.value)}
                                  style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '0.85rem' }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="room-input-group">
                  <label>Thời gian làm bài (Phút)</label>
                  <input
                    type="number"
                    min={1}
                    value={durationMinutes}
                    onChange={e => setDurationMinutes(Number(e.target.value))}
                  />
                </div>

                <button type="submit" className="btn-create-room" disabled={isCreating}>
                  {isCreating ? 'Đang tạo phòng...' : 'Tạo phòng ngay'}
                </button>

                <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                  Bạn có sẵn mã phòng thi?{' '}
                  <button
                    type="button"
                    onClick={() => setActiveTab('join')}
                    style={{ background: 'transparent', border: 'none', color: 'var(--primary-color)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Tham gia phòng thi ngay
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* JOIN ROOM VIEW */}
        {activeTab === 'join' && (
          <div
            className="room-card join-card"
            style={{
              width: '100%',
              maxWidth: '480px',
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
            }}
          >
            <div
              className="room-card-header"
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                marginBottom: '24px',
              }}
            >
              <h3 style={{ width: '100%', textAlign: 'center', margin: '0 0 8px 0', fontSize: '1.35rem', fontWeight: 800 }}>Tham gia phòng thi</h3>
              <p style={{ width: '100%', textAlign: 'center', margin: 0, minHeight: 'auto', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Dành cho thí sinh</p>
            </div>
            <div className="room-card-body" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <form onSubmit={handleJoinRoom} style={{ width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {joinError && <div className="room-alert error" style={{ width: '100%', textAlign: 'center', boxSizing: 'border-box' }}>{joinError}</div>}
                <div className="room-input-group" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                  <label style={{ textAlign: 'center', width: '100%', fontSize: '0.98rem', fontWeight: 700, margin: '0 0 8px 0' }}>Nhập mã phòng</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: ROOM-1-1234"
                    value={joinCodeInput}
                    onChange={e => setJoinCodeInput(e.target.value.trim())}
                    style={{ textAlign: 'center', fontSize: '1.05rem', letterSpacing: '1px', fontWeight: 600, width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <button type="submit" className="btn-join-room" disabled={isJoining} style={{ width: '100%' }}>
                  {isJoining ? 'Đang vào...' : 'Vào phòng ngay'}
                </button>

                <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.88rem', color: 'var(--text-muted)', width: '100%' }}>
                  Bạn là giáo viên / người tổ chức?{' '}
                  <button
                    type="button"
                    onClick={() => setActiveTab('create')}
                    style={{ background: 'transparent', border: 'none', color: 'var(--primary-color)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Tạo phòng thi mới
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
