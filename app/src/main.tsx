import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './page/App';
import { ThemeProvider } from './context/ThemeContext';
import { ThemeToggle } from './components/ThemeToggle';
import './style/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
      <ThemeToggle />
    </ThemeProvider>
  </React.StrictMode>
);
