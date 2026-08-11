import React from 'react';
import { useTheme } from '../context/ThemeContext';

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      className="btn-theme-toggle"
      onClick={toggleTheme}
      title={`Chuyển sang chế độ ${theme === 'dark' ? 'sáng' : 'tối'}`}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
};
