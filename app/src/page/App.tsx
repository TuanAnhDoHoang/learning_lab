import React, { useState, useEffect } from 'react';
import { Navbar } from '../components/Navbar';
import { PageHeader } from '../components/PageHeader';
import { CategoryFilters } from '../components/CategoryFilters';
import { SearchBar } from '../components/SearchBar';
import { SubTabs } from '../components/SubTabs';
import { ExamCard } from '../components/ExamCard';
import { Sidebar } from '../components/Sidebar';
import { ExamModal } from '../components/ExamModal';
import { Footer } from '../components/Footer';
import { ExamPage } from './exampage';
import { LoginPage } from './loginpage';
import { RegisterPage } from './registerpage';
import { Exam } from '..';
import { fetchExams } from '../api/apicaller';

// Map domain_id to domain name (matches seed data)
const DOMAIN_MAP: Record<number, string> = {
  1: 'Toán học',
  2: 'Vật lý',
  3: 'Hóa học',
};

export const App: React.FC = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>('Tất cả');
  const [currentTab, setCurrentTab] = useState<'all' | 'short'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeModalExam, setActiveModalExam] = useState<Exam | null>(null);

  // View state: 'home' | 'login' | 'register' | 'exam'
  const [currentView, setCurrentView] = useState<'home' | 'login' | 'register'>('home');
  const [takingExam, setTakingExam] = useState<Exam | null>(null);

  // Fetch exams from backend API
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchExams()
      .then((data: Exam[]) => {
        setExams(data);
      })
      .catch((err) => {
        console.error('Error fetching exams:', err);
        setError('Không thể tải danh sách đề thi. Vui lòng kiểm tra kết nối server.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Derive categories from loaded exams
  const categories = ['Tất cả', ...Array.from(new Set(exams.map(e => DOMAIN_MAP[e.domain_id] || `Domain ${e.domain_id}`)))];

  // Filtering exams based on category and search query
  const filteredExams = exams.filter(exam => {
    const domainName = DOMAIN_MAP[exam.domain_id] || '';
    const matchCat =
      selectedCategory === 'Tất cả' ||
      domainName === selectedCategory;

    const q = searchQuery.trim().toLowerCase();
    const matchSearch =
      !q ||
      exam.name.toLowerCase().includes(q) ||
      domainName.toLowerCase().includes(q);

    return matchCat && matchSearch;
  });

  // Handle starting an exam from modal
  const handleStartExam = (exam: Exam) => {
    setActiveModalExam(null); // Close modal
    setTakingExam(exam);       // Switch to exam page
  };

  // If taking an exam, render ExamPage
  if (takingExam) {
    return (
      <ExamPage
        examId={takingExam.id}
        examName={takingExam.name}
        onBack={() => setTakingExam(null)}
      />
    );
  }

  // Render Login view
  if (currentView === 'login') {
    return (
      <LoginPage
        onLoginSuccess={() => setCurrentView('home')}
        onGoToRegister={() => setCurrentView('register')}
      />
    );
  }

  // Render Register view
  if (currentView === 'register') {
    return (
      <RegisterPage
        onRegisterSuccess={() => setCurrentView('login')}
        onGoToLogin={() => setCurrentView('login')}
      />
    );
  }

  // Render Home view
  return (
    <div className="app-root">
      <Navbar onOpenLogin={() => setCurrentView('login')} />

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
              {loading ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                  <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>⏳ Đang tải danh sách đề thi...</p>
                </div>
              ) : error ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px', color: 'var(--danger, #e74c3c)' }}>
                  <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>❌ {error}</p>
                  <button
                    style={{ marginTop: '16px', padding: '8px 24px', cursor: 'pointer' }}
                    onClick={() => window.location.reload()}
                  >
                    Thử lại
                  </button>
                </div>
              ) : filteredExams.length > 0 ? (
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

      <ExamModal
        exam={activeModalExam}
        onClose={() => setActiveModalExam(null)}
        onStartExam={handleStartExam}
      />

      <Footer />
    </div>
  );
};
