import React from 'react';
import { useTheme } from '../context/ThemeContext';

export const Navbar: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="navbar">
      <div className="nav-container">
        <a href="#" className="brand-logo">
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
          <a href="#note-ai" className="nav-item ai-badge">
            <span className="sparkle">✦</span> NOTE AI
          </a>
          <a href="#de-thi" className="nav-item active">Đề thi online</a>
          <a href="#flashcards" className="nav-item">Flashcards</a>
          
          {/* Theme Toggle Switch */}
          <button 
            className="btn-theme-toggle" 
            onClick={toggleTheme} 
            title={`Chuyển sang chế độ ${theme === 'dark' ? 'sáng' : 'tối'}`}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          <button className="btn-login">Đăng nhập</button>
        </nav>
      </div>
    </header>
  );
};
