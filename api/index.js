// server/app.ts
import express from "express";
import dotenv from "dotenv";

// server/db.ts
import fs from "fs";
import path from "path";
import crypto from "crypto";
import os from "os";
import { fileURLToPath } from "url";
import { MongoClient } from "mongodb";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  limit
} from "firebase/firestore";
function getBaseDir() {
  try {
    if (typeof __dirname !== "undefined" && __dirname) return __dirname;
  } catch (_) {
  }
  try {
    const metaUrl = import.meta?.url;
    if (metaUrl) {
      return path.dirname(fileURLToPath(metaUrl));
    }
  } catch (_) {
  }
  return process.cwd();
}
var LocalBestieDatabase = class {
  constructor() {
    this.memory = { quizzes: [], responses: [] };
    this.saveTimeout = null;
    // In-memory indexes for rapid lookups
    this.shareCodeIndex = /* @__PURE__ */ new Map();
    this.managementTokenHashIndex = /* @__PURE__ */ new Map();
    this.quizResponsesIndex = /* @__PURE__ */ new Map();
    // quizId -> Set of responseIds
    this.responsesMap = /* @__PURE__ */ new Map();
    const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    this.dataDir = isServerless ? path.join(os.tmpdir(), "bestie_data") : path.join(process.cwd(), ".data");
    this.filePath = path.join(this.dataDir, "bestie_db.json");
  }
  async init() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        try {
          fs.mkdirSync(this.dataDir, { recursive: true });
        } catch (dirErr) {
          this.dataDir = path.join(os.tmpdir(), "bestie_data");
          this.filePath = path.join(this.dataDir, "bestie_db.json");
          if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
          }
        }
      }
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf-8");
        const parsed = JSON.parse(raw);
        this.memory.quizzes = (Array.isArray(parsed.quizzes) ? parsed.quizzes : []).filter((q) => q._id !== "q_welcome_demo" && q.shareCode !== "demo777");
        this.memory.responses = (Array.isArray(parsed.responses) ? parsed.responses : []).filter((r) => r.quizId !== "q_welcome_demo");
      } else {
        this.memory = { quizzes: [], responses: [] };
        this.persistNow();
      }
      this.rebuildIndexes();
      console.log(`[Bestie DB] Local persistent DB initialized in ${this.dataDir}. ${this.memory.quizzes.length} genuine quizzes, ${this.memory.responses.length} genuine responses.`);
    } catch (err) {
      console.error("[Bestie DB] Error initializing local DB:", err);
      this.memory = { quizzes: [], responses: [] };
      this.rebuildIndexes();
    }
  }
  rebuildIndexes() {
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
        this.quizResponsesIndex.set(r.quizId, /* @__PURE__ */ new Set());
      }
      this.quizResponsesIndex.get(r.quizId).add(r._id);
    }
  }
  schedulePersist() {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.persistNow();
    }, 200);
  }
  persistNow() {
    try {
      const data = JSON.stringify(this.memory, null, 2);
      fs.writeFileSync(this.filePath, data, "utf-8");
    } catch (err) {
      try {
        this.dataDir = path.join(os.tmpdir(), "bestie_data");
        this.filePath = path.join(this.dataDir, "bestie_db.json");
        if (!fs.existsSync(this.dataDir)) {
          fs.mkdirSync(this.dataDir, { recursive: true });
        }
        const data = JSON.stringify(this.memory, null, 2);
        fs.writeFileSync(this.filePath, data, "utf-8");
      } catch (fallbackErr) {
        console.warn("[Bestie DB] File persistence bypassed in serverless container:", fallbackErr);
      }
    }
  }
  async createQuiz(data) {
    const doc2 = {
      _id: "q_" + crypto.randomUUID().slice(0, 12),
      title: data.title,
      questions: data.questions,
      shareCode: data.shareCode,
      managementTokenHash: data.managementTokenHash,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.memory.quizzes.push(doc2);
    this.shareCodeIndex.set(doc2.shareCode, doc2);
    this.managementTokenHashIndex.set(doc2.managementTokenHash, doc2);
    this.schedulePersist();
    return doc2;
  }
  async findQuizByShareCode(shareCode) {
    const q = this.shareCodeIndex.get(shareCode);
    return q || null;
  }
  async findQuizByManagementHash(hash) {
    const q = this.managementTokenHashIndex.get(hash);
    return q || null;
  }
  async deleteQuiz(quizId) {
    const quizIdx = this.memory.quizzes.findIndex((q) => q._id === quizId);
    if (quizIdx === -1) return false;
    const quiz = this.memory.quizzes[quizIdx];
    this.shareCodeIndex.delete(quiz.shareCode);
    this.managementTokenHashIndex.delete(quiz.managementTokenHash);
    this.memory.quizzes.splice(quizIdx, 1);
    const responseIds = this.quizResponsesIndex.get(quizId);
    if (responseIds) {
      this.memory.responses = this.memory.responses.filter((r) => r.quizId !== quizId);
      for (const id of responseIds) {
        this.responsesMap.delete(id);
      }
      this.quizResponsesIndex.delete(quizId);
    }
    this.schedulePersist();
    return true;
  }
  async createResponse(data) {
    const doc2 = {
      _id: "resp_" + crypto.randomUUID().slice(0, 12),
      quizId: data.quizId,
      responderName: data.responderName,
      answers: data.answers,
      submittedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.memory.responses.push(doc2);
    this.responsesMap.set(doc2._id, doc2);
    if (!this.quizResponsesIndex.has(data.quizId)) {
      this.quizResponsesIndex.set(data.quizId, /* @__PURE__ */ new Set());
    }
    this.quizResponsesIndex.get(data.quizId).add(doc2._id);
    this.schedulePersist();
    return doc2;
  }
  async getResponsesForQuiz(quizId) {
    const responseIds = this.quizResponsesIndex.get(quizId);
    if (!responseIds) return [];
    const list = [];
    for (const id of responseIds) {
      const r = this.responsesMap.get(id);
      if (r) list.push(r);
    }
    list.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    return list;
  }
  async deleteResponse(quizId, responseId) {
    const idx = this.memory.responses.findIndex((r) => r._id === responseId && r.quizId === quizId);
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
  async getStats() {
    return {
      totalQuizzes: this.memory.quizzes.length,
      totalResponses: this.memory.responses.length
    };
  }
  getAllQuizzes() {
    return [...this.memory.quizzes];
  }
  getAllResponses() {
    return [...this.memory.responses];
  }
  async getStatus() {
    return {
      provider: "local",
      isMongoConfigured: false,
      isConnectedToMongo: false,
      message: "Running on High-Performance Local Persistent Engine",
      totalQuizzes: this.memory.quizzes.length,
      totalResponses: this.memory.responses.length
    };
  }
  async reconnectMongo() {
    return false;
  }
};
var globalMongoClient = null;
var globalIndexesCreated = false;
var MongoBestieDatabase = class {
  constructor(uri) {
    const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    if (globalMongoClient) {
      this.client = globalMongoClient;
    } else {
      this.client = new MongoClient(uri, {
        serverSelectionTimeoutMS: isServerless ? 2500 : 5e3,
        connectTimeoutMS: isServerless ? 2500 : 5e3,
        socketTimeoutMS: isServerless ? 5e3 : 15e3,
        retryWrites: true,
        maxPoolSize: isServerless ? 1 : 10
      });
      if (isServerless) {
        globalMongoClient = this.client;
      }
    }
  }
  async init() {
    try {
      await this.client.connect();
      this.db = this.client.db();
      this.quizzesCol = this.db.collection("quizzes");
      this.responsesCol = this.db.collection("responses");
      if (!globalIndexesCreated) {
        try {
          await this.quizzesCol.createIndex({ shareCode: 1 }, { unique: true });
          await this.quizzesCol.createIndex({ managementTokenHash: 1 });
          await this.responsesCol.createIndex({ quizId: 1, submittedAt: -1 });
          await this.responsesCol.createIndex({ submittedAt: -1 });
          globalIndexesCreated = true;
        } catch (idxErr) {
          console.warn("[Bestie DB] Index creation note:", idxErr);
        }
      }
      console.log("[Bestie DB] Connected to MongoDB Atlas successfully with genuine records only.");
    } catch (err) {
      if (!globalMongoClient) {
        try {
          await this.client.close(true);
        } catch (_) {
        }
      }
      throw err;
    }
  }
  async close() {
    try {
      await this.client.close(true);
    } catch (_) {
    }
  }
  async upsertQuiz(doc2) {
    if (doc2._id === "q_welcome_demo" || doc2.shareCode === "demo777") return;
    await this.quizzesCol.updateOne(
      { _id: doc2._id },
      { $setOnInsert: doc2 },
      { upsert: true }
    );
  }
  async upsertResponse(doc2) {
    if (doc2.quizId === "q_welcome_demo" || ["resp_1", "resp_2", "resp_3"].includes(doc2._id)) return;
    await this.responsesCol.updateOne(
      { _id: doc2._id },
      { $setOnInsert: doc2 },
      { upsert: true }
    );
  }
  async createQuiz(data) {
    const doc2 = {
      _id: "q_" + crypto.randomUUID().slice(0, 12),
      title: data.title,
      questions: data.questions,
      shareCode: data.shareCode,
      managementTokenHash: data.managementTokenHash,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await this.quizzesCol.insertOne(doc2);
    return doc2;
  }
  async findQuizByShareCode(shareCode) {
    return await this.quizzesCol.findOne({ shareCode });
  }
  async findQuizByManagementHash(hash) {
    return await this.quizzesCol.findOne({ managementTokenHash: hash });
  }
  async deleteQuiz(quizId) {
    const res = await this.quizzesCol.deleteOne({ _id: quizId });
    await this.responsesCol.deleteMany({ quizId });
    return res.deletedCount > 0;
  }
  async createResponse(data) {
    const doc2 = {
      _id: "resp_" + crypto.randomUUID().slice(0, 12),
      quizId: data.quizId,
      responderName: data.responderName,
      answers: data.answers,
      submittedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await this.responsesCol.insertOne(doc2);
    return doc2;
  }
  async getResponsesForQuiz(quizId) {
    return await this.responsesCol.find({ quizId }).sort({ submittedAt: -1 }).toArray();
  }
  async deleteResponse(quizId, responseId) {
    const res = await this.responsesCol.deleteOne({ _id: responseId, quizId });
    return res.deletedCount > 0;
  }
  async getStats() {
    const totalQuizzes = await this.quizzesCol.countDocuments({
      _id: { $ne: "q_welcome_demo" },
      shareCode: { $ne: "demo777" }
    });
    const totalResponses = await this.responsesCol.countDocuments({
      quizId: { $ne: "q_welcome_demo" },
      _id: { $nin: ["resp_1", "resp_2", "resp_3"] }
    });
    return { totalQuizzes, totalResponses };
  }
  async getStatus() {
    const stats = await this.getStats();
    return {
      provider: "mongodb",
      isMongoConfigured: true,
      isConnectedToMongo: true,
      message: "Connected to MongoDB Atlas",
      totalQuizzes: stats.totalQuizzes,
      totalResponses: stats.totalResponses
    };
  }
  async reconnectMongo() {
    return true;
  }
};
var FirestoreBestieDatabase = class {
  constructor(config) {
    const app2 = getApps().length > 0 ? getApp() : initializeApp(config);
    this.db = getFirestore(app2, config.firestoreDatabaseId || void 0);
  }
  async init() {
    const testQ = query(collection(this.db, "quizzes"), limit(1));
    await getDocs(testQ);
  }
  async createQuiz(data) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const quizId = `q_${crypto.randomUUID().slice(0, 11)}`;
    const docData = {
      _id: quizId,
      title: data.title.trim(),
      questions: data.questions,
      shareCode: data.shareCode,
      managementTokenHash: data.managementTokenHash,
      createdAt: now,
      updatedAt: now
    };
    await setDoc(doc(this.db, "quizzes", quizId), docData);
    return docData;
  }
  async findQuizByShareCode(shareCode) {
    const q = query(collection(this.db, "quizzes"), where("shareCode", "==", shareCode), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return snap.docs[0].data();
  }
  async findQuizByManagementHash(hash) {
    const q = query(collection(this.db, "quizzes"), where("managementTokenHash", "==", hash), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return snap.docs[0].data();
  }
  async deleteQuiz(quizId) {
    await deleteDoc(doc(this.db, "quizzes", quizId));
    try {
      const q = query(collection(this.db, "responses"), where("quizId", "==", quizId));
      const snap = await getDocs(q);
      const deletes = snap.docs.map((d) => deleteDoc(doc(this.db, "responses", d.id)));
      await Promise.all(deletes);
    } catch (_) {
    }
    return true;
  }
  async createResponse(data) {
    const respId = `resp_${crypto.randomUUID().slice(0, 11)}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const docData = {
      _id: respId,
      quizId: data.quizId,
      responderName: data.responderName.trim(),
      answers: data.answers,
      submittedAt: now
    };
    await setDoc(doc(this.db, "responses", respId), docData);
    return docData;
  }
  async getResponsesForQuiz(quizId) {
    const q = query(collection(this.db, "responses"), where("quizId", "==", quizId));
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => d.data());
    return list.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  }
  async deleteResponse(_quizId, responseId) {
    await deleteDoc(doc(this.db, "responses", responseId));
    return true;
  }
  async getStats() {
    const [quizzesSnap, responsesSnap] = await Promise.all([
      getDocs(collection(this.db, "quizzes")),
      getDocs(collection(this.db, "responses"))
    ]);
    return {
      totalQuizzes: quizzesSnap.size,
      totalResponses: responsesSnap.size
    };
  }
  async getStatus() {
    const stats = await this.getStats();
    return {
      provider: "firestore",
      isFirestoreConfigured: true,
      isConnectedToFirestore: true,
      message: "Connected to Firebase Firestore Cloud Database",
      totalQuizzes: stats.totalQuizzes,
      totalResponses: stats.totalResponses
    };
  }
  async upsertQuiz(quiz) {
    await setDoc(doc(this.db, "quizzes", quiz._id), quiz);
  }
  async upsertResponse(resp) {
    await setDoc(doc(this.db, "responses", resp._id), resp);
  }
  async reconnectMongo() {
    return true;
  }
};
function loadFirebaseConfig() {
  if (process.env.FIREBASE_CONFIG) {
    try {
      return JSON.parse(process.env.FIREBASE_CONFIG);
    } catch (_) {
    }
  }
  const baseDir = getBaseDir();
  const possiblePaths = [
    path.join(process.cwd(), "firebase-applet-config.json"),
    path.join(baseDir, "..", "firebase-applet-config.json"),
    path.join(baseDir, "firebase-applet-config.json")
  ];
  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, "utf8"));
      }
    } catch (_) {
    }
  }
  return {
    projectId: "gen-lang-client-0928069600",
    appId: "1:352732315322:web:537ac9d2c524968bba8c83",
    apiKey: "AIzaSyDEe5ijNjK-lLkJYYOHAaOxz1a4S0LiV28",
    authDomain: "gen-lang-client-0928069600.firebaseapp.com",
    firestoreDatabaseId: "ai-studio-bestie-8940a001-204f-471e-a965-b21e8e50073a",
    storageBucket: "gen-lang-client-0928069600.firebasestorage.app",
    messagingSenderId: "352732315322"
  };
}
var ResilientBestieDatabase = class {
  constructor() {
    this.firestoreDb = null;
    this.mongoDb = null;
    this.isFirestoreConfigured = false;
    this.isConnectedToFirestore = false;
    this.isMongoConfigured = false;
    this.isConnectedToMongo = false;
    this.lastError = null;
    this.lastFixGuide = null;
    this.autoRetryTimer = null;
    this.isReconnecting = false;
    this.localDb = new LocalBestieDatabase();
    this.activeDb = this.localDb;
  }
  async init() {
    await this.localDb.init();
    this.activeDb = this.localDb;
    const fbConnected = await this.tryConnectFirestore();
    if (fbConnected) {
      return;
    }
    const connected = await this.tryConnectMongo(false);
    if (!connected && this.isMongoConfigured) {
      this.startAutoRetry();
    }
  }
  async tryConnectFirestore() {
    try {
      const fbConfig = loadFirebaseConfig();
      if (!fbConfig || !fbConfig.projectId) {
        this.isFirestoreConfigured = false;
        return false;
      }
      this.isFirestoreConfigured = true;
      console.log("[Bestie DB] Initializing Firebase Firestore Cloud Database...");
      const candidate = new FirestoreBestieDatabase(fbConfig);
      await candidate.init();
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
        console.warn("[Bestie DB] Note during initial sync to Firestore:", syncErr);
      }
      this.firestoreDb = candidate;
      this.activeDb = candidate;
      this.isConnectedToFirestore = true;
      console.log("[Bestie DB] \u2705 Live connection to Firebase Firestore active! \u2601\uFE0F");
      return true;
    } catch (err) {
      console.warn("[Bestie DB] Firestore connection attempt:", err?.message || err);
      this.isConnectedToFirestore = false;
      return false;
    }
  }
  startAutoRetry() {
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
    }, 45e3);
    if (this.autoRetryTimer && typeof this.autoRetryTimer.unref === "function") {
      this.autoRetryTimer.unref();
    }
  }
  async tryConnectMongo(isBackgroundRetry = false) {
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
      const uri = rawUri.trim().replace(/^['"]|['"]$/g, "");
      if (!isBackgroundRetry) {
        console.log("[Bestie DB] Verifying MongoDB Atlas connection...");
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
        console.warn("[Bestie DB] Note during initial sync to MongoDB:", syncErr);
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
      console.log("[Bestie DB] \u2705 Live connection to MongoDB Atlas active!");
      return true;
    } catch (err) {
      const errMsg = err?.message || String(err);
      this.lastError = errMsg;
      this.isConnectedToMongo = false;
      return false;
    } finally {
      this.isReconnecting = false;
    }
  }
  async reconnectMongo() {
    if (this.isFirestoreConfigured) {
      const fb = await this.tryConnectFirestore();
      if (fb) return true;
    }
    return this.tryConnectMongo(false);
  }
  async getStatus() {
    const stats = await this.activeDb.getStats();
    const provider = this.isConnectedToFirestore ? "firestore" : this.isConnectedToMongo ? "mongodb" : "local";
    return {
      provider,
      isFirestoreConfigured: this.isFirestoreConfigured,
      isConnectedToFirestore: this.isConnectedToFirestore,
      isMongoConfigured: this.isMongoConfigured,
      isConnectedToMongo: this.isConnectedToMongo,
      message: this.isConnectedToFirestore ? "Connected to Firebase Firestore Cloud Database" : this.isConnectedToMongo ? "Connected to MongoDB Atlas" : "Running on Built-in Persistent DB",
      fixGuide: this.lastFixGuide || void 0,
      totalQuizzes: stats.totalQuizzes,
      totalResponses: stats.totalResponses
    };
  }
  // Delegate all IBestieDatabase methods to activeDb
  async createQuiz(data) {
    return this.activeDb.createQuiz(data);
  }
  async findQuizByShareCode(shareCode) {
    return this.activeDb.findQuizByShareCode(shareCode);
  }
  async findQuizByManagementHash(hash) {
    return this.activeDb.findQuizByManagementHash(hash);
  }
  async deleteQuiz(quizId) {
    return this.activeDb.deleteQuiz(quizId);
  }
  async createResponse(data) {
    return this.activeDb.createResponse(data);
  }
  async getResponsesForQuiz(quizId) {
    return this.activeDb.getResponsesForQuiz(quizId);
  }
  async deleteResponse(quizId, responseId) {
    return this.activeDb.deleteResponse(quizId, responseId);
  }
  async getStats() {
    return this.activeDb.getStats();
  }
};
var dbInstance = null;
async function getDatabase() {
  if (dbInstance) return dbInstance;
  const resilientDb = new ResilientBestieDatabase();
  await resilientDb.init();
  dbInstance = resilientDb;
  return dbInstance;
}
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
function generateToken(length = 24) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    token += chars[randomBytes[i] % chars.length];
  }
  return token;
}
function generateShareCode(length = 7) {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let code = "";
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    code += chars[randomBytes[i] % chars.length];
  }
  return code;
}

// src/utils/answerValidator.ts
var FRIENDLY_MESSAGES = {
  empty: "\u{1F440} Give me a real answer bestie!",
  too_short: "A little more detail, bestie! What specifically? \u{1F440}",
  evasive_idk: "Come onnn, you know this one \u{1F440}",
  evasive_no: "A simple 'no' is too vague bestie! Tell me a bit more \u{1F440}",
  evasive_general: "\u{1F440} Give me a real answer bestie!",
  gibberish: "\u{1F62D} That doesn't look like an answer. Try again!",
  emoji_only: "\u{1F62D} Emojis are cute, but give me some real words too bestie! \u{1F48C}",
  punctuation_only: "\u{1F62D} That doesn't look like an answer. Try again!",
  repeated_chars: "Come onnn, stop smashing the keys bestie! \u2328\uFE0F\u{1F602}",
  person_context_mismatch: "Wait, that doesn't answer this question! Give me a real answer bestie \u{1F440}",
  default_reject: "\u{1F62D} That doesn't look like an answer. Try again!"
};
var LAZY_EXACT_TOKENS = /* @__PURE__ */ new Set([
  "no",
  "nope",
  "nah",
  "na",
  "nop",
  "none",
  "nothing",
  "nil",
  "zero",
  "n/a",
  "na",
  "unknown",
  "blank",
  "idk",
  "i dk",
  "ikd",
  "i dont know",
  "i don't know",
  "dont know",
  "don't know",
  "dont knw",
  "dnt know",
  "dunno",
  "no idea",
  "have no idea",
  "i have no idea",
  "no clue",
  "zero clue",
  "dont have",
  "don't have",
  "i dont have",
  "i don't have",
  "asdf",
  "asdfg",
  "asdfgh",
  "asdfghjk",
  "asdfghjkl",
  "qwerty",
  "qwertyuiop",
  "zxcv",
  "zxcvb",
  "zxcvbn",
  "zxcvbnm",
  "xyz",
  "abc",
  "123",
  "1234",
  "12345",
  "123456",
  "test",
  "testing",
  "answer",
  "pass",
  "skip",
  "whatever",
  "idc",
  "i dont care",
  "i don't care"
]);
function isPersonOrWhoQuestion(questionText) {
  if (!questionText) return false;
  const q = questionText.toLowerCase();
  return q.includes("who") || q.includes("crush") || q.includes("bestie") || q.includes("dating") || q.includes("partner") || q.includes("in love") || q.includes("friend");
}
function isOnlyEmojis(str) {
  const clean = str.trim();
  if (!clean) return false;
  const emojiRegex = /^[\p{Extended_Pictographic}\s\uFE0F\u200D]+$/u;
  return emojiRegex.test(clean);
}
function isOnlyPunctuationOrSymbols(str) {
  const clean = str.trim();
  if (!clean) return false;
  return /^[\p{P}\p{S}\s]+$/u.test(clean);
}
function isKeyboardSmashOrGibberish(str) {
  const lower = str.toLowerCase().replace(/[^a-z]/g, "");
  if (lower.length === 0) return false;
  const commonKeyboardSmashRows = [
    "asdf",
    "sdfg",
    "dfgh",
    "fghj",
    "ghjk",
    "hjkl",
    "qwerty",
    "werty",
    "ertyu",
    "rtyui",
    "tyuio",
    "yuiop",
    "zxcv",
    "xcvb",
    "cvbn",
    "vbnm",
    "qazw",
    "wsxe",
    "edcr",
    "rfvt",
    "tgby",
    "yhnm"
  ];
  for (const row of commonKeyboardSmashRows) {
    if (lower.includes(row) && lower.length <= row.length + 3) {
      return true;
    }
  }
  if (/(.)\1{3,}/.test(lower)) {
    const match = lower.match(/(.)\1{3,}/);
    if (match && match[0].length >= lower.length * 0.6) {
      return true;
    }
  }
  if (/^([a-z]{2})\1{2,}$/.test(lower)) {
    if (!lower.startsWith("ha") && !lower.startsWith("he")) {
      return true;
    }
  }
  const words = str.toLowerCase().split(/\s+/).map((w) => w.replace(/[^a-z]/g, ""));
  for (const w of words) {
    if (w.length >= 5) {
      const vowels = w.match(/[aeiouy]/g);
      const vowelCount = vowels ? vowels.length : 0;
      if (vowelCount === 0) {
        return true;
      }
      if (/[bcdfghjklmnpqrstvwxz]{5,}/.test(w)) {
        return true;
      }
    }
  }
  return false;
}
function validateAnswer(questionText, answerText) {
  const raw = answerText || "";
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return {
      isValid: false,
      message: FRIENDLY_MESSAGES.empty,
      reason: "empty"
    };
  }
  if (isOnlyEmojis(trimmed)) {
    return {
      isValid: false,
      message: FRIENDLY_MESSAGES.emoji_only,
      reason: "emoji_only"
    };
  }
  if (isOnlyPunctuationOrSymbols(trimmed)) {
    return {
      isValid: false,
      message: FRIENDLY_MESSAGES.punctuation_only,
      reason: "punctuation_only"
    };
  }
  const normalized = trimmed.toLowerCase().replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu, "").trim();
  if (/^(.)\1{2,}$/.test(normalized) && normalized.length >= 3) {
    return {
      isValid: false,
      message: FRIENDLY_MESSAGES.repeated_chars,
      reason: "gibberish"
    };
  }
  if (isKeyboardSmashOrGibberish(trimmed)) {
    return {
      isValid: false,
      message: FRIENDLY_MESSAGES.gibberish,
      reason: "gibberish"
    };
  }
  const isPersonQ = isPersonOrWhoQuestion(questionText);
  const validPersonAbsencePhrases = [
    "no one",
    "nobody",
    "nobody right now",
    "no one right now",
    "no one yet",
    "nobody yet",
    "single",
    "currently single",
    "i am single",
    "i'm single",
    "none right now"
  ];
  const isPersonAbsenceAnswer = validPersonAbsencePhrases.some(
    (p) => normalized === p || normalized.startsWith(p + " ") || normalized.startsWith(p + ",")
  );
  if (isPersonAbsenceAnswer) {
    if (isPersonQ) {
      return { isValid: true };
    } else {
      return {
        isValid: false,
        message: FRIENDLY_MESSAGES.person_context_mismatch,
        reason: "context_mismatch"
      };
    }
  }
  const isFullExplanatoryPhrase = normalized.startsWith("i don't have ") || normalized.startsWith("i dont have ") || normalized.startsWith("i haven't ") || normalized.startsWith("i havent ") || normalized.startsWith("still exploring") || normalized.startsWith("still deciding") || normalized.startsWith("not sure yet");
  if (isFullExplanatoryPhrase) {
    if (normalized.length >= 12) {
      return { isValid: true };
    }
  }
  if (LAZY_EXACT_TOKENS.has(normalized)) {
    if (normalized === "idk" || normalized === "i dk" || normalized.includes("dont know") || normalized.includes("don't know")) {
      return {
        isValid: false,
        message: FRIENDLY_MESSAGES.evasive_idk,
        reason: "evasive"
      };
    }
    if (normalized === "no" || normalized === "nope" || normalized === "nah") {
      return {
        isValid: false,
        message: FRIENDLY_MESSAGES.evasive_no,
        reason: "evasive"
      };
    }
    return {
      isValid: false,
      message: FRIENDLY_MESSAGES.evasive_general,
      reason: "evasive"
    };
  }
  const knownShortAnswers = /* @__PURE__ */ new Set(["me", "us", "ai", "bmw", "gt", "m4", "m3", "m5", "amg", "f1", "911", "rs"]);
  if (normalized.length <= 2 && !knownShortAnswers.has(normalized)) {
    return {
      isValid: false,
      message: FRIENDLY_MESSAGES.too_short,
      reason: "too_short"
    };
  }
  const wordTokens = trimmed.split(/\s+/).filter((w) => w.length > 0);
  if (wordTokens.length === 0) {
    return {
      isValid: false,
      message: FRIENDLY_MESSAGES.empty,
      reason: "empty"
    };
  }
  return { isValid: true };
}

// server/app.ts
dotenv.config();
var app = express();
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});
var apiRouter = express.Router();
apiRouter.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "bestie-backend",
    env: process.env.NODE_ENV || "development",
    serverless: !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)
  });
});
apiRouter.get("/db-status", async (req, res) => {
  try {
    const db = await getDatabase();
    const status = await db.getStatus();
    res.json({ success: true, ...status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || "Failed to check database status" });
  }
});
apiRouter.post("/db/retry", async (req, res) => {
  try {
    const db = await getDatabase();
    const connected = await db.reconnectMongo();
    const status = await db.getStatus();
    res.json({ success: true, connected, status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || "Reconnect attempt failed" });
  }
});
apiRouter.get("/stats", async (req, res) => {
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
      isMongoConfigured: dbStatus.isMongoConfigured
    });
  } catch (err) {
    console.error("[Bestie API] Stats error:", err);
    res.status(500).json({ error: "Failed to fetch platform stats" });
  }
});
apiRouter.post("/quizzes", async (req, res) => {
  try {
    const db = await getDatabase();
    const { title, questions } = req.body;
    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "Quiz title is required" });
    }
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: "At least one question is required" });
    }
    const sanitizedQuestions = questions.map((q, idx) => {
      const text = typeof q.text === "string" ? q.text.trim() : "";
      if (!text) {
        throw new Error(`Question #${idx + 1} cannot be empty`);
      }
      return {
        id: typeof q.id === "string" && q.id ? q.id : `q_${idx + 1}_${Date.now()}`,
        text,
        position: typeof q.position === "number" ? q.position : idx + 1,
        required: q.required !== false
      };
    });
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
    const managementToken = generateToken(28);
    const managementTokenHash = hashToken(managementToken);
    const quizDoc = await db.createQuiz({
      title: title.trim(),
      questions: sanitizedQuestions,
      shareCode,
      managementTokenHash
    });
    console.log(`[Bestie API] Created new quiz: ${quizDoc._id} (shareCode: ${shareCode})`);
    res.status(201).json({
      success: true,
      shareCode,
      managementToken,
      quiz: {
        id: quizDoc._id,
        title: quizDoc.title,
        questionsCount: quizDoc.questions.length,
        createdAt: quizDoc.createdAt
      }
    });
  } catch (err) {
    console.error("[Bestie API] Create quiz error:", err);
    res.status(400).json({ error: err.message || "Failed to create quiz" });
  }
});
function cleanParam(val) {
  if (typeof val !== "string") return "";
  return val.trim().replace(/\/+$/, "");
}
apiRouter.get(["/quizzes/:shareCode", "/quizzes/:shareCode/"], async (req, res) => {
  try {
    const db = await getDatabase();
    const shareCode = cleanParam(req.params.shareCode);
    if (!shareCode) {
      return res.status(400).json({ error: "Quiz share code is required" });
    }
    const quiz = await db.findQuizByShareCode(shareCode);
    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found. Please check your link." });
    }
    res.json({
      success: true,
      quiz: {
        id: quiz._id,
        title: quiz.title,
        questions: quiz.questions.map((q) => ({
          id: q.id,
          text: q.text,
          position: q.position,
          required: q.required
        })),
        createdAt: quiz.createdAt
      }
    });
  } catch (err) {
    console.error("[Bestie API] Fetch quiz error:", err);
    res.status(500).json({ error: "Failed to fetch quiz" });
  }
});
apiRouter.post(["/quizzes/:shareCode/responses", "/quizzes/:shareCode/responses/"], async (req, res) => {
  try {
    const db = await getDatabase();
    const shareCode = cleanParam(req.params.shareCode);
    const { responderName, answers } = req.body;
    const quiz = await db.findQuizByShareCode(shareCode);
    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" });
    }
    if (!responderName || typeof responderName !== "string" || !responderName.trim()) {
      return res.status(400).json({ error: "Please enter your name" });
    }
    if (!Array.isArray(answers)) {
      return res.status(400).json({ error: "Answers must be provided" });
    }
    const answerMap = /* @__PURE__ */ new Map();
    for (const ans of answers) {
      if (ans && typeof ans.questionId === "string" && typeof ans.answerText === "string") {
        answerMap.set(ans.questionId, ans.answerText.trim());
      }
    }
    const formattedAnswers = [];
    for (const q of quiz.questions) {
      const rawText = answerMap.get(q.id) || "";
      const validation = validateAnswer(q.text, rawText);
      if (!validation.isValid) {
        return res.status(400).json({
          error: validation.message || "\u{1F440} Give me a real answer bestie!",
          questionId: q.id,
          questionText: q.text,
          reason: validation.reason
        });
      }
      formattedAnswers.push({
        questionId: q.id,
        answerText: rawText
      });
    }
    const responseDoc = await db.createResponse({
      quizId: quiz._id,
      responderName: responderName.trim(),
      answers: formattedAnswers
    });
    console.log(`[Bestie API] New response from "${responderName}" for quiz ${quiz._id}`);
    res.status(201).json({
      success: true,
      responseId: responseDoc._id,
      submittedAt: responseDoc.submittedAt
    });
  } catch (err) {
    console.error("[Bestie API] Submit response error:", err);
    res.status(500).json({ error: "Failed to save responses" });
  }
});
apiRouter.get(["/quizzes/manage/:token", "/quizzes/manage/:token/"], async (req, res) => {
  try {
    const db = await getDatabase();
    const token = cleanParam(req.params.token);
    if (!token) {
      return res.status(400).json({ error: "Management token is required" });
    }
    const hash = hashToken(token);
    const quiz = await db.findQuizByManagementHash(hash);
    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found or invalid private management token" });
    }
    const responses = await db.getResponsesForQuiz(quiz._id);
    res.json({
      success: true,
      quiz: {
        id: quiz._id,
        title: quiz.title,
        shareCode: quiz.shareCode,
        questions: quiz.questions,
        createdAt: quiz.createdAt
      },
      responses
    });
  } catch (err) {
    console.error("[Bestie API] Manage quiz error:", err);
    res.status(500).json({ error: "Failed to access quiz management" });
  }
});
apiRouter.delete(["/quizzes/manage/:token/responses/:responseId", "/quizzes/manage/:token/responses/:responseId/"], async (req, res) => {
  try {
    const db = await getDatabase();
    const token = cleanParam(req.params.token);
    const responseId = cleanParam(req.params.responseId);
    const hash = hashToken(token);
    const quiz = await db.findQuizByManagementHash(hash);
    if (!quiz) {
      return res.status(404).json({ error: "Invalid management token" });
    }
    const deleted = await db.deleteResponse(quiz._id, responseId);
    if (!deleted) {
      return res.status(404).json({ error: "Response not found" });
    }
    res.json({ success: true, message: "Response deleted" });
  } catch (err) {
    console.error("[Bestie API] Delete response error:", err);
    res.status(500).json({ error: "Failed to delete response" });
  }
});
apiRouter.delete(["/quizzes/manage/:token", "/quizzes/manage/:token/"], async (req, res) => {
  try {
    const db = await getDatabase();
    const token = cleanParam(req.params.token);
    const hash = hashToken(token);
    const quiz = await db.findQuizByManagementHash(hash);
    if (!quiz) {
      return res.status(404).json({ error: "Invalid management token" });
    }
    await db.deleteQuiz(quiz._id);
    console.log(`[Bestie API] Creator deleted quiz ${quiz._id}`);
    res.json({ success: true, message: "Quiz and all its responses deleted successfully" });
  } catch (err) {
    console.error("[Bestie API] Delete quiz error:", err);
    res.status(500).json({ error: "Failed to delete quiz" });
  }
});
app.use("/api", apiRouter);
app.use(apiRouter);
app.all("/api/*", (req, res) => {
  res.status(404).json({
    success: false,
    error: `API route not found: ${req.method} ${req.originalUrl}`
  });
});
app.use("/api", (err, req, res, next) => {
  console.error("[Bestie API Unhandled Error]:", err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.status || 500).json({
    success: false,
    error: err.message || "An unexpected server error occurred"
  });
});

// api/index.ts
var dbInitPromise = null;
async function ensureDb() {
  if (!dbInitPromise) {
    dbInitPromise = getDatabase().catch((err) => {
      console.warn("[Bestie Serverless] DB init notice:", err);
      dbInitPromise = null;
      return null;
    });
  }
  return dbInitPromise;
}
async function handler(req, res) {
  try {
    await ensureDb();
  } catch (_) {
  }
  return app(req, res);
}
export {
  handler as default
};
