import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { validateAnswer } from '../utils/answerValidator';
import { QuizPublic } from '../types';

const firebaseConfig = {
  projectId: 'gen-lang-client-0928069600',
  appId: '1:352732315322:web:537ac9d2c524968bba8c83',
  apiKey: 'AIzaSyDEe5ijNjK-lLkJYYOHAaOxz1a4S0LiV28',
  authDomain: 'gen-lang-client-0928069600.firebaseapp.com',
  storageBucket: 'gen-lang-client-0928069600.firebasestorage.app',
  messagingSenderId: '352732315322',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app, 'ai-studio-bestie-8940a001-204f-471e-a965-b21e8e50073a');

// Helper: SHA-256 hash using browser native Web Crypto API
export async function sha256Hex(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message.trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Helper: Generate random share code
function generateShareCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  let code = '';
  for (let i = 0; i < 7; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Helper: Generate secure management token
function generateManagementToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 28; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export interface DirectPublishResult {
  success: boolean;
  shareCode: string;
  managementToken: string;
  quiz: {
    id: string;
    title: string;
    questionsCount: number;
    createdAt: string;
  };
}

/**
 * Direct publish fallback to Firebase Firestore
 */
export async function publishQuizDirect(
  title: string,
  questions: Array<{ id: string; text: string; position: number }>
): Promise<DirectPublishResult> {
  const shareCode = generateShareCode();
  const managementToken = generateManagementToken();
  const managementTokenHash = await sha256Hex(managementToken);
  const quizId = `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const createdAt = new Date().toISOString();

  const quizDoc = {
    title: title.trim(),
    questions: questions.map((q, idx) => ({
      id: q.id || `q_${idx + 1}`,
      text: q.text.trim(),
      position: idx + 1,
      required: true,
    })),
    shareCode,
    managementTokenHash,
    createdAt,
    updatedAt: createdAt,
  };

  await setDoc(doc(db, 'quizzes', quizId), quizDoc);

  // Cache locally for creator convenience
  try {
    const stored = JSON.parse(localStorage.getItem('bestie_quizzes') || '[]');
    stored.unshift({
      id: quizId,
      title: title.trim(),
      shareCode,
      managementToken,
      createdAt,
    });
    localStorage.setItem('bestie_quizzes', JSON.stringify(stored.slice(0, 20)));
  } catch (_) {}

  return {
    success: true,
    shareCode,
    managementToken,
    quiz: {
      id: quizId,
      title: title.trim(),
      questionsCount: questions.length,
      createdAt,
    },
  };
}

/**
 * Direct fetch of quiz by shareCode from Firebase Firestore
 */
export async function getQuizByShareCodeDirect(shareCode: string): Promise<QuizPublic | null> {
  const q = query(
    collection(db, 'quizzes'),
    where('shareCode', '==', shareCode.trim()),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) {
    return null;
  }
  const docData = snap.docs[0].data();
  return {
    id: snap.docs[0].id,
    title: docData.title,
    questions: docData.questions || [],
    shareCode: docData.shareCode,
    createdAt: docData.createdAt,
  };
}

/**
 * Direct response submission fallback to Firebase Firestore
 */
export async function submitResponseDirect(
  shareCode: string,
  responderName: string,
  answers: Array<{ questionId: string; questionText: string; answerText: string }>
) {
  const quiz = await getQuizByShareCodeDirect(shareCode);
  if (!quiz) {
    throw new Error('Quiz not found');
  }

  // Validate each answer
  for (const ans of answers) {
    const val = validateAnswer(ans.answerText, ans.questionText);
    if (!val.isValid) {
      const err: any = new Error(val.message || 'Please provide an authentic answer.');
      err.questionId = ans.questionId;
      err.reason = val.reason;
      throw err;
    }
  }

  const responseId = `r_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const submittedAt = new Date().toISOString();

  const responseDoc = {
    quizId: quiz.id,
    responderName: responderName.trim(),
    answers: answers.map((a) => ({
      questionId: a.questionId,
      questionText: a.questionText,
      answerText: a.answerText.trim(),
      score: 10,
    })),
    submittedAt,
  };

  await setDoc(doc(db, 'responses', responseId), responseDoc);

  return {
    success: true,
    responseId,
    message: 'Response submitted successfully!',
  };
}

/**
 * Direct management view fetch fallback to Firebase Firestore
 */
export async function getQuizManagementDirect(token: string) {
  const tokenHash = await sha256Hex(token);
  const q = query(
    collection(db, 'quizzes'),
    where('managementTokenHash', '==', tokenHash),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) {
    throw new Error('Invalid or expired management token');
  }

  const quizDoc = snap.docs[0].data();
  const quizId = snap.docs[0].id;

  // Get responses for this quiz
  const qResponses = query(
    collection(db, 'responses'),
    where('quizId', '==', quizId)
  );
  const respSnap = await getDocs(qResponses);
  const responses: any[] = [];
  respSnap.forEach((d) => {
    responses.push({
      _id: d.id,
      id: d.id,
      ...d.data(),
    });
  });

  // Sort by submittedAt descending
  responses.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

  return {
    success: true,
    quiz: {
      id: quizId,
      _id: quizId,
      title: quizDoc.title,
      shareCode: quizDoc.shareCode,
      questions: quizDoc.questions || [],
      createdAt: quizDoc.createdAt,
    },
    responses,
  };
}

/**
 * Direct delete fallback to Firebase Firestore
 */
export async function deleteQuizDirect(token: string) {
  const tokenHash = await sha256Hex(token);
  const q = query(
    collection(db, 'quizzes'),
    where('managementTokenHash', '==', tokenHash),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) {
    throw new Error('Invalid management token');
  }

  const quizId = snap.docs[0].id;
  await deleteDoc(doc(db, 'quizzes', quizId));

  // Delete all associated responses
  const qResponses = query(
    collection(db, 'responses'),
    where('quizId', '==', quizId)
  );
  const respSnap = await getDocs(qResponses);
  const deletePromises: Promise<any>[] = [];
  respSnap.forEach((d) => {
    deletePromises.push(deleteDoc(doc(db, 'responses', d.id)));
  });
  await Promise.all(deletePromises);

  return {
    success: true,
    message: 'Quiz and responses deleted',
  };
}
