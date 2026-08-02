import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { PageHeader } from './components/PageHeader';
import { CategoryFilters } from './components/CategoryFilters';
import { SearchBar } from './components/SearchBar';
import { SubTabs } from './components/SubTabs';
import { ExamCard } from './components/ExamCard';
import { Sidebar } from './components/Sidebar';
import { ExamModal } from './components/ExamModal';
import { Footer } from './components/Footer';
import { categories, mockExams } from './data/mockData';
import { Exam } from './types';

export const App: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Tất cả');
  const [currentTab, setCurrentTab] = useState<'all' | 'short'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeModalExam, setActiveModalExam] = useState<Exam | null>(null);

  // Filtering exams based on category, sub-tabs, and search query
  const filteredExams = mockExams.filter(exam => {
    const matchCat =
      selectedCategory === 'Tất cả' ||
      exam.category === selectedCategory ||
      exam.tags.some(t => t.toLowerCase().includes(selectedCategory.toLowerCase()));

    const matchTab = currentTab === 'all' || (currentTab === 'short' && exam.isShort);

    const q = searchQuery.trim().toLowerCase();
    const matchSearch =
      !q ||
      exam.title.toLowerCase().includes(q) ||
      exam.tags.some(t => t.toLowerCase().includes(q));

    return matchCat && matchTab && matchSearch;
  });

  return (
    <div className="app-root">
      <Navbar />

      <main className="main-layout">
        <div className="container">
          <PageHeader />

          <CategoryFilters
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />

          <SearchBar onSearch={setSearchQuery} />

          <SubTabs currentTab={currentTab} onTabChange={setCurrentTab} />

          <div className="content-grid">
            <div className="exam-cards-grid">
              {filteredExams.length > 0 ? (
                filteredExams.map(exam => (
                  <ExamCard
                    key={exam.id}
                    exam={exam}
                    onOpenDetail={setActiveModalExam}
                  />
                ))
              ) : (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                  <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>Không tìm thấy đề thi phù hợp</p>
                  <p style={{ fontSize: '0.9rem', marginTop: '8px' }}>Thử thay đổi từ khóa hoặc bộ lọc của bạn.</p>
                </div>
              )}
            </div>

            <Sidebar />
          </div>
        </div>
      </main>

      <ExamModal exam={activeModalExam} onClose={() => setActiveModalExam(null)} />

      <Footer />
    </div>
  );
};
