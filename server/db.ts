import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import { fileURLToPath } from 'url';
import { MongoClient, Db, Collection } from 'mongodb';

function getBaseDir(): string {
  try {
    if (typeof __dirname !== 'undefined' && __dirname) return __dirname;
  } catch (_) {}
  try {
    const metaUrl = (import.meta as any)?.url;
    if (metaUrl) {
      return path.dirname(fileURLToPath(metaUrl));
    }
  } catch (_) {}
  return process.cwd();
}
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  Firestore,
  limit,
} from 'firebase/firestore';

export interface QuestionDoc {
  id: string;
  text: string;
  position: number;
  required: boolean;
}

export interface QuizDoc {
  _id: string;
  title: string;
  questions: QuestionDoc[];
  shareCode: string;
  managementTokenHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnswerDoc {
  questionId: string;
  answerText: string;
}

export interface ResponseDoc {
  _id: string;
  quizId: string;
  responderName: string;
  answers: AnswerDoc[];
  submittedAt: string;
}

export interface DatabaseStats {
  totalQuizzes: number;
  totalResponses: number;
}

export interface DatabaseStatusInfo {
  provider: 'firestore' | 'mongodb' | 'local';
  isFirestoreConfigured?: boolean;
  isConnectedToFirestore?: boolean;
  isMongoConfigured?: boolean;
  isConnectedToMongo?: boolean;
  message: string;
  fixGuide?: string;
  totalQuizzes: number;
  totalResponses: number;
}

export interface IBestieDatabase {
  init(): Promise<void>;
  createQuiz(data: { title: string; questions: QuestionDoc[]; shareCode: string; managementTokenHash: string }): Promise<QuizDoc>;
  findQuizByShareCode(shareCode: string): Promise<QuizDoc | null>;
  findQuizByManagementHash(hash: string): Promise<QuizDoc | null>;
  deleteQuiz(quizId: string): Promise<boolean>;
  
  createResponse(data: { quizId: string; responderName: string; answers: AnswerDoc[] }): Promise<ResponseDoc>;
  getResponsesForQuiz(quizId: string): Promise<ResponseDoc[]>;
  deleteResponse(quizId: string, responseId: string): Promise<boolean>;

  getStats(): Promise<DatabaseStats>;
  getStatus(): Promise<DatabaseStatusInfo>;
  reconnectMongo(): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// File-backed Persistent Engine (Zero-Config Default, fully MongoDB-compatible)
// ---------------------------------------------------------------------------
class LocalBestieDatabase implements IBestieDatabase {
  private dataDir: string;
  private filePath: string;
  private memory: {
    quizzes: QuizDoc[];
    responses: ResponseDoc[];
  } = { quizzes: [], responses: [] };
  private saveTimeout: NodeJS.Timeout | null = null;

  // In-memory indexes for rapid lookups
  private shareCodeIndex = new Map<string, QuizDoc>();
  private managementTokenHashIndex = new Map<string, QuizDoc>();
  private quizResponsesIndex = new Map<string, Set<string>>(); // quizId -> Set of responseIds
  private responsesMap = new Map<string, ResponseDoc>();

  constructor() {
    const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    this.dataDir = isServerless ? path.join(os.tmpdir(), 'bestie_data') : path.join(process.cwd(), '.data');
    this.filePath = path.join(this.dataDir, 'bestie_db.json');
  }

  async init(): Promise<void> {
    try {
      if (!fs.existsSync(this.dataDir)) {
        try {
          fs.mkdirSync(this.dataDir, { recursive: true });
        } catch (dirErr) {
          // If cwd is read-only (like Vercel lambda), switch dataDir to os.tmpdir()
          this.dataDir = path.join(os.tmpdir(), 'bestie_data');
          this.filePath = path.join(this.dataDir, 'bestie_db.json');
          if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
          }
        }
      }

      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        this.memory.quizzes = (Array.isArray(parsed.quizzes) ? parsed.quizzes : [])
          .filter((q: QuizDoc) => q._id !== 'q_welcome_demo' && q.shareCode !== 'demo777');
        this.memory.responses = (Array.isArray(parsed.responses) ? parsed.responses : [])
          .filter((r: ResponseDoc) => r.quizId !== 'q_welcome_demo');
      } else {
        // Pure clean start with zero mock or fake data
        this.memory = { quizzes: [], responses: [] };
        this.persistNow();
      }

