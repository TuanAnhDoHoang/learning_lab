const API_BASE = '/api';
const AUTH_BASE = '/auth';

/* ── Token Storage Helpers ── */
const ACCESS_TOKEN_KEY = 'lab_train_access_token';
const REFRESH_TOKEN_KEY = 'lab_train_refresh_token';

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

/* ── Authenticated Fetch Wrapper ── */
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  let token = getAccessToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res = await fetch(url, { ...options, headers });

  // If 401/403, try to refresh token automatically
  if ((res.status === 401 || res.status === 403) && getRefreshToken()) {
    try {
      const tokens = await refreshTokenUser();
      if (tokens?.access_token) {
        headers['Authorization'] = `Bearer ${tokens.access_token}`;
        res = await fetch(url, { ...options, headers });
      }
    } catch {
      clearTokens();
    }
  }

  return res;
}

/* ── API Endpoints ── */

// Fetch exams from the backend API
export async function fetchExams() {
  const res = await fetchWithAuth(`${API_BASE}/exams`);
  if (!res.ok) {
    throw new Error(`Failed to fetch exams: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// Fetch questions for a specific exam from the backend API
export async function fetchQuestions(examId: number) {
  const res = await fetchWithAuth(`${API_BASE}/questions?exam_id=${examId}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch questions: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// Submit score for a specific exam to the backend API
export async function submitScore(payload: { exam_id: number; answers: Record<number, number> }) {
  const res = await fetchWithAuth(`${API_BASE}/score`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Failed to submit score: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// User login function
export async function loginUser(payload: { email: string; password: string }) {
  const res = await fetch(`${AUTH_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorMsg = await res.text().catch(() => res.statusText);
    throw new Error(errorMsg || 'Email hoặc mật khẩu không chính xác.');
  }
  const data = await res.json();
  if (data.access_token && data.refresh_token) {
    setTokens(data.access_token, data.refresh_token);
  }
  return data;
}

// User registration function
export async function registerUser(payload: { email: string; username: string; password: string; role?: string }) {
  const body = {
    email: payload.email,
    username: payload.username,
    password: payload.password,
    role: payload.role || 'user',
  };

  const res = await fetch(`${AUTH_BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errorMsg = await res.text().catch(() => res.statusText);
    throw new Error(errorMsg || 'Đăng ký thất bại.');
  }
  return res.json();
}

// Refresh token function
export async function refreshTokenUser() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error('No refresh token found');
  }

  const res = await fetch(`${AUTH_BASE}/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!res.ok) {
    clearTokens();
    throw new Error('Refresh token invalid or expired');
  }

  const data = await res.json();
  if (data.access_token && data.refresh_token) {
    setTokens(data.access_token, data.refresh_token);
  }
  return data;
}

// Logout function
export async function logoutUser() {
  const refreshToken = getRefreshToken();
  const accessToken = getAccessToken();

  if (refreshToken) {
    await fetch(`${AUTH_BASE}/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    }).catch(() => {
      // Ignore network errors on logout
    });
  }

  clearTokens();
}
