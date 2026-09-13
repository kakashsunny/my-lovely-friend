import express from 'express';
import dotenv from 'dotenv';
import {
  getDatabase,
  generateShareCode,
  generateToken,
  hashToken,
  QuestionDoc,
} from './db.ts';
import { validateAnswer } from '../src/utils/answerValidator.ts';

dotenv.config();

export const app = express();
app.use(express.json({ limit: '1mb' }));

// Cross-Origin / Headers Configuration
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Dedicated Router for all Bestie API endpoints
export const apiRouter = express.Router();

// Health check endpoint
apiRouter.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'bestie-backend',
    env: process.env.NODE_ENV || 'development',
    serverless: !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME),
  });
});

// Database Diagnostic & Status Endpoint
apiRouter.get('/db-status', async (req, res) => {
  try {
    const db = await getDatabase();
    const status = await db.getStatus();
    res.json({ success: true, ...status });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to check database status' });
  }
});

// Re-attempt MongoDB Atlas connection on demand
apiRouter.post('/db/retry', async (req, res) => {
  try {
    const db = await getDatabase();
    const connected = await db.reconnectMongo();
    const status = await db.getStatus();
    res.json({ success: true, connected, status });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Reconnect attempt failed' });
  }
});

// Global Real Statistics Endpoint
apiRouter.get('/stats', async (req, res) => {
  try {
    const db = await getDatabase();
    const stats = await db.getStats();
    const dbStatus = await db.getStatus();
    res.json({
      success: true,
      totalQuizzes: stats.totalQuizzes,
      totalResponses: stats.totalResponses,
      dbProvider: dbStatus.provider,
      isConnectedToFirestore: dbStatus.isConnectedToFirestore,
      isFirestoreConfigured: dbStatus.isFirestoreConfigured,
      isConnectedToMongo: dbStatus.isConnectedToMongo,
      isMongoConfigured: dbStatus.isMongoConfigured,
    });
  } catch (err: any) {
    console.error('[Bestie API] Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch platform stats' });
  }
});

// Create a Quiz
apiRouter.post('/quizzes', async (req, res) => {
  try {
    const db = await getDatabase();
    const { title, questions } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Quiz title is required' });
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'At least one question is required' });
    }

    // Sanitize questions
    const sanitizedQuestions: QuestionDoc[] = questions.map((q: any, idx: number) => {
      const text = typeof q.text === 'string' ? q.text.trim() : '';
      if (!text) {
        throw new Error(`Question #${idx + 1} cannot be empty`);
      }
      return {
        id: typeof q.id === 'string' && q.id ? q.id : `q_${idx + 1}_${Date.now()}`,
        text,
        position: typeof q.position === 'number' ? q.position : idx + 1,
        required: q.required !== false,
      };
    });

    // Generate unique shareCode
    let shareCode = generateShareCode(7);
    let attempts = 0;
    while (await db.findQuizByShareCode(shareCode)) {
      shareCode = generateShareCode(7);
      attempts++;
      if (attempts > 10) {
        shareCode = generateShareCode(9);
        break;
      }
    }

    // Generate private creator management token and hash
    const managementToken = generateToken(28);
    const managementTokenHash = hashToken(managementToken);

    const quizDoc = await db.createQuiz({
      title: title.trim(),
      questions: sanitizedQuestions,
      shareCode,
      managementTokenHash,
    });

    console.log(`[Bestie API] Created new quiz: ${quizDoc._id} (shareCode: ${shareCode})`);

    // Return both shareCode and private managementToken to the creator
    res.status(201).json({
      success: true,
      shareCode,
      managementToken,
      quiz: {
        id: quizDoc._id,
        title: quizDoc.title,
        questionsCount: quizDoc.questions.length,
        createdAt: quizDoc.createdAt,
      },
    });
  } catch (err: any) {
    console.error('[Bestie API] Create quiz error:', err);
    res.status(400).json({ error: err.message || 'Failed to create quiz' });
  }
});

// Helper to sanitize route param string
function cleanParam(val: any): string {
  if (typeof val !== 'string') return '';
  return val.trim().replace(/\/+$/, '');
}

// Get Public Quiz by shareCode (NEVER exposes managementToken or responses)
apiRouter.get(['/quizzes/:shareCode', '/quizzes/:shareCode/'], async (req, res) => {
  try {
    const db = await getDatabase();
    const shareCode = cleanParam(req.params.shareCode);
    if (!shareCode) {
      return res.status(400).json({ error: 'Quiz share code is required' });
    }

    const quiz = await db.findQuizByShareCode(shareCode);

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found. Please check your link.' });
    }

    // Return ONLY public fields
    res.json({
      success: true,
      quiz: {
        id: quiz._id,
        title: quiz.title,
        questions: quiz.questions.map(q => ({
          id: q.id,
          text: q.text,
          position: q.position,
          required: q.required,
        })),
        createdAt: quiz.createdAt,
      },
    });
  } catch (err: any) {
    console.error('[Bestie API] Fetch quiz error:', err);
    res.status(500).json({ error: 'Failed to fetch quiz' });
  }
});

