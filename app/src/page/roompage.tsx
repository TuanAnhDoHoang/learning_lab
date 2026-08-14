import React, { useState, useEffect } from 'react';
import { Exam, CustomExamData, CustomQuestion, HostRoleMode } from '..';
import { fetchExams } from '../api/apicaller';

interface RoomPageProps {
  currentUser: { username: string; email: string } | null;
  onStartExam: (
    examId: number,
    examName: string,
    customExamData?: CustomExamData | null,
    durationMinutes?: number,
    enableAntiCheat?: boolean,
    roomParticipants?: string[],
    hostRole?: HostRoleMode
  ) => void;
  onBackToHome: () => void;
}

export const RoomPage: React.FC<RoomPageProps> = ({ currentUser, onStartExam, onBackToHome }) => {
  /* ── Room State ── */
  const [inRoom, setInRoom] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [roomTitle, setRoomTitle] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [participants, setParticipants] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  /* ── Duration & Anti-Cheat Settings ── */
  const [durationMinutes, setDurationMinutes] = useState<number>(15);
  const [customDurationInput, setCustomDurationInput] = useState<string>('15');
  const [enableAntiCheat, setEnableAntiCheat] = useState<boolean>(true);
  const [hostRole, setHostRole] = useState<HostRoleMode>('participant');

  /* ── Form State for Creating / Joining ── */
  const [newRoomTitle, setNewRoomTitle] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [lobbyError, setLobbyError] = useState<string | null>(null);

  /* ── Exam Selection State (For Host) ── */
  const [configTab, setConfigTab] = useState<'existing' | 'upload'>('existing');
  const [uploadMethod, setUploadMethod] = useState<'file' | 'image' | 'manual'>('manual');

  // Existing exams list
  const [existingExams, setExistingExams] = useState<Exam[]>([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [selectedExistingExam, setSelectedExistingExam] = useState<Exam | null>(null);

  // Manual Exam Builder State
  const [customDomain, setCustomDomain] = useState('Toán học');
  const [customExamName, setCustomExamName] = useState('');
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([
    {
      id: 1,
      content: '',
      answers: ['', '', '', ''],
      rightAnswerIndex: 0,
    },
  ]);
  const [appliedCustomExam, setAppliedCustomExam] = useState<CustomExamData | null>(null);
  const [manualFormError, setManualFormError] = useState<string | null>(null);
  const [manualFormSuccess, setManualFormSuccess] = useState<string | null>(null);

  const username = currentUser?.username || 'Thành viên';

  // Load existing exams on mount
  useEffect(() => {
    setLoadingExams(true);
    fetchExams()
      .then((data: Exam[]) => {
        setExistingExams(data);
        if (data.length > 0) {
          setSelectedExistingExam(data[0]);
        }
      })
      .catch((err) => {
        console.error('Error fetching exams for room:', err);
      })
      .finally(() => setLoadingExams(false));
  }, []);

  /* ── Room Actions ── */

  // Generate random 6-character room code like LT-4892
  const generateRoomCode = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `LT-${randomNum}`;
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    setLobbyError(null);

    const title = newRoomTitle.trim() || `Phòng thi của ${username}`;
    const code = generateRoomCode();

    setRoomCode(code);
    setRoomTitle(title);
    setIsHost(true);
    setParticipants([username, 'Nguyễn Văn A', 'Trần Thị B', 'Lê Hoàng C', 'Phạm Minh D']);
    setInRoom(true);
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    setLobbyError(null);

    const code = joinCodeInput.trim().toUpperCase();
    if (!code) {
      setLobbyError('Vui lòng nhập mã phòng thi.');
      return;
    }

    if (code.length < 4) {
      setLobbyError('Mã phòng thi không hợp lệ.');
      return;
    }

    setRoomCode(code);
    setRoomTitle(`Phòng thi ${code}`);
    setIsHost(false);
    setParticipants(['Chủ phòng', username, 'Bạn học C']);
    if (existingExams.length > 0) {
      setSelectedExistingExam(existingExams[0]);
    }
    setInRoom(true);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeaveRoom = () => {
    setInRoom(false);
    setRoomCode('');
    setRoomTitle('');
    setIsHost(false);
    setAppliedCustomExam(null);
    setSelectedExistingExam(existingExams[0] || null);
  };

  /* ── Manual Question Builder Handlers ── */

  const handleAddQuestion = () => {
    setCustomQuestions(prev => [
      ...prev,
      {
        id: prev.length + 1,
        content: '',
        answers: ['', '', '', ''],
        rightAnswerIndex: 0,
      },
    ]);
  };

  const handleRemoveQuestion = (idx: number) => {
    if (customQuestions.length <= 1) return;
    setCustomQuestions(prev => prev.filter((_, i) => i !== idx));
  };

  const handleQuestionContentChange = (idx: number, val: string) => {
    setCustomQuestions(prev => {
      const updated = [...prev];
      updated[idx].content = val;
      return updated;
    });
  };

  const handleAnswerChange = (qIdx: number, aIdx: number, val: string) => {
    setCustomQuestions(prev => {
      const updated = [...prev];
      const answers = [...updated[qIdx].answers];
      answers[aIdx] = val;
      updated[qIdx].answers = answers;
      return updated;
    });
  };

  const handleRightAnswerChange = (qIdx: number, aIdx: number) => {
    setCustomQuestions(prev => {
      const updated = [...prev];
      updated[qIdx].rightAnswerIndex = aIdx;
      return updated;
    });
  };

  const handleApplyManualExam = (e: React.FormEvent) => {
    e.preventDefault();
    setManualFormError(null);
    setManualFormSuccess(null);

    const name = customExamName.trim();
    if (!name) {
      setManualFormError('Vui lòng nhập tên đề thi.');
      return;
    }

    // Validate questions
    for (let i = 0; i < customQuestions.length; i++) {
      const q = customQuestions[i];
      if (!q.content.trim()) {
        setManualFormError(`Câu hỏi số ${i + 1} chưa có nội dung.`);
        return;
      }
      for (let j = 0; j < q.answers.length; j++) {
        if (!q.answers[j].trim()) {
          setManualFormError(`Câu hỏi số ${i + 1} chưa nhập đủ đáp án ${String.fromCharCode(65 + j)}.`);
          return;
        }
      }
    }

    const examData: CustomExamData = {
      domain: customDomain,
      name,
      questions: customQuestions,
    };

    setAppliedCustomExam(examData);
    setSelectedExistingExam(null); // Unselect existing exam
    setManualFormSuccess(`Đã áp dụng đề thi "${name}" (${customQuestions.length} câu hỏi) cho phòng thi thành công!`);
  };

  /* ── Start Exam Handler ── */
  const handleStartExamClick = () => {
    const finalDuration = Math.max(1, durationMinutes || 15);
    if (appliedCustomExam) {
      onStartExam(0, appliedCustomExam.name, appliedCustomExam, finalDuration, enableAntiCheat, participants, hostRole);
    } else if (selectedExistingExam) {
      onStartExam(selectedExistingExam.id, selectedExistingExam.name, null, finalDuration, enableAntiCheat, participants, hostRole);
    }
  };

  // Determine current active exam name
  const currentExamDisplayName = appliedCustomExam
    ? `${appliedCustomExam.name} (${appliedCustomExam.questions.length} câu - Tự tạo)`
    : selectedExistingExam
    ? selectedExistingExam.name
    : 'Chưa chọn đề thi';

  /* ==========================================================================
     VIEW 1: ROOM HUB (Tạo hoặc Tham gia phòng)
     ========================================================================== */
  if (!inRoom) {
    return (
      <div className="room-page-root">
        <div className="room-hero">
          <div className="container">
            <div className="room-hero-content">
              <span className="hero-badge">Multiplayer Exam Room</span>
              <h1 className="room-main-title">
                Phòng Thi <span className="text-gradient">Trực Tuyến</span>
              </h1>
              <p className="room-main-subtitle">
                Tạo phòng thi riêng để thách đấu cùng bạn bè hoặc tổ chức kỳ thi giám sát trực tuyến.
              </p>
            </div>

            {lobbyError && (
              <div className="room-alert error">
                <span>[Cảnh báo]</span> {lobbyError}
              </div>
            )}

            <div className="room-action-grid">
              {/* Card 1: Tạo phòng thi */}
              <div className="room-card create-card">
                <h3>Tạo phòng thi mới</h3>
                <p>Tạo phòng thi riêng, chọn đề hoặc tự tạo câu hỏi và mời thí sinh tham gia.</p>

                <form onSubmit={handleCreateRoom} className="room-form">
                  <div className="room-input-group">
                    <label>Tên phòng thi (Tùy chọn)</label>
                    <input
                      type="text"
                      placeholder={`Ví dụ: Luyện thi Toán cùng ${username}`}
                      value={newRoomTitle}
                      onChange={e => setNewRoomTitle(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn-room-primary">
                    Tạo phòng thi & Nhận mã
                  </button>
                </form>
              </div>

              {/* Card 2: Tham gia phòng thi */}
              <div className="room-card join-card">
                <h3>Tham gia phòng thi</h3>
                <p>Nhập mã phòng (Room Code) do chủ phòng chia sẻ để vào làm bài thi cùng nhau.</p>

                <form onSubmit={handleJoinRoom} className="room-form">
                  <div className="room-input-group">
                    <label>Mã phòng thi</label>
                    <input
                      type="text"
                      placeholder="Nhập mã (Ví dụ: LT-8294)"
                      value={joinCodeInput}
                      onChange={e => setJoinCodeInput(e.target.value.toUpperCase())}
                      maxLength={10}
                    />
                  </div>
                  <button type="submit" className="btn-room-secondary">
                    Vào phòng thi
                  </button>
                </form>
              </div>
            </div>

            {/* Back button */}
            <div className="room-back-wrapper">
              <button className="btn-room-back" onClick={onBackToHome}>
                Quay lại Thư viện đề thi
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ==========================================================================
     VIEW 2: ACTIVE ROOM LOBBY (Phòng chờ & Cấu hình đề)
     ========================================================================== */
  return (
    <div className="room-page-root">
      <div className="room-lobby-container container">
        {/* Lobby Top Bar */}
        <div className="lobby-header-card">
          <div className="lobby-header-left">
            <span className={`role-badge ${isHost ? 'host' : 'member'}`}>
              {isHost ? `Chủ phòng (${hostRole === 'proctor' ? 'Giám thị' : 'Thí sinh'})` : 'Thành viên'}
            </span>
            <h2 className="lobby-room-title">{roomTitle}</h2>
            <p className="lobby-host-info">Tạo bởi: <strong>{isHost ? username : 'Chủ phòng'}</strong></p>
          </div>

          <div className="lobby-header-right">
            {/* Room Code Box */}
            <div className="room-code-box">
              <span className="code-label">MÃ PHÒNG THI</span>
              <div className="code-display">
                <span className="code-text">{roomCode}</span>
                <button
                  className={`btn-copy-code ${copied ? 'copied' : ''}`}
                  onClick={handleCopyCode}
                  title="Sao chép mã phòng"
                >
                  {copied ? 'Đã chép' : 'Sao chép'}
                </button>
              </div>
            </div>

            <button className="btn-leave-room" onClick={handleLeaveRoom}>
              Rời phòng
            </button>
          </div>
        </div>

        {/* Lobby Main Content Grid */}
        <div className="lobby-grid">
          {/* Left Column: Room Details & Participants */}
          <div className="lobby-sidebar">
            {/* Active Exam Status Box */}
            <div className="lobby-card active-exam-card">
              <div className="card-header">
                <h4>Đề thi phòng</h4>
              </div>
              <div className="active-exam-body">
                <div className="active-exam-details">
                  <strong>{currentExamDisplayName}</strong>
                  <span>Thời gian: <strong>{durationMinutes} phút</strong></span>
                  {enableAntiCheat && <span className="anticheat-active-tag">Giám sát chống gian lận: BẬT</span>}
                  {isHost && (
                    <span className="host-role-active-tag">
                      Vai trò: <strong>{hostRole === 'proctor' ? 'Giám thị (Giám sát Live)' : 'Cùng làm bài thi'}</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* Start Button or Waiting Status */}
              <div className="lobby-start-action">
                {isHost ? (
                  <button
                    className="btn-start-exam"
                    onClick={handleStartExamClick}
                    disabled={!selectedExistingExam && !appliedCustomExam}
                  >
                    {hostRole === 'proctor'
                      ? `Mở Bảng Giám Sát Phòng Thi (${durationMinutes}p)`
                      : `Bắt đầu làm bài thi (${durationMinutes}p)`}
                  </button>
                ) : (
                  <div className="waiting-status-box">
                    <span className="pulse-dot"></span>
                    <span>Đang đợi chủ phòng bắt đầu bài thi...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Participants Card */}
            <div className="lobby-card participants-card">
              <div className="card-header">
                <h4>Người tham gia ({participants.length})</h4>
              </div>
              <ul className="participants-list">
                {participants.map((p, idx) => (
                  <li key={idx} className="participant-item">
                    <div className="participant-avatar">{p.charAt(0).toUpperCase()}</div>
                    <span className="participant-name">{p}</span>
                    {idx === 0 && <span className="host-tag">Chủ phòng</span>}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right Column: Host Exam Configuration Panel */}
          <div className="lobby-main">
            {isHost ? (
              <div className="lobby-card exam-config-card">
                <div className="config-card-header">
                  <h3>Cấu hình đề thi & Vai trò Chủ phòng</h3>
                  <p>Chọn đề thi, tùy chỉnh thời gian làm bài và thiết lập vai trò thi đấu hoặc giám thị.</p>
                </div>

                {/* Duration, Host Role & Anti-Cheat Settings Block */}
                <div className="room-settings-banner">
                  {/* Host Role Selection */}
                  <div className="setting-section">
                    <label className="setting-label">Vai trò của Chủ phòng khi bắt đầu thi:</label>
                    <div className="host-role-selector-grid">
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
                          <strong>Cùng tham gia làm bài thi</strong>
                          <p>Chủ phòng tham gia làm bài, tính giờ và xếp hạng điểm cùng các thí sinh khác.</p>
                        </div>
                      </div>

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
                          <strong>Chế độ Giám thị (Giáo viên giám sát)</strong>
                          <p>Chủ phòng KHÔNG thi, mở Bảng giám sát thời gian thực để theo dõi tiến độ, phát hiện mất mạng và bắt vi phạm gian lận.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Duration Presets */}
                  <div className="setting-section">
                    <label className="setting-label">Thời gian làm bài thi:</label>
                    <div className="duration-presets-grid">
                      {[5, 10, 15, 30, 45, 60, 90].map(mins => (
                        <button
                          key={mins}
                          type="button"
                          className={`btn-duration-preset ${durationMinutes === mins ? 'active' : ''}`}
                          onClick={() => {
                            setDurationMinutes(mins);
                            setCustomDurationInput(String(mins));
                          }}
                        >
                          {mins} phút
                        </button>
                      ))}
                    </div>
                    <div className="custom-duration-row">
                      <span>Hoặc nhập tùy chỉnh:</span>
                      <input
                        type="number"
                        min={1}
                        max={180}
                        value={customDurationInput}
                        onChange={e => {
                          const val = e.target.value;
                          setCustomDurationInput(val);
                          const num = parseInt(val, 10);
                          if (!isNaN(num) && num > 0) {
                            setDurationMinutes(num);
                          }
                        }}
                        className="custom-duration-input"
                      />
                      <span>phút</span>
                    </div>
                  </div>

                  {/* Anti-cheat Proctoring Mode Toggle */}
                  <div className="setting-section anticheat-toggle-section">
                    <label className="anticheat-checkbox-label">
                      <input
                        type="checkbox"
                        checked={enableAntiCheat}
                        onChange={e => setEnableAntiCheat(e.target.checked)}
                      />
                      <div className="anticheat-label-text">
                        <strong>Bật Giám sát Chống gian lận (Proctoring Mode)</strong>
                        <p>Tự động phóng to Toàn màn hình khi thi, phát hiện chuyển tab / rời màn hình, chặn chuột phải, tích hợp thời gian ân hạn 4s chống bắt nhầm thông báo.</p>
                      </div>
                    </label>

                    {enableAntiCheat && (
                      <div className="focus-assist-tip-box" style={{ marginTop: '12px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: '10px', padding: '12px 16px', fontSize: '0.84rem', color: 'var(--text-main)', lineHeight: '1.4' }}>
                        <strong>Khuyến nghị trước khi thi:</strong> Hãy bật chế độ <em>Không làm phiền (Focus Assist - Win+N)</em> và tắt các ứng dụng chat (Zalo, Teams, Discord) để tránh thông báo làm gián đoạn bài làm.
                      </div>
                    )}
                  </div>
                </div>

                {/* Primary Option Tabs */}
                <div className="config-primary-tabs">
                  <button
                    className={`config-tab-btn ${configTab === 'existing' ? 'active' : ''}`}
                    onClick={() => setConfigTab('existing')}
                  >
                    Chọn từ bộ đề có sẵn
                  </button>
                  <button
                    className={`config-tab-btn ${configTab === 'upload' ? 'active' : ''}`}
                    onClick={() => setConfigTab('upload')}
                  >
                    Đăng tải đề thi mới
                  </button>
                </div>

                {/* TAB 1: CHỌN ĐỀ CÓ SẴN */}
                {configTab === 'existing' && (
                  <div className="config-tab-content">
                    <p className="tab-hint">Chọn 1 đề thi từ thư viện để áp dụng cho phòng thi:</p>
                    {loadingExams ? (
                      <div className="loading-state">Đang tải danh sách đề thi...</div>
                    ) : existingExams.length > 0 ? (
                      <div className="existing-exams-list">
                        {existingExams.map(exam => {
                          const isSelected = selectedExistingExam?.id === exam.id && !appliedCustomExam;
                          return (
                            <div
                              key={exam.id}
                              className={`existing-exam-item ${isSelected ? 'selected' : ''}`}
                              onClick={() => {
                                setSelectedExistingExam(exam);
                                setAppliedCustomExam(null);
                              }}
                            >
                              <div className="exam-item-info">
                                <span className="exam-item-domain">Domain {exam.domain_id}</span>
                                <h4>{exam.name}</h4>
                              </div>
                              <div className="exam-item-action">
                                {isSelected ? (
                                  <span className="badge-selected">Đang chọn</span>
                                ) : (
                                  <button className="btn-select-exam">Chọn đề này</button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="empty-state">Không có đề thi nào trong thư viện.</p>
                    )}
                  </div>
                )}

                {/* TAB 2: ĐĂNG TẢI ĐỀ THI MỚI (3 PHƯƠNG THỨC) */}
                {configTab === 'upload' && (
                  <div className="config-tab-content">
                    {/* 3 Upload Methods Selector */}
                    <div className="upload-methods-bar">
                      <button
                        className={`method-btn ${uploadMethod === 'file' ? 'active' : ''}`}
                        onClick={() => setUploadMethod('file')}
                      >
                        Gửi file (PDF/Word)
                        <span className="coming-soon-badge">Sắp ra mắt</span>
                      </button>
                      <button
                        className={`method-btn ${uploadMethod === 'image' ? 'active' : ''}`}
                        onClick={() => setUploadMethod('image')}
                      >
                        Gửi ảnh (Scan/AI OCR)
                        <span className="coming-soon-badge">Sắp ra mắt</span>
                      </button>
                      <button
                        className={`method-btn ${uploadMethod === 'manual' ? 'active' : ''}`}
                        onClick={() => setUploadMethod('manual')}
                      >
                        Nhập tay đề thi
                        <span className="active-badge">Khả dụng</span>
                      </button>
                    </div>

                    {/* METHOD 1: GỬI FILE (COMING SOON PREVIEW) */}
                    {uploadMethod === 'file' && (
                      <div className="upload-coming-soon-box">
                        <div className="dropzone-mock">
                          <h4>Tải lên tệp đề thi (PDF / DOCX)</h4>
                          <p>Hệ thống AI sẽ tự động phân tích câu hỏi và tạo đề thi trắc nghiệm.</p>
                          <span className="badge-feature-tag">Tính năng đang được phát triển</span>
                        </div>
                      </div>
                    )}

                    {/* METHOD 2: GỬI ẢNH (COMING SOON PREVIEW) */}
                    {uploadMethod === 'image' && (
                      <div className="upload-coming-soon-box">
                        <div className="dropzone-mock">
                          <h4>Chụp hoặc Tải lên ảnh chụp đề thi</h4>
                          <p>Công nghệ nhận diện văn bản thông minh (AI OCR) trích xuất câu hỏi từ ảnh.</p>
                          <span className="badge-feature-tag">Tính năng đang được phát triển</span>
                        </div>
                      </div>
                    )}

                    {/* METHOD 3: NHẬP TAY ĐỀ THI (HOẠT ĐỘNG HOÀN TOÀN) */}
                    {uploadMethod === 'manual' && (
                      <form onSubmit={handleApplyManualExam} className="manual-exam-form">
                        {manualFormError && (
                          <div className="room-alert error">
                            <span>[Lỗi]</span> {manualFormError}
                          </div>
                        )}
                        {manualFormSuccess && (
                          <div className="room-alert success">
                            <span>[Thành công]</span> {manualFormSuccess}
                          </div>
                        )}

                        {/* General Exam Info */}
                        <div className="form-row-2">
                          <div className="room-input-group">
                            <label>Tên đề thi *</label>
                            <input
                              type="text"
                              placeholder="Ví dụ: Đề kiểm tra 15 phút - Lượng giác"
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
                            </select>
                          </div>
                        </div>

                        {/* Questions Editor List */}
                        <div className="questions-builder-header">
                          <h4>Danh sách câu hỏi ({customQuestions.length})</h4>
                          <button
                            type="button"
                            className="btn-add-question"
                            onClick={handleAddQuestion}
                          >
                            + Thêm câu hỏi
                          </button>
                        </div>

                        <div className="questions-builder-list">
                          {customQuestions.map((q, qIdx) => (
                            <div key={q.id || qIdx} className="question-builder-item">
                              <div className="q-item-header">
                                <span className="q-number">Câu {qIdx + 1}</span>
                                {customQuestions.length > 1 && (
                                  <button
                                    type="button"
                                    className="btn-delete-q"
                                    onClick={() => handleRemoveQuestion(qIdx)}
                                    title="Xóa câu hỏi"
                                  >
                                    Xóa
                                  </button>
                                )}
                              </div>

                              <div className="room-input-group">
                                <label>Nội dung câu hỏi *</label>
                                <textarea
                                  rows={2}
                                  placeholder="Nhập nội dung câu hỏi..."
                                  value={q.content}
                                  onChange={e => handleQuestionContentChange(qIdx, e.target.value)}
                                />
                              </div>

                              {/* Answers & Correct Selection */}
                              <div className="answers-builder-grid">
                                <label className="answers-label">
                                  Các lựa chọn đáp án (Tích chọn đáp án đúng):
                                </label>
                                {q.answers.map((ans, aIdx) => {
                                  const letter = String.fromCharCode(65 + aIdx);
                                  const isRight = q.rightAnswerIndex === aIdx;
                                  return (
                                    <div
                                      key={aIdx}
                                      className={`answer-builder-row ${isRight ? 'is-correct' : ''}`}
                                    >
                                      <label className="radio-container" title="Chọn làm đáp án đúng">
                                        <input
                                          type="radio"
                                          name={`right-answer-${qIdx}`}
                                          checked={isRight}
                                          onChange={() => handleRightAnswerChange(qIdx, aIdx)}
                                        />
                                        <span className="radio-letter">{letter}</span>
                                      </label>
                                      <input
                                        type="text"
                                        placeholder={`Đáp án ${letter}...`}
                                        value={ans}
                                        onChange={e => handleAnswerChange(qIdx, aIdx, e.target.value)}
                                      />
                                      {isRight && <span className="correct-tag">Đúng</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Submit Custom Exam */}
                        <div className="form-submit-row">
                          <button type="submit" className="btn-apply-custom-exam">
                            Áp dụng đề thi này cho phòng
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Member View Info */
              <div className="lobby-card member-info-card">
                <div className="member-view-content">
                  <h3>Chào mừng bạn đến phòng thi!</h3>
                  <p>
                    Chủ phòng đang chuẩn bị đề thi và cấu hình bài làm. Hãy sẵn sàng, bài thi sẽ tự động bắt đầu khi chủ phòng bấm kích hoạt!
                  </p>
                  <div className="room-tip-box">
                    <strong>Lưu ý:</strong> Đảm bảo kết nối mạng ổn định trước khi bài thi bắt đầu. Mỗi bài thi có thời gian quy định.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