      this.rebuildIndexes();
      console.log(`[Bestie DB] Local persistent DB initialized in ${this.dataDir}. ${this.memory.quizzes.length} genuine quizzes, ${this.memory.responses.length} genuine responses.`);
    } catch (err) {
      console.error('[Bestie DB] Error initializing local DB:', err);
      this.memory = { quizzes: [], responses: [] };
      this.rebuildIndexes();
    }
  }

  private rebuildIndexes() {
    this.shareCodeIndex.clear();
    this.managementTokenHashIndex.clear();
    this.quizResponsesIndex.clear();
    this.responsesMap.clear();

    for (const q of this.memory.quizzes) {
      this.shareCodeIndex.set(q.shareCode, q);
      this.managementTokenHashIndex.set(q.managementTokenHash, q);
    }

    for (const r of this.memory.responses) {
      this.responsesMap.set(r._id, r);
      if (!this.quizResponsesIndex.has(r.quizId)) {
        this.quizResponsesIndex.set(r.quizId, new Set());
      }
      this.quizResponsesIndex.get(r.quizId)!.add(r._id);
    }
  }

  private schedulePersist() {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.persistNow();
    }, 200);
  }

  private persistNow() {
    try {
      const data = JSON.stringify(this.memory, null, 2);
      fs.writeFileSync(this.filePath, data, 'utf-8');
    } catch (err) {
      try {
        this.dataDir = path.join(os.tmpdir(), 'bestie_data');
        this.filePath = path.join(this.dataDir, 'bestie_db.json');
        if (!fs.existsSync(this.dataDir)) {
          fs.mkdirSync(this.dataDir, { recursive: true });
        }
        const data = JSON.stringify(this.memory, null, 2);
        fs.writeFileSync(this.filePath, data, 'utf-8');
      } catch (fallbackErr) {
        console.warn('[Bestie DB] File persistence bypassed in serverless container:', fallbackErr);
      }
    }
  }

  async createQuiz(data: { title: string; questions: QuestionDoc[]; shareCode: string; managementTokenHash: string }): Promise<QuizDoc> {
    const doc: QuizDoc = {
      _id: 'q_' + crypto.randomUUID().slice(0, 12),
      title: data.title,
      questions: data.questions,
      shareCode: data.shareCode,
      managementTokenHash: data.managementTokenHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.memory.quizzes.push(doc);
    this.shareCodeIndex.set(doc.shareCode, doc);
    this.managementTokenHashIndex.set(doc.managementTokenHash, doc);
    this.schedulePersist();
    return doc;
  }

  async findQuizByShareCode(shareCode: string): Promise<QuizDoc | null> {
    const q = this.shareCodeIndex.get(shareCode);
    return q || null;
  }

  async findQuizByManagementHash(hash: string): Promise<QuizDoc | null> {
    const q = this.managementTokenHashIndex.get(hash);
    return q || null;
  }

  async deleteQuiz(quizId: string): Promise<boolean> {
    const quizIdx = this.memory.quizzes.findIndex(q => q._id === quizId);
    if (quizIdx === -1) return false;
    const quiz = this.memory.quizzes[quizIdx];

    this.shareCodeIndex.delete(quiz.shareCode);
    this.managementTokenHashIndex.delete(quiz.managementTokenHash);
    this.memory.quizzes.splice(quizIdx, 1);

    // Delete related responses
    const responseIds = this.quizResponsesIndex.get(quizId);
    if (responseIds) {
      this.memory.responses = this.memory.responses.filter(r => r.quizId !== quizId);
      for (const id of responseIds) {
        this.responsesMap.delete(id);
      }
      this.quizResponsesIndex.delete(quizId);
    }

    this.schedulePersist();
    return true;
  }

  async createResponse(data: { quizId: string; responderName: string; answers: AnswerDoc[] }): Promise<ResponseDoc> {
    const doc: ResponseDoc = {
      _id: 'resp_' + crypto.randomUUID().slice(0, 12),
      quizId: data.quizId,
      responderName: data.responderName,
      answers: data.answers,
      submittedAt: new Date().toISOString(),
    };

    this.memory.responses.push(doc);
    this.responsesMap.set(doc._id, doc);
    if (!this.quizResponsesIndex.has(data.quizId)) {
      this.quizResponsesIndex.set(data.quizId, new Set());
    }
    this.quizResponsesIndex.get(data.quizId)!.add(doc._id);

    this.schedulePersist();
    return doc;
  }

  async getResponsesForQuiz(quizId: string): Promise<ResponseDoc[]> {
    const responseIds = this.quizResponsesIndex.get(quizId);
    if (!responseIds) return [];
    const list: ResponseDoc[] = [];
    for (const id of responseIds) {
      const r = this.responsesMap.get(id);
      if (r) list.push(r);
    }
    // Sort by submittedAt descending (newest first)
    list.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    return list;
  }

  async deleteResponse(quizId: string, responseId: string): Promise<boolean> {
    const idx = this.memory.responses.findIndex(r => r._id === responseId && r.quizId === quizId);
    if (idx === -1) return false;
    this.memory.responses.splice(idx, 1);
    this.responsesMap.delete(responseId);
    const set = this.quizResponsesIndex.get(quizId);
    if (set) {
      set.delete(responseId);
    }
    this.schedulePersist();
    return true;
  }

  async getStats(): Promise<DatabaseStats> {
    return {
      totalQuizzes: this.memory.quizzes.length,
      totalResponses: this.memory.responses.length,
    };
  }

  getAllQuizzes(): QuizDoc[] {
    return [...this.memory.quizzes];
  }

  getAllResponses(): ResponseDoc[] {
    return [...this.memory.responses];
  }

  async getStatus(): Promise<DatabaseStatusInfo> {
    return {
      provider: 'local',
      isMongoConfigured: false,
      isConnectedToMongo: false,
      message: 'Running on High-Performance Local Persistent Engine',
      totalQuizzes: this.memory.quizzes.length,
      totalResponses: this.memory.responses.length,
    };
  }

  async reconnectMongo(): Promise<boolean> {
    return false;
  }
}

