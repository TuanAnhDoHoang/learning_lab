// Matches the backend Exam struct: { id: i32, domain_id: i32, owner_id: i32, name: String, duration: i32 }
export interface Exam {
  id: number;
  domain_id: number;
  name: string;
  owner_id: number;
  duration?: number;
}

export interface UpdateExamPayload {
  exam_id: number;
  exam_name: string;
  domain: string;
  duration: number;
}

// For POST /api/new_exam
export interface QuestionPayload {
  question: string;
  answers: string[]; // 4 answers
  right_answer: number; // 0-3 index
}

export interface CreateExamPayload {
  exam_name: string;
  domain: string;
  questions: QuestionPayload[];
  duration: number; // duration in minutes
}

export interface CreateExamByImagePayload {
  exam_name: string;
  domain: string;
  duration: number;
  answers: number[];
}

// Matches the backend Question struct
export interface Question {
  id: number;
  exam_id: number;
  content: string;
}

// Matches the backend Answer struct
export interface Answer {
  id: number;
  question_id: number;
  content: string;
}

export type ThemeMode = 'dark' | 'light';

/* ── Room & Custom Exam Types ── */
export interface CustomQuestion {
  id: number;
  content: string;
  answers: string[];
  rightAnswerIndex: number;
}

export interface CustomExamData {
  domain: string;
  name: string;
  questions: CustomQuestion[];
}

export type HostRoleMode = 'participant' | 'proctor';

export interface ExamRoom {
  code: string;
  title: string;
  hostName: string;
  isHost: boolean;
  hostRole?: HostRoleMode;
  selectedExam: Exam | null;
  customExamData?: CustomExamData | null;
  durationMinutes: number;
  enableAntiCheat: boolean;
  participants: string[];
  status: 'waiting' | 'ready' | 'in-progress';
  owner_id: number;
}

/* ── Anti-Cheat & Room Leaderboard Types ── */
export interface ViolationRecord {
  id: number;
  type: 'tab_switch' | 'exit_fullscreen' | 'copy_paste' | 'devtools' | 'blur' | 'dual_monitor' | 'offline_disconnect';
  message: string;
  timestamp: string;
}

export interface ParticipantResult {
  name: string;
  isCurrentUser: boolean;
  isHost: boolean;
  score: number;
  total: number;
  timeSpentSeconds: number;
  violationsCount: number;
  violationsList: ViolationRecord[];
  status: 'submitted' | 'time_out' | 'disqualified';
}

/* ── Proctor Live Monitoring Types ── */
export type CandidateLiveState = 'active' | 'blurred' | 'offline' | 'submitted' | 'disqualified';

export interface CandidateProgress {
  id: string;
  name: string;
  state: CandidateLiveState;
  answeredCount: number;
  totalQuestions: number;
  violationsCount: number;
  violationsList: ViolationRecord[];
  lastHeartbeat: string;
  timeSpentSeconds: number;
  score?: number;
  bonusMinutesAdded?: number;
}

export interface ProctorActivityEvent {
  id: number;
  timestamp: string;
  candidateName: string;
  type: 'info' | 'warning' | 'danger' | 'success';
  message: string;
}

// Room Management Types
export interface CreateRoomPayload {
    name: string;
    exam_id: number;
    duration: number;
}

export interface CreateRoomResponse {
    room_id: number;
    room_code: string;
}

export interface JoinRoomPayload {
    room_code: string;
}

export interface JoinRoomResponse {
    room_id: number;
}

export interface LeaveRoomPayload {
    room_code: string;
}

export interface LeaveRoomResponse {
    room_id: number;
}

export interface StartRoomPayload {
    room_id: number;
}

export interface StartRoomResponse {
    room_id: number;
    status: string;
    mems: number[];
}

export interface QuestionAnswer {
    question: Question;
    answers: Answer[];
}

export interface ExamContent {
    exam_id: number;
    questions: QuestionAnswer[];
}

export interface StartExamAttemptByRoomResponse {
    exam_attempt_id: number;
    exam_content: ExamContent;
}

export interface RoomMemberScoreItem {
    user_id: number;
    score: {
        score: number;
        sum_of_question: number;
    } | null;
}

export interface RoomScoresResponse {
    room_id: number;
    members: RoomMemberScoreItem[];
}

export interface StartExamAttemptPayload {
    exam_id: number;
}

export interface StartExamAttemptResponse {
    exam_attempt_id: number;
    exam_content: ExamContent;
}

export interface TimeAttemptEndResponse {
    now: number;
    time_end: number;
}

export interface AttemptResponseItem {
    question: string;
    answers: string[];
    user_answer: number | null;
}

export interface ScoreAttemptResponse {
    score: number;
    sum_of_question: number;
}

// room live monitoring
export interface RoomLiveAnswerItem {
  question_id: number;
  answer_id: number | null;
  updated_at: number; // Unix timestamp
}

export interface RoomMemberLiveAnswerItem {
  user_id: number;
  answers: RoomLiveAnswerItem[];
}

export interface RoomLiveSnapshotPayload {
  room_id: number;
  members: RoomMemberLiveAnswerItem[];
}

export * from './components/EditExamModal';
export * from './components/DeleteExamModal';
export * from './hook/useRoomLiveSocket';

