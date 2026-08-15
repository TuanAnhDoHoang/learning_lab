import React from 'react';

interface NavbarProps {
  currentView?: string;
  onNavigate?: (view: 'home' | 'rooms') => void;
  onOpenLogin?: () => void;
  user?: { username: string; email: string } | null;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView = 'home', onNavigate, onOpenLogin, user, onLogout }) => {

  return (
    <header className="navbar">
      <div className="nav-container">
        <a href="#" className="brand-logo" onClick={(e) => { e.preventDefault(); onNavigate?.('home'); }}>
          <div className="logo-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 15V9C4 5.68629 6.68629 3 10 3H14C17.3137 3 20 5.68629 20 9V15C20 18.3137 17.3137 21 14 21H10C6.68629 21 4 18.3137 4 15Z" stroke="url(#logo-grad)" strokeWidth="2.2"/>
              <path d="M4 11H20" stroke="url(#logo-grad)" strokeWidth="2.2" strokeDasharray="2 2"/>
              <circle cx="8" cy="17" r="1.5" fill="url(#logo-grad)"/>
              <circle cx="16" cy="17" r="1.5" fill="url(#logo-grad)"/>
              <path d="M12 7V9" stroke="url(#logo-grad)" strokeWidth="2" strokeLinecap="round"/>
              <defs>
                <linearGradient id="logo-grad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#6366F1"/>
                  <stop offset="1" stopColor="#06B6D4"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className="brand-name">Lab <span className="accent-text">Train</span></span>
        </a>

        <nav className="nav-links">
          <a
            href="#de-thi"
            className={`nav-item ${currentView === 'home' ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); onNavigate?.('home'); }}
          >
            Đề thi online
          </a>
          <a
            href="#phong-thi"
            className={`nav-item ${currentView === 'rooms' ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); onNavigate?.('rooms'); }}
          >
            Phòng thi
          </a>
          <a href="#note-ai" className="nav-item ai-badge">
            NOTE AI
          </a>
          <a href="#flashcards" className="nav-item">Flashcards</a>

          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>
                {user.username}
              </span>
              <button
                className="btn-login"
                style={{ background: 'var(--bg-surface-hover)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', boxShadow: 'none' }}
                onClick={onLogout}
              >
                Đăng xuất
              </button>
            </div>
          ) : (
            <button className="btn-login" onClick={onOpenLogin}>Đăng nhập</button>
          )}
        </nav>
      </div>
    </header>
  );
};