let globalMongoClient: MongoClient | null = null;
let globalIndexesCreated = false;

// ---------------------------------------------------------------------------
// Native MongoDB Driver Implementation (when MONGODB_URI is provided)
// ---------------------------------------------------------------------------
class MongoBestieDatabase implements IBestieDatabase {
  private client: MongoClient;
  private db!: Db;
  private quizzesCol!: Collection<QuizDoc>;
  private responsesCol!: Collection<ResponseDoc>;

  constructor(uri: string) {
    const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    if (globalMongoClient) {
      this.client = globalMongoClient;
    } else {
      this.client = new MongoClient(uri, {
        serverSelectionTimeoutMS: isServerless ? 2500 : 5000,
        connectTimeoutMS: isServerless ? 2500 : 5000,
        socketTimeoutMS: isServerless ? 5000 : 15000,
        retryWrites: true,
        maxPoolSize: isServerless ? 1 : 10,
      });
      if (isServerless) {
        globalMongoClient = this.client;
      }
    }
  }

  async init(): Promise<void> {
    try {
      await this.client.connect();
      this.db = this.client.db();
      this.quizzesCol = this.db.collection<QuizDoc>('quizzes');
      this.responsesCol = this.db.collection<ResponseDoc>('responses');

      // Create indexes once to avoid latency on repeated serverless cold starts
      if (!globalIndexesCreated) {
        try {
          await this.quizzesCol.createIndex({ shareCode: 1 }, { unique: true });
          await this.quizzesCol.createIndex({ managementTokenHash: 1 });
          await this.responsesCol.createIndex({ quizId: 1, submittedAt: -1 });
          await this.responsesCol.createIndex({ submittedAt: -1 });
          globalIndexesCreated = true;
        } catch (idxErr) {
          console.warn('[Bestie DB] Index creation note:', idxErr);
        }
      }

      console.log('[Bestie DB] Connected to MongoDB Atlas successfully with genuine records only.');
    } catch (err) {
      if (!globalMongoClient) {
        try {
          await this.client.close(true);
        } catch (_) {}
      }
      throw err;
    }
  }

  async close(): Promise<void> {
    try {
      await this.client.close(true);
    } catch (_) {}
  }

  async upsertQuiz(doc: QuizDoc): Promise<void> {
    if (doc._id === 'q_welcome_demo' || doc.shareCode === 'demo777') return;
    await this.quizzesCol.updateOne(
      { _id: doc._id },
      { $setOnInsert: doc as any },
      { upsert: true }
    );
  }

