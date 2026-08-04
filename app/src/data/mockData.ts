import { Exam } from '../types';

export const categories = [
  "Tất cả",
  "Algorithm"
];

export const mockExams: Exam[] = [
  {
    id: 1,
    title: "Interview Algorithm",
    category: "Algorithm",
    duration: 39,
    takers: 18,
    comments: 69,
    sections: 18,
    questions: 69,
    tags: ["#Algorithm"],
    isShort: false
  }
];

export const trendingList = [
  { rank: 1, title: "300 Bài Code Thiếu Nhi", takers: "36 lượt thi" },
  { rank: 2, title: "Nhập Môn Lập Trình", takers: "18 lượt thi" },
  { rank: 3, title: "Đề thi Hogwart", takers: "69 lượt thi" }
];
