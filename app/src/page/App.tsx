import React, { useState, useEffect, useCallback } from 'react';
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
import { RoomPage } from './roompage';
import { ProctorDashboard } from './proctordashboard';
import { Exam, CustomExamData, HostRoleMode } from '..';
import { fetchExams, logoutUser, isAuthenticated } from '../api/apicaller';

// Map domain_id to domain name (matches seed data)
const DOMAIN_MAP: Record<number, string> = {
  1: 'Toán học',
  2: 'Vật lý',
  3: 'Hóa học',
};

interface UserSession {
  userid?: number;
  username: string;
  email: string;
}

interface ActiveExamSession {
  examId: number;
  examName: string;
  customExamData?: CustomExamData | null;
  durationMinutes?: number;
  enableAntiCheat?: boolean;
  roomParticipants?: string[];
  hostRole?: HostRoleMode;
  roomCode?: string;
  roomTitle?: string;
}

export const App: React.FC = () => {
  const [user, setUser] = useState<UserSession | null>(() => {
    const saved = localStorage.getItem('lab_train_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>('Tất cả');
  const [currentTab, setCurrentTab] = useState<'all' | 'short'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeModalExam, setActiveModalExam] = useState<Exam | null>(null);

  // View state: 'home' | 'rooms' | 'login' | 'register'
  const [currentView, setCurrentView] = useState<'home' | 'rooms' | 'login' | 'register'>(() => {
    return isAuthenticated() ? 'home' : 'login';
  });

  const [takingExamSession, setTakingExamSession] = useState<ActiveExamSession | null>(null);

  // Load exams function
  const loadExams = useCallback(() => {
    if (!isAuthenticated()) {
      setCurrentView('login');
      return;
    }

    setLoading(true);
    setError(null);
    fetchExams()
      .then((data: Exam[]) => {
        setExams(data);
      })
      .catch((err) => {
        console.error('Error fetching exams:', err);

        // fetchWithAuth already tried to refresh token.
        // If tokens were cleared (auth failure), redirect to login.
        if (!isAuthenticated()) {
          localStorage.removeItem('lab_train_user');
          setUser(null);
          setCurrentView('login');
          return;
        }

        // Other errors (network, server down): show error with retry
        setError('Không thể tải danh sách đề thi. Vui lòng kiểm tra kết nối server.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Fetch exams on initial mount if authenticated
  useEffect(() => {
    if (currentView === 'home' && isAuthenticated()) {
      loadExams();
    }
  }, [currentView, loadExams]);

  // Handle login success
  const handleLoginSuccess = (userData?: UserSession) => {
    if (userData) {
      setUser(userData);
      localStorage.setItem('lab_train_user', JSON.stringify(userData));
    }
    setCurrentView('home');
  };

  // Handle logout
  const handleLogout = async () => {
    await logoutUser();
    localStorage.removeItem('lab_train_user');
    setUser(null);
    setExams([]);
    setTakingExamSession(null);
    setCurrentView('login');
  };

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

  // Handle starting an exam from library modal
  const handleStartExamFromModal = (exam: Exam) => {
    setActiveModalExam(null); // Close modal
    setTakingExamSession({
      examId: exam.id,
      examName: exam.name,
      customExamData: null,
      hostRole: 'participant',
    });
  };

  // Handle starting an exam from Room
  const handleStartExamFromRoom = (
    examId: number,
    examName: string,
    customExamData?: CustomExamData | null,
    durationMinutes?: number,
    enableAntiCheat?: boolean,
    roomParticipants?: string[],
    hostRole: HostRoleMode = 'participant'
  ) => {
    setTakingExamSession({
      examId,
      examName,
      customExamData,
      durationMinutes,
      enableAntiCheat,
      roomParticipants,
      hostRole,
      roomCode: 'LT-8492',
      roomTitle: `Phòng thi: ${examName}`,
    });
  };

  // If taking an exam or monitoring as Proctor
  if (takingExamSession) {
    if (takingExamSession.hostRole === 'proctor') {
      return (
        <ProctorDashboard
          roomCode={takingExamSession.roomCode || 'LT-8492'}
          roomTitle={takingExamSession.roomTitle || `Phòng thi: ${takingExamSession.examName}`}
          examName={takingExamSession.examName}
          customExamData={takingExamSession.customExamData}
          durationMinutes={takingExamSession.durationMinutes || 15}
          enableAntiCheat={takingExamSession.enableAntiCheat ?? true}
          participants={takingExamSession.roomParticipants || []}
          currentUser={user}
          onEndExam={() => setTakingExamSession(null)}
          onBackToHome={() => setTakingExamSession(null)}
        />
      );
    }

    return (
      <ExamPage
        examId={takingExamSession.examId}
        examName={takingExamSession.examName}
        customExamData={takingExamSession.customExamData}
        durationMinutes={takingExamSession.durationMinutes}
        enableAntiCheat={takingExamSession.enableAntiCheat}
        roomParticipants={takingExamSession.roomParticipants}
        currentUser={user}
        onBack={() => setTakingExamSession(null)}
      />
    );
  }

  // Render Login view
  if (currentView === 'login') {
    return (
      <LoginPage
        onLoginSuccess={handleLoginSuccess}
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

  // Render Room Page view
  if (currentView === 'rooms') {
    return (
      <div className="app-root">
        <Navbar
          currentView={currentView}
          onNavigate={view => setCurrentView(view)}
          user={user}
          onOpenLogin={() => setCurrentView('login')}
          onLogout={handleLogout}
        />
        <RoomPage
          currentUser={user}
          onStartExam={handleStartExamFromRoom}
          onBackToHome={() => setCurrentView('home')}
        />
        <Footer />
      </div>
    );
  }

  // Render Home view
  return (
    <div className="app-root">
      <Navbar
        currentView={currentView}
        onNavigate={view => setCurrentView(view)}
        user={user}
        onOpenLogin={() => setCurrentView('login')}
        onLogout={handleLogout}
      />

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
                  <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>Đang tải danh sách đề thi...</p>
                </div>
              ) : error ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px', color: 'var(--danger, #e74c3c)' }}>
                  <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{error}</p>
                  <button
                    style={{ marginTop: '16px', padding: '8px 24px', cursor: 'pointer' }}
                    onClick={loadExams}
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
        onStartExam={handleStartExamFromModal}
      />

      <Footer />
    </div>
  );
};