  async upsertResponse(doc: ResponseDoc): Promise<void> {
    if (doc.quizId === 'q_welcome_demo' || ['resp_1', 'resp_2', 'resp_3'].includes(doc._id)) return;
    await this.responsesCol.updateOne(
      { _id: doc._id },
      { $setOnInsert: doc as any },
      { upsert: true }
    );
  }

  async createQuiz(data: { title: string; questions: QuestionDoc[]; shareCode: string; managementTokenHash: string }): Promise<QuizDoc> {
    const doc: QuizDoc = {
      _id: 'q_' + crypto.randomUUID().slice(0, 12),
      title: data.title,
      questions: data.questions,
      shareCode: data.shareCode,
      managementTokenHash: data.managementTokenHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.quizzesCol.insertOne(doc as any);
    return doc;
  }

  async findQuizByShareCode(shareCode: string): Promise<QuizDoc | null> {
    return (await this.quizzesCol.findOne({ shareCode })) as QuizDoc | null;
  }

  async findQuizByManagementHash(hash: string): Promise<QuizDoc | null> {
    return (await this.quizzesCol.findOne({ managementTokenHash: hash })) as QuizDoc | null;
  }

  async deleteQuiz(quizId: string): Promise<boolean> {
    const res = await this.quizzesCol.deleteOne({ _id: quizId });
    await this.responsesCol.deleteMany({ quizId });
    return res.deletedCount > 0;
  }

  async createResponse(data: { quizId: string; responderName: string; answers: AnswerDoc[] }): Promise<ResponseDoc> {
    const doc: ResponseDoc = {
      _id: 'resp_' + crypto.randomUUID().slice(0, 12),
      quizId: data.quizId,
      responderName: data.responderName,
      answers: data.answers,
      submittedAt: new Date().toISOString(),
    };
    await this.responsesCol.insertOne(doc as any);
    return doc;
  }

  async getResponsesForQuiz(quizId: string): Promise<ResponseDoc[]> {
    return (await this.responsesCol.find({ quizId }).sort({ submittedAt: -1 }).toArray()) as ResponseDoc[];
  }

  async deleteResponse(quizId: string, responseId: string): Promise<boolean> {
    const res = await this.responsesCol.deleteOne({ _id: responseId, quizId });
    return res.deletedCount > 0;
  }

  async getStats(): Promise<DatabaseStats> {
    const totalQuizzes = await this.quizzesCol.countDocuments({
      _id: { $ne: 'q_welcome_demo' },
      shareCode: { $ne: 'demo777' }
    });
    const totalResponses = await this.responsesCol.countDocuments({
      quizId: { $ne: 'q_welcome_demo' },
      _id: { $nin: ['resp_1', 'resp_2', 'resp_3'] }
    });
    return { totalQuizzes, totalResponses };
  }

  async getStatus(): Promise<DatabaseStatusInfo> {
    const stats = await this.getStats();
    return {
      provider: 'mongodb',
      isMongoConfigured: true,
      isConnectedToMongo: true,
      message: 'Connected to MongoDB Atlas',
      totalQuizzes: stats.totalQuizzes,
      totalResponses: stats.totalResponses,
    };
  }

  async reconnectMongo(): Promise<boolean> {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Firebase Firestore Cloud Engine (Direct Cloud Persistence)
// ---------------------------------------------------------------------------
export class FirestoreBestieDatabase implements IBestieDatabase {
  private db: Firestore;

  constructor(config: any) {
    const app = getApps().length > 0 ? getApp() : initializeApp(config);
    this.db = getFirestore(app, config.firestoreDatabaseId || undefined);
  }

  async init(): Promise<void> {
    const testQ = query(collection(this.db, 'quizzes'), limit(1));
    await getDocs(testQ);
  }

  async createQuiz(data: { title: string; questions: QuestionDoc[]; shareCode: string; managementTokenHash: string }): Promise<QuizDoc> {
    const now = new Date().toISOString();
    const quizId = `q_${crypto.randomUUID().slice(0, 11)}`;
    const docData: QuizDoc = {
      _id: quizId,
      title: data.title.trim(),
      questions: data.questions,
      shareCode: data.shareCode,
      managementTokenHash: data.managementTokenHash,
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(doc(this.db, 'quizzes', quizId), docData);
    return docData;
  }

  async findQuizByShareCode(shareCode: string): Promise<QuizDoc | null> {
    const q = query(collection(this.db, 'quizzes'), where('shareCode', '==', shareCode), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return snap.docs[0].data() as QuizDoc;
  }

  async findQuizByManagementHash(hash: string): Promise<QuizDoc | null> {
    const q = query(collection(this.db, 'quizzes'), where('managementTokenHash', '==', hash), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return snap.docs[0].data() as QuizDoc;
  }

  async deleteQuiz(quizId: string): Promise<boolean> {
    await deleteDoc(doc(this.db, 'quizzes', quizId));
    try {
      const q = query(collection(this.db, 'responses'), where('quizId', '==', quizId));
      const snap = await getDocs(q);
      const deletes = snap.docs.map(d => deleteDoc(doc(this.db, 'responses', d.id)));
      await Promise.all(deletes);
    } catch (_) {}
    return true;
  }

  async createResponse(data: { quizId: string; responderName: string; answers: AnswerDoc[] }): Promise<ResponseDoc> {
    const respId = `resp_${crypto.randomUUID().slice(0, 11)}`;
    const now = new Date().toISOString();
    const docData: ResponseDoc = {
      _id: respId,
      quizId: data.quizId,
      responderName: data.responderName.trim(),
      answers: data.answers,
      submittedAt: now,
    };
    await setDoc(doc(this.db, 'responses', respId), docData);
    return docData;
  }

  async getResponsesForQuiz(quizId: string): Promise<ResponseDoc[]> {
    const q = query(collection(this.db, 'responses'), where('quizId', '==', quizId));
    const snap = await getDocs(q);
    const list = snap.docs.map(d => d.data() as ResponseDoc);
    return list.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  }

  async deleteResponse(_quizId: string, responseId: string): Promise<boolean> {
    await deleteDoc(doc(this.db, 'responses', responseId));
    return true;
  }

  async getStats(): Promise<DatabaseStats> {
    const [quizzesSnap, responsesSnap] = await Promise.all([
      getDocs(collection(this.db, 'quizzes')),
      getDocs(collection(this.db, 'responses')),
    ]);
    return {
      totalQuizzes: quizzesSnap.size,
      totalResponses: responsesSnap.size,
    };
  }

  async getStatus(): Promise<DatabaseStatusInfo> {
    const stats = await this.getStats();
    return {
      provider: 'firestore',
      isFirestoreConfigured: true,
      isConnectedToFirestore: true,
      message: 'Connected to Firebase Firestore Cloud Database',
      totalQuizzes: stats.totalQuizzes,
      totalResponses: stats.totalResponses,
    };
  }

  async upsertQuiz(quiz: QuizDoc): Promise<void> {
    await setDoc(doc(this.db, 'quizzes', quiz._id), quiz);
  }

  async upsertResponse(resp: ResponseDoc): Promise<void> {
    await setDoc(doc(this.db, 'responses', resp._id), resp);
  }

  async reconnectMongo(): Promise<boolean> {
    return true;
  }
}

function loadFirebaseConfig(): any {
  if (process.env.FIREBASE_CONFIG) {
    try {
      return JSON.parse(process.env.FIREBASE_CONFIG);
    } catch (_) {}
  }
  const baseDir = getBaseDir();
  const possiblePaths = [
    path.join(process.cwd(), 'firebase-applet-config.json'),
    path.join(baseDir, '..', 'firebase-applet-config.json'),
    path.join(baseDir, 'firebase-applet-config.json'),
  ];
  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
      }
    } catch (_) {}
  }
  return {
    projectId: "gen-lang-client-0928069600",
    appId: "1:352732315322:web:537ac9d2c524968bba8c83",
    apiKey: "AIzaSyDEe5ijNjK-lLkJYYOHAaOxz1a4S0LiV28",
    authDomain: "gen-lang-client-0928069600.firebaseapp.com",
    firestoreDatabaseId: "ai-studio-bestie-8940a001-204f-471e-a965-b21e8e50073a",
    storageBucket: "gen-lang-client-0928069600.firebasestorage.app",
    messagingSenderId: "352732315322",
  };
}

// ---------------------------------------------------------------------------
// Resilient Database Manager (Firebase Firestore Primary, local zero-downtime)
// ---------------------------------------------------------------------------
export class ResilientBestieDatabase implements IBestieDatabase {
  private localDb: LocalBestieDatabase;
  private firestoreDb: FirestoreBestieDatabase | null = null;
  private mongoDb: MongoBestieDatabase | null = null;
  private activeDb: IBestieDatabase;
  private isFirestoreConfigured = false;
  private isConnectedToFirestore = false;
  private isMongoConfigured = false;
  private isConnectedToMongo = false;
  private lastError: string | null = null;
  private lastFixGuide: string | null = null;
  private autoRetryTimer: NodeJS.Timeout | null = null;
  private isReconnecting = false;

  constructor() {
    this.localDb = new LocalBestieDatabase();
    this.activeDb = this.localDb;
  }

  async init(): Promise<void> {
    // 1. Initialize local persistent engine first (zero downtime guaranteed)
    await this.localDb.init();
    this.activeDb = this.localDb;

    // 2. Connect to Firebase Firestore (primary cloud database)
    const fbConnected = await this.tryConnectFirestore();
    if (fbConnected) {
      return;
    }

    // 3. Attempt connection to MongoDB if configured
    const connected = await this.tryConnectMongo(false);
    if (!connected && this.isMongoConfigured) {
      this.startAutoRetry();
    }
  }

  async tryConnectFirestore(): Promise<boolean> {
    try {
      const fbConfig = loadFirebaseConfig();
      if (!fbConfig || !fbConfig.projectId) {
        this.isFirestoreConfigured = false;
        return false;
      }
      this.isFirestoreConfigured = true;
      console.log('[Bestie DB] Initializing Firebase Firestore Cloud Database...');
      const candidate = new FirestoreBestieDatabase(fbConfig);
      await candidate.init();

      // Sync existing quizzes & responses so user data is never lost
      try {
        const localQuizzes = this.localDb.getAllQuizzes();
        const localResponses = this.localDb.getAllResponses();
        if (localQuizzes.length > 0) {
          console.log(`[Bestie DB] Syncing ${localQuizzes.length} quiz(zes) to Firestore...`);
          for (const q of localQuizzes) {
            await candidate.upsertQuiz(q);
          }
        }
        if (localResponses.length > 0) {
          console.log(`[Bestie DB] Syncing ${localResponses.length} response(s) to Firestore...`);
          for (const r of localResponses) {
            await candidate.upsertResponse(r);
          }
        }
      } catch (syncErr) {
        console.warn('[Bestie DB] Note during initial sync to Firestore:', syncErr);
      }

      this.firestoreDb = candidate;
      this.activeDb = candidate;
      this.isConnectedToFirestore = true;
      console.log('[Bestie DB] ✅ Live connection to Firebase Firestore active! ☁️');
      return true;
    } catch (err: any) {
      console.warn('[Bestie DB] Firestore connection attempt:', err?.message || err);
      this.isConnectedToFirestore = false;
      return false;
    }
  }

  private startAutoRetry() {
    // In serverless environments (e.g. Vercel), background intervals prevent the function from completing and trigger 504 timeouts
    const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    if (isServerless) return;

    if (this.autoRetryTimer) clearInterval(this.autoRetryTimer);
    this.autoRetryTimer = setInterval(async () => {
      if (!this.isConnectedToFirestore && !this.isConnectedToMongo && this.isMongoConfigured) {
        await this.tryConnectMongo(true);
      } else if ((this.isConnectedToFirestore || this.isConnectedToMongo) && this.autoRetryTimer) {
        clearInterval(this.autoRetryTimer);
        this.autoRetryTimer = null;
      }
    }, 45000);
    if (this.autoRetryTimer && typeof (this.autoRetryTimer as any).unref === 'function') {
      (this.autoRetryTimer as any).unref();
    }
  }

  async tryConnectMongo(isBackgroundRetry = false): Promise<boolean> {
    if (this.isReconnecting) return this.isConnectedToMongo;
    this.isReconnecting = true;

    try {
      const rawUri = process.env.MONGODB_URI;
      if (!rawUri || !rawUri.trim()) {
        this.isMongoConfigured = false;
        this.isConnectedToMongo = false;
        return false;
      }

      this.isMongoConfigured = true;
      const uri = rawUri.trim().replace(/^['"]|['"]$/g, '');

      if (!isBackgroundRetry) {
        console.log('[Bestie DB] Verifying MongoDB Atlas connection...');
      }

      const candidate = new MongoBestieDatabase(uri);
      await candidate.init();

      try {
        const localQuizzes = this.localDb.getAllQuizzes();
        const localResponses = this.localDb.getAllResponses();
        if (localQuizzes.length > 0) {
          console.log(`[Bestie DB] Syncing ${localQuizzes.length} quiz(zes) to MongoDB...`);
          for (const q of localQuizzes) {
            await candidate.upsertQuiz(q);
          }
        }
        if (localResponses.length > 0) {
          for (const r of localResponses) {
            await candidate.upsertResponse(r);
          }
        }
      } catch (syncErr) {
        console.warn('[Bestie DB] Note during initial sync to MongoDB:', syncErr);
      }

      if (this.mongoDb) {
        await this.mongoDb.close();
      }
      this.mongoDb = candidate;
      if (!this.isConnectedToFirestore) {
        this.activeDb = candidate;
      }
      this.isConnectedToMongo = true;
      this.lastError = null;
      this.lastFixGuide = null;
      console.log('[Bestie DB] ✅ Live connection to MongoDB Atlas active!');
      return true;
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      this.lastError = errMsg;
      this.isConnectedToMongo = false;
      return false;
    } finally {
      this.isReconnecting = false;
    }
  }

  async reconnectMongo(): Promise<boolean> {
    if (this.isFirestoreConfigured) {
      const fb = await this.tryConnectFirestore();
      if (fb) return true;
    }
    return this.tryConnectMongo(false);
  }

  async getStatus(): Promise<DatabaseStatusInfo> {
    const stats = await this.activeDb.getStats();
    const provider = this.isConnectedToFirestore
      ? 'firestore'
      : this.isConnectedToMongo
      ? 'mongodb'
      : 'local';
    return {
      provider,
      isFirestoreConfigured: this.isFirestoreConfigured,
      isConnectedToFirestore: this.isConnectedToFirestore,
      isMongoConfigured: this.isMongoConfigured,
      isConnectedToMongo: this.isConnectedToMongo,
      message: this.isConnectedToFirestore
        ? 'Connected to Firebase Firestore Cloud Database'
        : this.isConnectedToMongo
        ? 'Connected to MongoDB Atlas'
        : 'Running on Built-in Persistent DB',
      fixGuide: this.lastFixGuide || undefined,
      totalQuizzes: stats.totalQuizzes,
      totalResponses: stats.totalResponses,
    };
  }

  // Delegate all IBestieDatabase methods to activeDb
  async createQuiz(data: { title: string; questions: QuestionDoc[]; shareCode: string; managementTokenHash: string }): Promise<QuizDoc> {
    return this.activeDb.createQuiz(data);
  }

  async findQuizByShareCode(shareCode: string): Promise<QuizDoc | null> {
    return this.activeDb.findQuizByShareCode(shareCode);
  }

  async findQuizByManagementHash(hash: string): Promise<QuizDoc | null> {
    return this.activeDb.findQuizByManagementHash(hash);
  }

  async deleteQuiz(quizId: string): Promise<boolean> {
    return this.activeDb.deleteQuiz(quizId);
  }

  async createResponse(data: { quizId: string; responderName: string; answers: AnswerDoc[] }): Promise<ResponseDoc> {
    return this.activeDb.createResponse(data);
  }

  async getResponsesForQuiz(quizId: string): Promise<ResponseDoc[]> {
    return this.activeDb.getResponsesForQuiz(quizId);
  }

  async deleteResponse(quizId: string, responseId: string): Promise<boolean> {
    return this.activeDb.deleteResponse(quizId, responseId);
  }

  async getStats(): Promise<DatabaseStats> {
    return this.activeDb.getStats();
  }
}

// Global Singleton Database Instance
let dbInstance: ResilientBestieDatabase | null = null;

export async function getDatabase(): Promise<ResilientBestieDatabase> {
  if (dbInstance) return dbInstance;
  const resilientDb = new ResilientBestieDatabase();
  await resilientDb.init();
  dbInstance = resilientDb;
  return dbInstance;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateToken(length = 24): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    token += chars[randomBytes[i] % chars.length];
  }
  return token;
}

export function generateShareCode(length = 7): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let code = '';
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    code += chars[randomBytes[i] % chars.length];
  }
  return code;
}
