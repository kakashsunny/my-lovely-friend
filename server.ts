import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import {
  getDatabase,
  generateShareCode,
  generateToken,
  hashToken,
  QuestionDoc
} from './server/db.ts';

dotenv.config();

const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  const db = await getDatabase();

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'bestie-backend' });
  });

  // Database Diagnostic & Status Endpoint
  app.get('/api/db-status', async (req, res) => {
    try {
      const status = await db.getStatus();
      res.json({ success: true, ...status });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Re-attempt MongoDB Atlas connection on demand
  app.post('/api/db/retry', async (req, res) => {
    try {
      const connected = await db.reconnectMongo();
      const status = await db.getStatus();
      res.json({ success: true, connected, status });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Global Real Statistics Endpoint
  app.get('/api/stats', async (req, res) => {
    try {
      const stats = await db.getStats();
      const dbStatus = await db.getStatus();
      res.json({
        success: true,
        totalQuizzes: stats.totalQuizzes,
        totalResponses: stats.totalResponses,
        dbProvider: dbStatus.provider,
        isConnectedToMongo: dbStatus.isConnectedToMongo,
        isMongoConfigured: dbStatus.isMongoConfigured,
      });
    } catch (err: any) {
      console.error('Stats error:', err);
      res.status(500).json({ error: 'Failed to fetch platform stats' });
    }
  });

  // Create a Quiz
  app.post('/api/quizzes', async (req, res) => {
    try {
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
          required: q.required !== false, // default true
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

      console.log(`[Bestie] Created new quiz: ${quizDoc._id} (shareCode: ${shareCode})`);

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
      console.error('Create quiz error:', err);
      res.status(400).json({ error: err.message || 'Failed to create quiz' });
    }
  });

  // Get Public Quiz by shareCode (NEVER exposes managementToken or responses)
  app.get('/api/quizzes/:shareCode', async (req, res) => {
    try {
      const { shareCode } = req.params;
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
      console.error('Fetch quiz error:', err);
      res.status(500).json({ error: 'Failed to fetch quiz' });
    }
  });

  // Submit Responses to a Quiz (Free-text answers only, non-empty)
  app.post('/api/quizzes/:shareCode/responses', async (req, res) => {
    try {
      const { shareCode } = req.params;
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

      // Validate all required questions are answered with non-empty text
      // Any text like "Nobody", "Secret", "No one", etc. is completely valid.
      const answerMap = new Map<string, string>();
      for (const ans of answers) {
        if (ans && typeof ans.questionId === 'string' && typeof ans.answerText === 'string') {
          answerMap.set(ans.questionId, ans.answerText.trim());
        }
      }

      const formattedAnswers: Array<{ questionId: string; answerText: string }> = [];

      for (const q of quiz.questions) {
        const text = answerMap.get(q.id);
        if (q.required && (!text || text.length === 0)) {
          return res.status(400).json({
            error: `Please answer question: "${q.text}"`,
            questionId: q.id,
          });
        }
        if (text && text.length > 0) {
          formattedAnswers.push({
            questionId: q.id,
            answerText: text,
          });
        }
      }

      const responseDoc = await db.createResponse({
        quizId: quiz._id,
        responderName: responderName.trim(),
        answers: formattedAnswers,
      });

      console.log(`[Bestie] New response from "${responderName}" for quiz ${quiz._id}`);

      res.status(201).json({
        success: true,
        responseId: responseDoc._id,
        submittedAt: responseDoc.submittedAt,
      });
    } catch (err: any) {
      console.error('Submit response error:', err);
      res.status(500).json({ error: 'Failed to save responses' });
    }
  });

  // Private Creator Management: View Quiz & All Responses
  app.get('/api/quizzes/manage/:token', async (req, res) => {
    try {
      const { token } = req.params;
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
      console.error('Manage quiz error:', err);
      res.status(500).json({ error: 'Failed to access quiz management' });
    }
  });

  // Private Creator Management: Delete a single response
  app.delete('/api/quizzes/manage/:token/responses/:responseId', async (req, res) => {
    try {
      const { token, responseId } = req.params;
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
      console.error('Delete response error:', err);
      res.status(500).json({ error: 'Failed to delete response' });
    }
  });

  // Private Creator Management: Delete the entire quiz
  app.delete('/api/quizzes/manage/:token', async (req, res) => {
    try {
      const { token } = req.params;
      const hash = hashToken(token);
      const quiz = await db.findQuizByManagementHash(hash);

      if (!quiz) {
        return res.status(404).json({ error: 'Invalid management token' });
      }

      await db.deleteQuiz(quiz._id);

      console.log(`[Bestie] Creator deleted quiz ${quiz._id}`);
      res.json({ success: true, message: 'Quiz and all its responses deleted successfully' });
    } catch (err: any) {
      console.error('Delete quiz error:', err);
      res.status(500).json({ error: 'Failed to delete quiz' });
    }
  });

  // Vite middleware for development & static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Bestie] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Bestie] Server failed to start:', err);
});
