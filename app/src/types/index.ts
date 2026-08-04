export interface Exam {
  id: number;
  title: string;
  category: string;
  duration: number;
  takers: number;
  comments: number;
  sections: number;
  questions: number;
  tags: string[];
  isShort: boolean;
}

export type ThemeMode = 'dark' | 'light';
