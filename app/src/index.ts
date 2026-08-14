// Matches the backend Exam struct: { id: i32, domain_id: i32, name: String }
export interface Exam {
  id: number;
  domain_id: number;
  name: string;
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

export interface ExamRoom {
  code: string;
  title: string;
  hostName: string;
  isHost: boolean;
  selectedExam: Exam | null;
  customExamData?: CustomExamData | null;
  durationMinutes: number;
  enableAntiCheat: boolean;
  participants: string[];
  status: 'waiting' | 'ready' | 'in-progress';
}

/* ── Anti-Cheat & Room Leaderboard Types ── */
export interface ViolationRecord {
  id: number;
  type: 'tab_switch' | 'exit_fullscreen' | 'copy_paste' | 'devtools' | 'blur';
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