// Submit Responses to a Quiz (Free-text answers only, non-empty)
apiRouter.post(['/quizzes/:shareCode/responses', '/quizzes/:shareCode/responses/'], async (req, res) => {
  try {
    const db = await getDatabase();
    const shareCode = cleanParam(req.params.shareCode);
    const { responderName, answers } = req.body;

    const quiz = await db.findQuizByShareCode(shareCode);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    if (!responderName || typeof responderName !== 'string' || !responderName.trim()) {
      return res.status(400).json({ error: 'Please enter your name' });
    }

    if (!Array.isArray(answers)) {
      return res.status(400).json({ error: 'Answers must be provided' });
    }

    // Validate every answer with Smart Context-Aware Validation
    const answerMap = new Map<string, string>();
    for (const ans of answers) {
      if (ans && typeof ans.questionId === 'string' && typeof ans.answerText === 'string') {
        answerMap.set(ans.questionId, ans.answerText.trim());
      }
    }

    const formattedAnswers: Array<{ questionId: string; answerText: string }> = [];

    for (const q of quiz.questions) {
      const rawText = answerMap.get(q.id) || '';

      // Run smart context-aware validation against question text
      const validation = validateAnswer(q.text, rawText);
      if (!validation.isValid) {
        return res.status(400).json({
          error: validation.message || '👀 Give me a real answer bestie!',
          questionId: q.id,
          questionText: q.text,
          reason: validation.reason,
        });
      }

      formattedAnswers.push({
        questionId: q.id,
        answerText: rawText,
      });
    }

    const responseDoc = await db.createResponse({
      quizId: quiz._id,
      responderName: responderName.trim(),
      answers: formattedAnswers,
    });

    console.log(`[Bestie API] New response from "${responderName}" for quiz ${quiz._id}`);

    res.status(201).json({
      success: true,
      responseId: responseDoc._id,
      submittedAt: responseDoc.submittedAt,
    });
  } catch (err: any) {
    console.error('[Bestie API] Submit response error:', err);
    res.status(500).json({ error: 'Failed to save responses' });
  }
});

// Private Creator Management: View Quiz & All Responses
apiRouter.get(['/quizzes/manage/:token', '/quizzes/manage/:token/'], async (req, res) => {
  try {
    const db = await getDatabase();
    const token = cleanParam(req.params.token);
    if (!token) {
      return res.status(400).json({ error: 'Management token is required' });
    }

    const hash = hashToken(token);
    const quiz = await db.findQuizByManagementHash(hash);

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found or invalid private management token' });
    }

    const responses = await db.getResponsesForQuiz(quiz._id);

    res.json({
      success: true,
      quiz: {
        id: quiz._id,
        title: quiz.title,
        shareCode: quiz.shareCode,
        questions: quiz.questions,
        createdAt: quiz.createdAt,
      },
      responses,
    });
  } catch (err: any) {
    console.error('[Bestie API] Manage quiz error:', err);
    res.status(500).json({ error: 'Failed to access quiz management' });
  }
});

// Private Creator Management: Delete a single response
apiRouter.delete(['/quizzes/manage/:token/responses/:responseId', '/quizzes/manage/:token/responses/:responseId/'], async (req, res) => {
  try {
    const db = await getDatabase();
    const token = cleanParam(req.params.token);
    const responseId = cleanParam(req.params.responseId);
    const hash = hashToken(token);
    const quiz = await db.findQuizByManagementHash(hash);

    if (!quiz) {
      return res.status(404).json({ error: 'Invalid management token' });
    }

    const deleted = await db.deleteResponse(quiz._id, responseId);
    if (!deleted) {
      return res.status(404).json({ error: 'Response not found' });
    }

    res.json({ success: true, message: 'Response deleted' });
  } catch (err: any) {
    console.error('[Bestie API] Delete response error:', err);
    res.status(500).json({ error: 'Failed to delete response' });
  }
});

// Private Creator Management: Delete the entire quiz
apiRouter.delete(['/quizzes/manage/:token', '/quizzes/manage/:token/'], async (req, res) => {
  try {
    const db = await getDatabase();
    const token = cleanParam(req.params.token);
    const hash = hashToken(token);
    const quiz = await db.findQuizByManagementHash(hash);

    if (!quiz) {
      return res.status(404).json({ error: 'Invalid management token' });
    }

    await db.deleteQuiz(quiz._id);

    console.log(`[Bestie API] Creator deleted quiz ${quiz._id}`);
    res.json({ success: true, message: 'Quiz and all its responses deleted successfully' });
  } catch (err: any) {
    console.error('[Bestie API] Delete quiz error:', err);
    res.status(500).json({ error: 'Failed to delete quiz' });
  }
});

// Mount router under /api
app.use('/api', apiRouter);

// Also mount router directly at root to handle environments (like some Vercel rewrites) that strip the /api prefix
app.use(apiRouter);

// 404 handler specifically for /api/* paths so they never return HTML
app.all('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `API route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Global API error handler
app.use('/api', (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Bestie API Unhandled Error]:', err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'An unexpected server error occurred',
  });
});

export default app;
