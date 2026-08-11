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
