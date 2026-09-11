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
  localStorage.removeItem('lab_train_user');
}

export function isAuthenticated(): boolean {
  return !!getAccessToken() || !!getRefreshToken();
}

/* ── Mutex / Single-flight Promise Lock for Refresh Token ── */
let activeRefreshPromise: Promise<{ access_token: string; refresh_token: string } | null> | null = null;

/* ── Authenticated Fetch Wrapper ── */
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  let token = getAccessToken();

  // If access token is missing but refresh token exists, proactively refresh with mutex
  if (!token && getRefreshToken()) {
    try {
      const tokens = await refreshTokenUser();
      token = tokens?.access_token || null;
    } catch {
      // Refresh failed, proceed without token (backend will respond appropriately)
    }
  }

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res = await fetch(url, { ...options, headers, credentials: 'include' });

  // If 401/403, check if it is truly an expired token vs a business/permission error
  if ((res.status === 401 || res.status === 403) && getRefreshToken()) {
    // Clone response to inspect error text without consuming the stream
    const cloned = res.clone();
    const errorText = await cloned.text().catch(() => '');

    // DO NOT refresh if it's a known permission or business logic error:
    // - "You don't have permission" -> host-only endpoint called by participant
    // - "Room have not start yet"   -> lobby polling before room start
    // - "not a member"              -> room membership check
    // - "not open"                  -> room closed/ongoing
    const isBusinessOrPermissionError =
      errorText.includes("don't have permission") ||
      errorText.includes("not start yet") ||
      errorText.includes("not a member") ||
      errorText.includes("not open");

    if (!isBusinessOrPermissionError) {
      try {
        const tokens = await refreshTokenUser();
        if (tokens?.access_token) {
          headers['Authorization'] = `Bearer ${tokens.access_token}`;
          res = await fetch(url, { ...options, headers, credentials: 'include' });
        }
      } catch {
        // Refresh failed, return original response
      }
    }
  }

  return res;
}

/* ── API Endpoints ── */
import { CreateExamPayload, CreateExamByImagePayload } from '../index';

// Compress image to ensure it is under 1MB for backend upload
export async function compressImage(file: File, maxSizeBytes = 950000): Promise<File> {
  if (file.size <= maxSizeBytes) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Max dimension 1800px to maintain high OCR clarity
      const maxDim = 1800;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(compressedFile);
        },
        'image/jpeg',
        0.85
      );
    };

    img.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

// Create a new exam by image via AI OCR
export async function createExamByImage(
  payload: CreateExamByImagePayload,
  file: File
): Promise<{ exam_id: number }> {
  const optimizedFile = await compressImage(file);
  const formData = new FormData();
  formData.append('payload', JSON.stringify(payload));
  formData.append('image', optimizedFile);

  const res = await fetchWithAuth(`${API_BASE}/new_exam_by_image`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorMsg = await res.text().catch(() => res.statusText);
    throw new Error(errorMsg || 'Không thể tạo đề thi từ ảnh');
  }
  return res.json();
}

// Create a new exam
export async function createExam(payload: CreateExamPayload) {
  const res = await fetchWithAuth(`${API_BASE}/new_exam`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorMsg = await res.text().catch(() => res.statusText);
    throw new Error(`Failed to create exam: ${errorMsg || res.statusText}`);
  }
  return res.json();
}

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

