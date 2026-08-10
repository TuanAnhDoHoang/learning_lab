import React, { useState } from 'react';

interface RegisterPageProps {
  onRegisterSuccess: () => void;
  onGoToLogin: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onRegisterSuccess, onGoToLogin }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !email.trim() || !password.trim()) {
      setError('Vui lòng nhập đầy đủ thông tin.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    if (password.length < 9) {
      setError('Mật khẩu phải có ít nhất 9 ký tự.');
      return;
    }

    // TODO: Gọi API register ở đây
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onRegisterSuccess();
    }, 800);
  };

  /* Password strength indicator */
  const getPasswordStrength = (): { level: number; label: string; color: string } => {
    if (!password) return { level: 0, label: '', color: '' };
    let score = 0;
    if (password.length >= 9) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[@$!%*?&#]/.test(password)) score++;

    if (score <= 2) return { level: score, label: 'Yếu', color: '#ef4444' };
    if (score <= 3) return { level: score, label: 'Trung bình', color: '#f59e0b' };
    if (score <= 4) return { level: score, label: 'Mạnh', color: '#22c55e' };
    return { level: score, label: 'Rất mạnh', color: '#06b6d4' };
  };

  const strength = getPasswordStrength();

  return (
    <div className="auth-page">
      {/* Decorative background */}
      <div className="auth-bg-decor">
        <div className="auth-bg-orb orb-1"></div>
        <div className="auth-bg-orb orb-2"></div>
        <div className="auth-bg-orb orb-3"></div>
      </div>

      <div className="auth-container">
        {/* Left side — Branding */}
        <div className="auth-brand-side">
          <div className="auth-brand-content">
            <div className="auth-logo">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 15V9C4 5.68629 6.68629 3 10 3H14C17.3137 3 20 5.68629 20 9V15C20 18.3137 17.3137 21 14 21H10C6.68629 21 4 18.3137 4 15Z" stroke="url(#reg-grad)" strokeWidth="2.2"/>
                <path d="M4 11H20" stroke="url(#reg-grad)" strokeWidth="2.2" strokeDasharray="2 2"/>
                <circle cx="8" cy="17" r="1.5" fill="url(#reg-grad)"/>
                <circle cx="16" cy="17" r="1.5" fill="url(#reg-grad)"/>
                <path d="M12 7V9" stroke="url(#reg-grad)" strokeWidth="2" strokeLinecap="round"/>
                <defs>
                  <linearGradient id="reg-grad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#6366F1"/>
                    <stop offset="1" stopColor="#06B6D4"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h1 className="auth-brand-title">
              Lab <span className="auth-accent">Train</span>
            </h1>
            <p className="auth-brand-desc">
              Tạo tài khoản miễn phí để bắt đầu hành trình luyện thi cùng AI.
            </p>

            <div className="auth-features">
              <div className="auth-feature">
                <span className="feature-icon">🎯</span>
                <div>
                  <strong>Theo dõi tiến độ</strong>
                  <p>Lưu lại lịch sử làm bài và phân tích điểm mạnh/yếu</p>
                </div>
              </div>
              <div className="auth-feature">
                <span className="feature-icon">🏆</span>
                <div>
                  <strong>Bảng xếp hạng</strong>
                  <p>So sánh kết quả với bạn bè và cộng đồng</p>
                </div>
              </div>
              <div className="auth-feature">
                <span className="feature-icon">💡</span>
                <div>
                  <strong>Gợi ý thông minh</strong>
                  <p>AI đề xuất đề thi phù hợp với trình độ của bạn</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right side — Register form */}
        <div className="auth-form-side">
          <div className="auth-form-wrapper">
            <div className="auth-form-header">
              <h2>Tạo tài khoản</h2>
              <p>Đăng ký miễn phí để bắt đầu luyện thi</p>
            </div>

            {error && (
              <div className="auth-error">
                <span>⚠️</span> {error}
              </div>
            )}

            <form className="auth-form" onSubmit={handleSubmit}>
              {/* Username */}
              <div className="form-group">
                <label htmlFor="reg-username">Tên người dùng</label>
                <div className="input-wrapper">
                  <span className="input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  </span>
                  <input
                    id="reg-username"
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="username123"
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="form-group">
                <label htmlFor="reg-email">Email</label>
                <div className="input-wrapper">
                  <span className="input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="4" width="20" height="16" rx="3"/>
                      <path d="M22 7L13.03 12.7a1.94 1.94 0 01-2.06 0L2 7"/>
                    </svg>
                  </span>
                  <input
                    id="reg-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="form-group">
                <label htmlFor="reg-password">Mật khẩu</label>
                <div className="input-wrapper">
                  <span className="input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2"/>
                      <path d="M7 11V7a5 5 0 0110 0v4"/>
                    </svg>
                  </span>
                  <input
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="input-toggle-pw"
                    onClick={() => setShowPassword(p => !p)}
                    tabIndex={-1}
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
                {/* Password strength bar */}
                {password && (
                  <div className="pw-strength">
                    <div className="pw-strength-bar">
                      {[1, 2, 3, 4, 5].map(i => (
                        <div
                          key={i}
                          className="pw-strength-segment"
                          style={{ background: i <= strength.level ? strength.color : 'var(--border-color)' }}
                        />
                      ))}
                    </div>
                    <span className="pw-strength-label" style={{ color: strength.color }}>
                      {strength.label}
                    </span>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="form-group">
                <label htmlFor="reg-confirm">Xác nhận mật khẩu</label>
                <div className="input-wrapper">
                  <span className="input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                  </span>
                  <input
                    id="reg-confirm"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="btn-auth-submit"
                disabled={loading}
              >
                {loading ? (
                  <span className="btn-loading">
                    <span className="btn-spinner"></span> Đang tạo tài khoản...
                  </span>
                ) : 'Tạo tài khoản'}
              </button>
            </form>

            {/* Switch to Login */}
            <p className="auth-switch">
              Đã có tài khoản?{' '}
              <button type="button" className="auth-switch-link" onClick={onGoToLogin}>
                Đăng nhập
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
