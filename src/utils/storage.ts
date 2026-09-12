import { SavedCreatorQuiz } from '../types.ts';

const STORAGE_KEY = 'bestie_creator_quizzes_v1';

export function getSavedCreatorQuizzes(): SavedCreatorQuiz[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.warn('Error reading saved quizzes from local storage', err);
    return [];
  }
}

export function saveCreatorQuiz(quiz: SavedCreatorQuiz): void {
  try {
    const list = getSavedCreatorQuizzes();
    const existingIndex = list.findIndex(q => q.id === quiz.id || q.managementToken === quiz.managementToken);
    if (existingIndex >= 0) {
      list[existingIndex] = quiz;
    } else {
      list.unshift(quiz);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 50)));
  } catch (err) {
    console.warn('Error saving quiz to local storage', err);
  }
}

export function removeSavedCreatorQuiz(managementToken: string): void {
  try {
    const list = getSavedCreatorQuizzes().filter(q => q.managementToken !== managementToken);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('Error removing quiz from local storage', err);
  }
}

export function timeAgo(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

    if (diffSeconds < 45) return 'just now';
    if (diffSeconds < 90) return '1 minute ago';
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return 'recently';
  }
}
