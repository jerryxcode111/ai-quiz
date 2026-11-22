import { QuizPackage, QuizAttemptState, UserApiSettings } from '@/types/quiz';

const STORAGE_KEYS = {
  SAVED_QUIZZES: 'ai_quiz_saved_quizzes_v1',
  ACTIVE_ATTEMPT_PREFIX: 'ai_quiz_active_attempt_',
  API_SETTINGS: 'ai_quiz_api_settings_v1',
  RECENT_QUIZ_ID: 'ai_quiz_recent_id',
};

export function getSavedQuizzes(): QuizPackage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SAVED_QUIZZES);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to read saved quizzes from localStorage', err);
    return [];
  }
}

export function saveQuiz(quizPackage: QuizPackage): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getSavedQuizzes().filter((q) => q.metadata.id !== quizPackage.metadata.id);
    const updated = [quizPackage, ...existing].slice(0, 30); // keep recent 30
    localStorage.setItem(STORAGE_KEYS.SAVED_QUIZZES, JSON.stringify(updated));
    localStorage.setItem(STORAGE_KEYS.RECENT_QUIZ_ID, quizPackage.metadata.id);
  } catch (err) {
    console.error('Failed to save quiz to localStorage', err);
  }
}

export function deleteSavedQuiz(quizId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getSavedQuizzes().filter((q) => q.metadata.id !== quizId);
    localStorage.setItem(STORAGE_KEYS.SAVED_QUIZZES, JSON.stringify(existing));
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_ATTEMPT_PREFIX + quizId);
  } catch (err) {
    console.error('Failed to delete quiz from localStorage', err);
  }
}

export function getQuizById(quizId: string): QuizPackage | null {
  const quizzes = getSavedQuizzes();
  return quizzes.find((q) => q.metadata.id === quizId) || null;
}

export function getActiveAttempt(quizId: string): QuizAttemptState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_ATTEMPT_PREFIX + quizId);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

export function saveActiveAttempt(attempt: QuizAttemptState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      STORAGE_KEYS.ACTIVE_ATTEMPT_PREFIX + attempt.quizId,
      JSON.stringify(attempt)
    );
  } catch (err) {
    console.error('Failed to save active attempt', err);
  }
}

export function clearActiveAttempt(quizId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_ATTEMPT_PREFIX + quizId);
  } catch (err) {
    console.error('Failed to clear active attempt', err);
  }
}

export function getApiSettings(): UserApiSettings {
  if (typeof window === 'undefined') {
    return { apiKey: '', preferredModel: 'openai/gpt-oss-120b', hasCustomKey: false };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.API_SETTINGS);
    if (!raw) return { apiKey: '', preferredModel: 'openai/gpt-oss-120b', hasCustomKey: false };
    const parsed = JSON.parse(raw);
    return {
      apiKey: parsed.apiKey || '',
      preferredModel: parsed.preferredModel || 'openai/gpt-oss-120b',
      hasCustomKey: Boolean(parsed.apiKey && parsed.apiKey.trim().length > 0),
    };
  } catch (err) {
    return { apiKey: '', preferredModel: 'openai/gpt-oss-120b', hasCustomKey: false };
  }
}

export function saveApiSettings(settings: { apiKey: string; preferredModel: string }): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      STORAGE_KEYS.API_SETTINGS,
      JSON.stringify({
        apiKey: settings.apiKey.trim(),
        preferredModel: settings.preferredModel || 'gemini-2.5-flash',
      })
    );
  } catch (err) {
    console.error('Failed to save API settings', err);
  }
}

