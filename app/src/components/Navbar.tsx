import React, { useState, useRef, useEffect } from 'react';

interface NavbarProps {
  currentView?: string;
  onNavigate?: (view: 'home' | 'rooms' | 'create_exam') => void;
  onOpenLogin?: () => void;
  user?: { username: string; email: string } | null;
  onLogout?: () => void;
  onOpenHistory?: () => void;
  onOpenSettings?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView = 'home',
  onNavigate,
  onOpenLogin,
  user,
  onLogout,
  onOpenHistory,
  onOpenSettings,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const firstLetter = user?.username ? user.username.charAt(0).toUpperCase() : 'U';

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
          {user && (
            <a
              href="#tao-de-thi"
              className={`nav-item ${currentView === 'create_exam' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); onNavigate?.('create_exam'); }}
            >
              Tạo đề thi
            </a>
          )}
          <a href="#note-ai" className="nav-item ai-badge">
            NOTE AI
          </a>
          <a href="#flashcards" className="nav-item">Flashcards</a>

          {user ? (
            <div className="user-profile-menu-wrapper" ref={dropdownRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setDropdownOpen(prev => !prev)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  padding: '5px 12px 5px 6px',
                  borderRadius: '24px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <div
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    background: 'var(--primary-color)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                  }}
                >
                  {firstLetter}
                </div>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {user.username}
                </span>
              </button>

              {dropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: '210px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    boxShadow: 'var(--shadow-md, 0 10px 25px rgba(0,0,0,0.15))',
                    padding: '8px 0',
                    zIndex: 1000,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div style={{ padding: '8px 16px 10px 16px', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main)' }}>{user.username}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      onOpenHistory?.();
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 16px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-main)',
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface-hover, rgba(0,0,0,0.04))'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    Lịch sử thi
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      onOpenSettings?.();
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 16px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-main)',
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface-hover, rgba(0,0,0,0.04))'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    Cài đặt
                  </button>

                  <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }}></div>

                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      onLogout?.();
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 16px',
                      background: 'transparent',
                      border: 'none',
                      color: '#ef4444',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button className="btn-login" onClick={onOpenLogin}>Đăng nhập</button>
          )}
        </nav>
      </div>
    </header>
  );
};
