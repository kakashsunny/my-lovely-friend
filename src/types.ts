export interface Question {
  id: string;
  text: string;
  position: number;
  required: boolean;
}

export interface QuizPublic {
  id: string;
  title: string;
  questions: Question[];
  createdAt: string;
}

export interface Answer {
  questionId: string;
  answerText: string;
}

export interface QuizResponse {
  _id: string;
  quizId: string;
  responderName: string;
  answers: Answer[];
  submittedAt: string;
}

export interface QuizManagementData {
  id: string;
  title: string;
  shareCode: string;
  questions: Question[];
  createdAt: string;
}

export interface SavedCreatorQuiz {
  id: string;
  title: string;
  shareCode: string;
  managementToken: string;
  createdAt: string;
  questionsCount: number;
}

export interface DatabaseStatusInfo {
  provider: 'mongodb' | 'local';
  isMongoConfigured: boolean;
  isConnectedToMongo: boolean;
  message: string;
  fixGuide?: string;
  totalQuizzes: number;
  totalResponses: number;
}

export interface PlatformStats {
  totalQuizzes: number;
  totalResponses: number;
  dbProvider?: 'mongodb' | 'local';
  isConnectedToMongo?: boolean;
  isMongoConfigured?: boolean;
}

export type ActiveView = 
  | { type: 'landing' }
  | { type: 'create' }
  | { type: 'publish'; shareCode: string; managementToken: string; title: string; questionsCount: number }
  | { type: 'answer'; shareCode: string }
  | { type: 'manage'; token: string };
