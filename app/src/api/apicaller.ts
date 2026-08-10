const API_BASE = '/api';

// Fetch exams from the backend API
export async function fetchExams() {
  const res = await fetch(`${API_BASE}/exams`);
  if (!res.ok) {
    throw new Error(`Failed to fetch exams: ${res.status} ${res.statusText}`);
  }
  return res.json();
}


// Fetch questions for a specific exam from the backend API
export async function fetchQuestions(examId: number) {
  const res = await fetch(`${API_BASE}/questions?exam_id=${examId}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch questions: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// Submit score for a specific exam to the backend API
export async function submitScore(payload: { exam_id: number; answers: Record<number, number> }) {
  const res = await fetch(`${API_BASE}/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Failed to submit score: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// User authentication functions
export async function loginUser(payload: { email: string; password: string }) {
  const res = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Login failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// User registration function
export async function registerUser(payload: { email: string; name: string; password: string }) {
  const res = await fetch(`${API_BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Registration failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}
