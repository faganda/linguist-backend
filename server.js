import express from 'express';
import cors from 'cors';
import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import crypto from 'node:crypto';

const app = express();
const port = process.env.PORT || 3000;
const ADMIN_UID = process.env.ADMIN_UID || 'rJvQjMmE6qMKmazel2NyvgGcVHw2';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const allowedOrigins = (process.env.FRONTEND_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean);

function initialiseFirebaseAdmin() {
    if (getApps().length) return getApps()[0];
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        const credential = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        return initializeApp({ credential: cert(credential) });
    }
    return initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID || 'mylinguist28' });
}

initialiseFirebaseAdmin();
const auth = getAuth();
const db = getFirestore();

app.disable('x-powered-by');
app.use(cors({ origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed'));
}}));
app.use(express.json({ limit: '10mb' }));

const requestBuckets = new Map();
setInterval(() => { const now=Date.now(); for (const [key,bucket] of requestBuckets) if (bucket.resetAt<=now) requestBuckets.delete(key); }, 15 * 60_000).unref();
function rateLimit({ windowMs, max, key = req => req.ip }) {
    return (req, res, next) => {
        const now = Date.now(); const bucketKey = key(req); const current = requestBuckets.get(bucketKey);
        if (!current || current.resetAt <= now) requestBuckets.set(bucketKey, { count:1, resetAt:now + windowMs });
        else if (++current.count > max) return res.status(429).json({ error:{ message:'Too many requests. Please try again later.' } });
        next();
    };
}

async function requireUser(req, res, next) {
    try {
        const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
        if (!token) return res.status(401).json({ error:{ message:'Authentication required.' } });
        req.user = await auth.verifyIdToken(token, true); next();
    } catch (_) { return res.status(401).json({ error:{ message:'Invalid or expired session.' } }); }
}
function requireAdmin(req, res, next) {
    if (req.user?.uid !== ADMIN_UID && req.user?.admin !== true) return res.status(403).json({ error:{ message:'Administrator access required.' } });
    next();
}

async function recordUsage(uid, operation, metadata = {}) {
    const day = new Date().toISOString().slice(0, 10); const ref = db.doc(`admin_metrics/api_usage/days/${day}`);
    await ref.set({ day, updatedAt:FieldValue.serverTimestamp(),
        total:FieldValue.increment(1), operations:{ [operation]:FieldValue.increment(1) } }, { merge:true });
    await db.collection('admin_metrics').doc('events').collection('items').add({ uid, operation, metadata, timestamp:FieldValue.serverTimestamp() });
}

async function callGemini(body) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('Server misconfiguration: GEMINI_API_KEY is missing.');
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
        method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok) { const error = new Error(data?.error?.message || 'Gemini request failed.'); error.status = response.status; throw error; }
    return data;
}

app.get('/health', (_req, res) => res.json({ ok:true, service:'linguist-backend', model:GEMINI_MODEL }));

app.post('/api/auth/email-exists', rateLimit({ windowMs:15 * 60_000, max:20, key:req => `email:${req.ip}` }), async (req, res) => {
    try { await auth.getUserByEmail(String(req.body?.email || '').trim().toLowerCase()); res.json({ exists:true }); }
    catch (error) { if (error.code === 'auth/user-not-found') return res.json({ exists:false }); res.status(500).json({ error:{ message:'Unable to check that account.' } }); }
});

app.post('/api/gemini', requireUser, rateLimit({ windowMs:60 * 60_000, max:80, key:req => `gemini:${req.user.uid}` }), async (req, res) => {
    try {
        const data = await callGemini(req.body); recordUsage(req.user.uid, 'gemini').catch(() => {}); res.json(data);
    } catch (error) { res.status(error.status || 500).json({ error:{ message:error.message } }); }
});

app.post('/api/jobs', requireUser, rateLimit({ windowMs:60 * 60_000, max:20, key:req => `jobs:${req.user.uid}` }), async (req, res) => {
    const jobRef = db.collection('translation_jobs').doc();
    await jobRef.set({ uid:req.user.uid, status:'queued', createdAt:FieldValue.serverTimestamp(), requestHash:crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex') });
    res.status(202).json({ jobId:jobRef.id, status:'queued' });
    try {
        await jobRef.update({ status:'running', startedAt:FieldValue.serverTimestamp() });
        const result = await callGemini(req.body);
        await jobRef.update({ status:'completed', result, completedAt:FieldValue.serverTimestamp() });
        recordUsage(req.user.uid, 'background_job').catch(() => {});
    } catch (error) { await jobRef.update({ status:'failed', error:error.message, completedAt:FieldValue.serverTimestamp() }); }
});
app.get('/api/jobs/:id', requireUser, async (req, res) => {
    const snap = await db.collection('translation_jobs').doc(req.params.id).get();
    if (!snap.exists || (snap.data().uid !== req.user.uid && req.user.uid !== ADMIN_UID)) return res.status(404).json({ error:{ message:'Job not found.' } });
    res.json({ id:snap.id, ...snap.data() });
});

app.post('/api/admin/bootstrap', requireUser, requireAdmin, async (req, res) => {
    await auth.setCustomUserClaims(req.user.uid, { admin:true });
    res.json({ ok:true, message:'Administrator claim assigned. Sign out and back in to refresh it.' });
});
app.get('/api/admin/metrics', requireUser, requireAdmin, async (_req, res) => {
    const [days, jobs] = await Promise.all([
        db.collection('admin_metrics').doc('api_usage').collection('days').orderBy('day', 'desc').limit(30).get(),
        db.collection('translation_jobs').orderBy('createdAt', 'desc').limit(50).get()
    ]);
    res.json({ usage:days.docs.map(d => ({ id:d.id, ...d.data() })), jobs:jobs.docs.map(d => ({ id:d.id, ...d.data(), result:undefined })) });
});
app.get('/api/admin/dictionary', requireUser, requireAdmin, async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const snap = await db.collectionGroup('global_dictionary').limit(limit).get();
    res.json({ entries:snap.docs.map(d => ({ id:d.id, path:d.ref.path, ...d.data(), fullJSON:undefined })) });
});
app.delete('/api/admin/dictionary/:id', requireUser, requireAdmin, async (req, res) => {
    await db.doc(`artifacts/linguist-app-v7/public/data/global_dictionary/${req.params.id}`).delete(); res.json({ ok:true });
});

app.use((error, _req, res, _next) => res.status(error.message === 'Origin not allowed' ? 403 : 500).json({ error:{ message:error.message } }));
app.listen(port, () => console.log(`Linguist secure backend running on port ${port}`));