// Refresh token function with single-flight mutex lock
export async function refreshTokenUser() {
  // If a refresh is already in flight, wait for it instead of sending another request
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error('No refresh token found');
  }

  activeRefreshPromise = (async () => {
    try {
      const res = await fetch(`${AUTH_BASE}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!res.ok) {
        // Only clear tokens if the refresh token is truly expired/invalid from server
        if (res.status === 400 || res.status === 401 || res.status === 403) {
          clearTokens();
        }
        throw new Error('Refresh token invalid or expired');
      }

      const data = await res.json();
      if (data.access_token && data.refresh_token) {
        setTokens(data.access_token, data.refresh_token);
      }
      return data;
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
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

// ── Room Management APIs ──
import { 
  CreateRoomPayload, CreateRoomResponse,
  JoinRoomPayload, JoinRoomResponse,
  LeaveRoomPayload, LeaveRoomResponse,
  StartRoomPayload, StartRoomResponse,
  StartExamAttemptByRoomResponse,
  RoomScoresResponse,
  RoomMemberScoreItem,
  StartExamAttemptResponse,
  TimeAttemptEndResponse,
  AttemptResponseItem,
  ScoreAttemptResponse
} from '../index';

export async function createRoom(payload: CreateRoomPayload): Promise<CreateRoomResponse> {
  const res = await fetchWithAuth(`${API_BASE}/create_room`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorMsg = await res.text().catch(() => res.statusText);
    throw new Error(`Failed to create room: ${errorMsg}`);
  }
  return res.json();
}

export async function joinRoom(payload: JoinRoomPayload): Promise<JoinRoomResponse> {
  const res = await fetchWithAuth(`${API_BASE}/join_room`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorMsg = await res.text().catch(() => res.statusText);
    throw new Error(`Failed to join room: ${errorMsg}`);
  }
  return res.json();
}

export async function leaveRoom(payload: LeaveRoomPayload): Promise<LeaveRoomResponse> {
  const res = await fetchWithAuth(`${API_BASE}/leave_room`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorMsg = await res.text().catch(() => res.statusText);
    throw new Error(`Failed to leave room: ${errorMsg}`);
  }
  return res.json();
}

export async function startRoom(payload: StartRoomPayload): Promise<StartRoomResponse> {
  const res = await fetchWithAuth(`${API_BASE}/start_room`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorMsg = await res.text().catch(() => res.statusText);
    throw new Error(`Failed to start room: ${errorMsg}`);
  }
  return res.json();
}

export async function startExamAttemptByRoom(roomId: number): Promise<StartExamAttemptByRoomResponse> {
  const res = await fetchWithAuth(`${API_BASE}/start_exam_attempt_by_room`, {
    method: 'POST',
    body: JSON.stringify({ room_id: roomId }),
  });
  if (!res.ok) {
    // 403 means "Room have not start yet", throw specific error or message to catch in interval
    const errorMsg = await res.text().catch(() => res.statusText);
    const err = new Error(errorMsg);
    (err as any).status = res.status;
    throw err;
  }
  return res.json();
}

export async function saveAttemptAnswer(payload: { exam_attempt_id: number; question_id: number; answer_id: number }) {
  const res = await fetchWithAuth(`${API_BASE}/save_user_answer`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error('Failed to save answer to server');
  }
  return res.json();
}

export async function closeRoom(roomId: number): Promise<void> {
  const res = await fetchWithAuth(`${API_BASE}/close_room`, {
    method: 'POST',
    body: JSON.stringify({ room_id: roomId }),
  });
  if (!res.ok) {
    const errorMsg = await res.text().catch(() => res.statusText);
    throw new Error(`Failed to close room: ${errorMsg}`);
  }
}

export async function fetchRoomScores(roomId: number): Promise<RoomScoresResponse> {
  const res = await fetchWithAuth(`${API_BASE}/room_scores`, {
    method: 'POST',
    body: JSON.stringify({ room_id: roomId }),
  });
  if (!res.ok) {
    const errorMsg = await res.text().catch(() => res.statusText);
    throw new Error(`Failed to fetch room scores: ${errorMsg}`);
  }
  return res.json();
}

export async function fetchRoomByUser(): Promise<{ room_ids: number[] }> {
  const res = await fetchWithAuth(`${API_BASE}/room_by_user`);
  if (!res.ok) {
    const errorMsg = await res.text().catch(() => res.statusText);
    throw new Error(`Failed to fetch user rooms: ${errorMsg}`);
  }
  return res.json();
}

export async function fetchMyRoomScore(roomId: number): Promise<RoomMemberScoreItem> {
  const res = await fetchWithAuth(`${API_BASE}/my_room_score`, {
    method: 'POST',
    body: JSON.stringify({ room_id: roomId }),
  });
  if (!res.ok) {
    const errorMsg = await res.text().catch(() => res.statusText);
    throw new Error(`Failed to fetch my room score: ${errorMsg}`);
  }
  return res.json();
}

// ── Exam Attempt Resilience & Scoring APIs ──

export async function startExamAttempt(examId: number): Promise<StartExamAttemptResponse> {
  const res = await fetchWithAuth(`${API_BASE}/start_exam_attempt`, {
    method: 'POST',
    body: JSON.stringify({ exam_id: examId }),
  });
  if (!res.ok) {
    const errorMsg = await res.text().catch(() => res.statusText);
    throw new Error(`Failed to start exam attempt: ${errorMsg}`);
  }
  return res.json();
}

export async function fetchTimeAttemptEnd(examAttemptId: number): Promise<TimeAttemptEndResponse> {
  const res = await fetchWithAuth(`${API_BASE}/time_attempt_end`, {
    method: 'POST',
    body: JSON.stringify({ exam_attempt_id: examAttemptId }),
  });
  if (!res.ok) {
    const errorMsg = await res.text().catch(() => res.statusText);
    throw new Error(`Failed to get attempt end time: ${errorMsg}`);
  }
  return res.json();
}

export async function fetchAttempt(examAttemptId: number): Promise<AttemptResponseItem[]> {
  const res = await fetchWithAuth(`${API_BASE}/attempt?exam_attempt_id=${examAttemptId}`);
  if (!res.ok) {
    const errorMsg = await res.text().catch(() => res.statusText);
    throw new Error(`Failed to fetch attempt details: ${errorMsg}`);
  }
  return res.json();
}

export async function scoreAttempt(examAttemptId: number): Promise<ScoreAttemptResponse> {
  const res = await fetchWithAuth(`${API_BASE}/score_attempt?exam_attempt_id=${examAttemptId}`);
  if (!res.ok) {
    const errorMsg = await res.text().catch(() => res.statusText);
    throw new Error(`Failed to score attempt: ${errorMsg}`);
  }
  return res.json();
}


