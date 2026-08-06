import express from 'express';
import cors from 'cors';
import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { Resend } from 'resend';
import crypto from 'node:crypto';
import {
    LANGUAGES, PRIMARY_MODEL, PRIMARY_THINKING, FALLBACK_MODEL, FALLBACK_THINKING,
    DICTIONARY_SCHEMA_VERSION, PREVIEW_SCHEMA_VERSION, TRANSLATION_LIST_SCHEMA_VERSION,
    createTranslationService, buildGeminiCompatibilityRequests,
    geminiCompatibilityKey, isGeminiInvalidArgument, parseGeminiJSON,
    dictionaryDocumentId, normalizeTranslationResult, coreQualityIssues
} from './translation-service.js';
import {
    buildLearningRequest, focusedPracticeQualityIssues, summarizePerformanceEvents
} from './learning-service.js';

const app = express();
const port = process.env.PORT || 3000;
const BACKEND_VERSION = '5.0.4';
const APP_ID = process.env.APP_ID || 'linguist-app-v7';
const ADMIN_UID = process.env.ADMIN_UID || 'rJvQjMmE6qMKmazel2NyvgGcVHw2';
const FEEDBACK_EMAIL_TO = process.env.FEEDBACK_EMAIL_TO || 'feedback@qelumi.com';
const FEEDBACK_EMAIL_FROM = process.env.FEEDBACK_EMAIL_FROM || '';
const allowedOrigins = (process.env.FRONTEND_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
const nativeOrigins = new Set(['capacitor://localhost', 'https://localhost', 'http://localhost']);
const feedbackCategories = new Set(['suggestion', 'glitch', 'translation', 'other']);
const feedbackStatuses = new Set(['new', 'read', 'closed']);
const translationSources = new Set(['generated', 'dictionary_repair', 'global_dictionary', 'personal_history', 'image_analysis', 'language_validation']);
const translationOutcomes = new Set(['success', 'definitions_only', 'language_mismatch', 'not_found', 'error']);
const dictionaryQualityStatuses = new Set(['generated', 'complete', 'verified', 'reported', 'stale', 'superseded']);
const productEventNames = new Set([
    'session_started', 'screen_view', 'onboarding_step', 'onboarding_completed',
    'registration_prompt_shown', 'registration_prompt_accepted',
    'translation_result_viewed', 'translation_shared', 'word_remembered',
    'daily_plan_opened', 'daily_plan_activity_started', 'daily_plan_summary',
    'client_error', 'referral_shared', 'subscription_viewed', 'subscription_started',
    'subscription_restored', 'conversation_invite_shared', 'library_item_opened'
]);

function initialiseFirebaseAdmin() {
    if (getApps().length) return getApps()[0];
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        const credential = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        return initializeApp({ credential:cert(credential) });
    }
    return initializeApp({ credential:applicationDefault(), projectId:process.env.FIREBASE_PROJECT_ID || 'mylinguist28' });
}

initialiseFirebaseAdmin();
const auth = getAuth();
const db = getFirestore();
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const feedbackCollection = () => db.collection('artifacts').doc(APP_ID).collection('public').doc('data').collection('feedback');
const translationSearchCollection = () => db.collection('admin_metrics').doc('translation_searches').collection('items');
const administratorRolesCollection = () => db.collection('admin_roles');
const administratorAuditCollection = () => db.collection('admin_role_audit');
const qelumiProfilesCollection = () => db.collection('qelumi_profiles');
const qelumiUsernamesCollection = () => db.collection('qelumi_usernames');
const liveConversationsCollection = () => db.collection('live_conversations');
const productEventsCollection = () => db.collection('admin_metrics').doc('product_events').collection('items');
const billingEntitlementsCollection = () => db.collection('billing_entitlements');
const billingUsageCollection = () => db.collection('billing_usage');
const referralCodesCollection = () => db.collection('referral_codes');
const referralClaimsCollection = () => db.collection('referral_claims');
const focusedPracticeCache = new Map();
const focusedPracticeFlights = new Map();
const administratorRoleDocumentId = uid => crypto.createHash('sha256').update(String(uid || '')).digest('hex');
const stableHash = value => crypto.createHash('sha256').update(String(value || '')).digest('hex');
const publicReferralCode = uid => crypto.createHash('sha256').update(`qelumi-referral|${uid}`).digest('base64url').slice(0, 10).toUpperCase();
const currentBillingMonth = () => new Date().toISOString().slice(0, 7);
const dictionaryReference = id => db.doc(`artifacts/${APP_ID}/public/data/global_dictionary/${id}`);
const dictionaryContext = data => ({
    query:String(data?.originalQuery || data?.queryLower || ''),
    fromLang:String(data?.fromLang || ''), toLang:String(data?.toLang || ''),
    definitionsOnly:String(data?.fromLang || '') === String(data?.toLang || '')
});
const productAnalyticsKeys = new Set([
    'screen', 'source', 'outcome', 'activity', 'plan', 'platform', 'isGuest',
    'fromLang', 'toLang', 'cacheStatus', 'qualityStatus', 'step', 'count',
    'durationMs', 'latencyMs', 'errorCode', 'permission', 'method', 'version'
]);
function cleanProductMetadata(value = {}) {
    const safe = {};
    for (const [key, raw] of Object.entries(value || {})) {
        if (!productAnalyticsKeys.has(key)) continue;
        if (typeof raw === 'boolean') safe[key] = raw;
        else if (typeof raw === 'number' && Number.isFinite(raw)) safe[key] = Math.max(-1_000_000_000, Math.min(1_000_000_000, raw));
        else if (typeof raw === 'string') safe[key] = raw.replace(/[\r\n]/g, ' ').slice(0, 80);
    }
    return safe;
}
const normalizeUsername = value => String(value || '').normalize('NFKC').trim().toLocaleLowerCase('en');
const reservedUsernames = new Set(['admin','administrator','qelumi','support','feedback','system','official','moderator']);
const privateInviteAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const timestampMillis = value => value?.toMillis?.() || Number(value) || 0;
const htmlEscape = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[character]));
const validEmail = value => typeof value === 'string' && value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const categoryLabel = value => ({
    suggestion:'Feature suggestion', glitch:'Glitch / bug', translation:'Translation error', other:'Other'
}[value] || 'Other');
const sourceLabel = value => ({
    generated:'New — generated by API', dictionary_repair:'Existing dictionary entry repaired by API', global_dictionary:'Already in global dictionary',
    personal_history:'Already in user history', image_analysis:'New image analysis',
    language_validation:'Language validation'
}[value] || 'Unknown');
app.disable('x-powered-by');

// This route must receive the unparsed request body so Resend's signature can be verified.
app.post('/api/webhooks/resend', express.raw({ type:'application/json', limit:'1mb' }), async (req, res) => {
    try {
        if (!resend || !process.env.RESEND_WEBHOOK_SECRET) return res.status(503).json({ error:{ message:'Email webhook is not configured.' } });
        const event = resend.webhooks.verify({
            payload:req.body.toString('utf8'),
            headers:{
                id:req.get('svix-id'), timestamp:req.get('svix-timestamp'), signature:req.get('svix-signature')
            },
            webhookSecret:process.env.RESEND_WEBHOOK_SECRET
        });
        const emailId = event?.data?.email_id;
        if (!emailId) return res.json({ ok:true });
        const matches = await feedbackCollection().where('notificationEmailId', '==', emailId).limit(5).get();
        const status = event.type === 'email.delivered' ? 'delivered'
            : ['email.bounced', 'email.complained', 'email.failed', 'email.suppressed'].includes(event.type) ? 'failed'
                : event.type === 'email.delivery_delayed' ? 'delayed'
                    : event.type === 'email.sent' ? 'sent' : null;
        if (status) {
            await Promise.all(matches.docs.map(document => document.ref.update({
                notificationStatus:status,
                notificationEvent:event.type,
                notificationUpdatedAt:FieldValue.serverTimestamp(),
                ...(status === 'delivered' ? { notificationDeliveredAt:FieldValue.serverTimestamp() } : {})
            })));
        }
        res.json({ ok:true });
    } catch (error) {
        res.status(400).json({ error:{ message:'Invalid webhook request.' } });
    }
});

app.use(cors({ origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin) || nativeOrigins.has(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed'));
} }));
app.use(express.json({ limit:'10mb' }));

const requestBuckets = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of requestBuckets) if (bucket.resetAt <= now) requestBuckets.delete(key);
}, 15 * 60_000).unref();

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
        req.user = await auth.verifyIdToken(token, true);
        next();
    } catch (_) {
        return res.status(401).json({ error:{ message:'Invalid or expired session.' } });
    }
}

function requireRegisteredUser(req, res, next) {
    if (req.user?.firebase?.sign_in_provider === 'anonymous') {
        return res.status(403).json({ error:{ message:'Sign in with a registered account to use connected conversations.' } });
    }
    next();
}

function requireAdmin(req, res, next) {
    if (req.user?.uid !== ADMIN_UID && req.user?.admin !== true) return res.status(403).json({ error:{ message:'Administrator access required.' } });
    next();
}

async function deleteDocumentTree(documentReference) {
    const childCollections = await documentReference.listCollections();
    for (const childCollection of childCollections) await deleteCollectionTree(childCollection);
    await documentReference.delete();
}

async function deleteCollectionTree(collectionReference) {
    while (true) {
        const snapshot = await collectionReference.limit(200).get();
        if (snapshot.empty) return;
        const childCollectionGroups = await Promise.all(snapshot.docs.map(documentSnapshot => documentSnapshot.ref.listCollections()));
        for (const childCollections of childCollectionGroups) {
            for (const childCollection of childCollections) await deleteCollectionTree(childCollection);
        }
        const batch = db.batch();
        snapshot.docs.forEach(documentSnapshot => batch.delete(documentSnapshot.ref));
        await batch.commit();
    }
}

async function deleteMatchingDocuments(queryReference) {
    let deleted = 0;
    while (true) {
        const snapshot = await queryReference.limit(200).get();
        if (snapshot.empty) return deleted;
        const batch = db.batch();
        snapshot.docs.forEach(documentSnapshot => batch.delete(documentSnapshot.ref));
        await batch.commit();
        deleted += snapshot.size;
    }
}

async function removeUserFromLiveConversations(uid) {
    const rooms = await liveConversationsCollection().where('memberUids', 'array-contains', uid).get();
    for (const roomSnapshot of rooms.docs) {
        const room = roomSnapshot.data() || {};
        await deleteMatchingDocuments(roomSnapshot.ref.collection('messages').where('senderUid', '==', uid));
        const remainingUids = (Array.isArray(room.memberUids) ? room.memberUids : []).filter(memberUid => memberUid !== uid);
        const remainingParticipants = participantList(room.participants).filter(participant => participant.uid !== uid);
        if (!remainingUids.length) {
            await deleteDocumentTree(roomSnapshot.ref);
        } else {
            await roomSnapshot.ref.update({
                memberUids:remainingUids,
                participants:remainingParticipants,
                status:'closed',
                inviteCode:'',
                updatedAt:FieldValue.serverTimestamp(),
                updatedAtMs:Date.now()
            });
        }
    }
    return rooms.size;
}

async function deleteQelumiAccountData(userToken) {
    const uid = String(userToken.uid || '');
    const email = String(userToken.email || '').trim().toLowerCase();
    const profileReference = qelumiProfilesCollection().doc(uid);
    const profileSnapshot = await profileReference.get();
    const normalizedUsername = normalizeUsername(profileSnapshot.data()?.username || '');

    await deleteDocumentTree(db.doc(`artifacts/${APP_ID}/users/${uid}`));
    await deleteDocumentTree(billingUsageCollection().doc(uid));
    await removeUserFromLiveConversations(uid);
    await Promise.all([
        deleteMatchingDocuments(feedbackCollection().where('uid', '==', uid)),
        deleteMatchingDocuments(translationSearchCollection().where('uid', '==', uid)),
        deleteMatchingDocuments(db.collection('translation_jobs').where('uid', '==', uid)),
        deleteMatchingDocuments(db.collection('admin_metrics').doc('events').collection('items').where('uid', '==', uid)),
        deleteMatchingDocuments(productEventsCollection().where('userHash', '==', stableHash(uid))),
        deleteMatchingDocuments(referralCodesCollection().where('uid', '==', uid)),
        deleteMatchingDocuments(referralClaimsCollection().where('inviterUid', '==', uid))
    ]);

    const directDeletes = [
        profileReference.delete(),
        administratorRolesCollection().doc(administratorRoleDocumentId(uid)).delete(),
        billingEntitlementsCollection().doc(uid).delete(),
        referralClaimsCollection().doc(uid).delete()
    ];
    if (normalizedUsername) directDeletes.push(qelumiUsernamesCollection().doc(stableHash(normalizedUsername)).delete());
    if (email) directDeletes.push(db.doc(`artifacts/${APP_ID}/public/data/registered_accounts/${stableHash(email)}`).delete());
    await Promise.all(directDeletes);
    await auth.deleteUser(uid);
}

async function resolveAdministratorTarget(identifier) {
    const value = String(identifier || '').trim();
    if (!value || value.length > 320) {
        const error = new Error('Enter an exact Firebase email address or UID.');
        error.status = 400;
        throw error;
    }
    try {
        return value.includes('@')
            ? await auth.getUserByEmail(value.toLowerCase())
            : await auth.getUser(value);
    } catch (error) {
        if (error.code === 'auth/user-not-found') {
            const notFound = new Error('No Firebase account matches that email address or UID.');
            notFound.status = 404;
            throw notFound;
        }
        throw error;
    }
}

const publicAdministratorRecord = userRecord => ({
    uid:userRecord.uid,
    email:userRecord.email || '',
    displayName:userRecord.displayName || '',
    disabled:userRecord.disabled === true,
    admin:userRecord.uid === ADMIN_UID || userRecord.customClaims?.admin === true,
    primary:userRecord.uid === ADMIN_UID
});

function cleanUsername(value) {
    const username = String(value || '').normalize('NFKC').trim();
    if (!/^[\p{L}\p{N}][\p{L}\p{N}._-]{2,23}$/u.test(username)) {
        const error = new Error('Use 3–24 letters or numbers, with optional dots, underscores or hyphens.');
        error.status = 400;
        throw error;
    }
    const normalized = normalizeUsername(username);
    if (reservedUsernames.has(normalized)) {
        const error = new Error('That username is reserved. Please choose another.');
        error.status = 409;
        throw error;
    }
    return { username, normalized, documentId:stableHash(normalized) };
}

const participantList = value => Array.isArray(value) ? value.filter(item => item?.uid) : [];
const publicLiveRoom = (snapshotOrData, id = '') => {
    const data = typeof snapshotOrData?.data === 'function' ? snapshotOrData.data() : (snapshotOrData || {});
    return {
        id:typeof snapshotOrData?.id === 'string' ? snapshotOrData.id : id,
        status:String(data.status || 'waiting'),
        languageA:String(data.languageA || ''),
        languageB:String(data.languageB || ''),
        inviteCode:String(data.inviteCode || ''),
        memberUids:Array.isArray(data.memberUids) ? data.memberUids : [],
        participants:participantList(data.participants).map(item => ({
            uid:String(item.uid || ''), username:String(item.username || ''), language:String(item.language || '')
        })),
        createdAtMs:Number(data.createdAtMs || timestampMillis(data.createdAt)),
        updatedAtMs:Number(data.updatedAtMs || timestampMillis(data.updatedAt))
    };
};

function randomInviteCode(length = 8) {
    const bytes = crypto.randomBytes(length);
    return Array.from(bytes, byte => privateInviteAlphabet[byte % privateInviteAlphabet.length]).join('');
}

async function uniqueInviteCode() {
    for (let attempt = 0; attempt < 8; attempt += 1) {
        const code = randomInviteCode();
        const match = await liveConversationsCollection().where('inviteCode', '==', code).limit(1).get();
        if (match.empty) return code;
    }
    throw Object.assign(new Error('A private invite code could not be created. Please try again.'), { status:503 });
}

async function recordUsage(uid, operation, metadata = {}) {
    const day = new Date().toISOString().slice(0, 10); const ref = db.doc(`admin_metrics/api_usage/days/${day}`);
    const latencyMs = Math.max(0, Number(metadata.latencyMs || 0));
    const inputTokens = Math.max(0, Number(metadata.inputTokens || 0));
    const visibleOutputTokens = Math.max(0, Number(metadata.visibleOutputTokens || 0));
    const reasoningTokens = Math.max(0, Number(metadata.reasoningTokens || 0));
    const totalTokens = Math.max(0, Number(metadata.totalTokens || inputTokens + visibleOutputTokens + reasoningTokens));
    const modelKey = String(metadata.model || 'none').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80);
    const pricingPrefix = metadata.model === FALLBACK_MODEL ? 'GEMINI_FALLBACK' : 'GEMINI_PRIMARY';
    const inputRate = Math.max(0, Number(process.env[`${pricingPrefix}_INPUT_USD_PER_MILLION`] || 0));
    const outputRate = Math.max(0, Number(process.env[`${pricingPrefix}_OUTPUT_USD_PER_MILLION`] || 0));
    const estimatedCostUsd = Math.max(0, Number(metadata.estimatedCostUsd
        ?? ((inputTokens * inputRate + (visibleOutputTokens + reasoningTokens) * outputRate) / 1_000_000)));
    const eventMetadata = { ...metadata, latencyMs, inputTokens, visibleOutputTokens, reasoningTokens, totalTokens, estimatedCostUsd };
    await ref.set({
        day, updatedAt:FieldValue.serverTimestamp(), total:FieldValue.increment(1),
        operations:{ [operation]:FieldValue.increment(1) },
        models:{ [modelKey]:FieldValue.increment(1) },
        inputTokens:FieldValue.increment(inputTokens),
        outputTokens:FieldValue.increment(visibleOutputTokens),
        reasoningTokens:FieldValue.increment(reasoningTokens),
        totalTokens:FieldValue.increment(totalTokens),
        totalLatencyMs:FieldValue.increment(latencyMs),
        estimatedCostUsd:FieldValue.increment(estimatedCostUsd),
        fallbackCalls:FieldValue.increment(operation.includes('fallback') ? 1 : 0),
        cacheHits:FieldValue.increment(operation === 'translation_cache_hit' ? 1 : 0)
    }, { merge:true });
    await db.collection('admin_metrics').doc('events').collection('items').add({
        uid, operation, metadata:eventMetadata, timestamp:FieldValue.serverTimestamp()
    });
}

const allowanceLimits = {
    free:{newTranslations:100, detailedTranslations:30, aiPracticeSessions:10},
    plus:{newTranslations:2_000, detailedTranslations:500, aiPracticeSessions:200}
};

async function billingState(uid) {
    const [entitlementSnapshot, usageSnapshot] = await Promise.all([
        billingEntitlementsCollection().doc(uid).get(),
        billingUsageCollection().doc(uid).collection('months').doc(currentBillingMonth()).get()
    ]);
    const entitlement = entitlementSnapshot.exists ? entitlementSnapshot.data() : {};
    const expiresAt = timestampMillis(entitlement.expiresAt || entitlement.expirationAtMs);
    const active = entitlement.active === true && (!expiresAt || expiresAt > Date.now());
    return {
        entitlement:{...entitlement, active, expiresAt},
        usage:usageSnapshot.exists ? usageSnapshot.data() : {},
        limits:active ? allowanceLimits.plus : allowanceLimits.free
    };
}

async function recordBillingUsage(uid, category, amount = 1) {
    if (!allowanceLimits.free[category]) return;
    await billingUsageCollection().doc(uid).collection('months').doc(currentBillingMonth()).set({
        month:currentBillingMonth(),
        [category]:FieldValue.increment(Math.max(1, Number(amount) || 1)),
        updatedAt:FieldValue.serverTimestamp()
    }, {merge:true});
}

const enforceAllowance = category => async (req, res, next) => {
    if (process.env.BILLING_ENFORCEMENT_ENABLED !== 'true') return next();
    try {
        const status = await billingState(req.user.uid);
        const bonus = Number(status.entitlement?.bonusCredits || 0);
        const used = Number(status.usage?.[category] || 0);
        if (used >= Number(status.limits[category] || 0) + bonus) {
            return res.status(402).json({error:{
                code:'MONTHLY_AI_ALLOWANCE_REACHED',
                message:'Your monthly AI allowance is used. Cached dictionary translations remain available, or upgrade to Qelumi Plus for a higher allowance.'
            }});
        }
        next();
    } catch (error) { next(error); }
};

function measuredGeminiUsage(data, startedAt, model, thinkingLevel) {
    const usage = data?.usageMetadata || {};
    return {
        model,
        thinkingLevel,
        latencyMs:Math.max(0, Math.round(performance.now() - startedAt)),
        inputTokens:Number(usage.promptTokenCount || 0),
        visibleOutputTokens:Number(usage.candidatesTokenCount || 0),
        reasoningTokens:Number(usage.thoughtsTokenCount || 0),
        totalTokens:Number(usage.totalTokenCount || 0)
    };
}

const translationService = createTranslationService({ db, FieldValue, recordUsage });
const genericCompatibilityModes = new Map();

async function callGemini(body, { model = PRIMARY_MODEL, thinkingLevel = PRIMARY_THINKING, timeoutMs = 25_000 } = {}) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('Server misconfiguration: GEMINI_API_KEY is missing.');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
        const send = requestBody => fetch(endpoint, {
            method:'POST', signal:controller.signal,
            headers:{ 'Content-Type':'application/json', 'x-goog-api-key':apiKey }, body:JSON.stringify(requestBody)
        });
        const compatibilityKey = geminiCompatibilityKey(model, body);
        const preferredMode = genericCompatibilityModes.get(compatibilityKey);
        const variants = buildGeminiCompatibilityRequests(body, thinkingLevel);
        if (preferredMode) variants.sort((left, right) => Number(right.mode === preferredMode) - Number(left.mode === preferredMode));
        let response; let data; let selectedMode = variants[0]?.mode || 'structured';
        const rejectedModes = [];
        for (const variant of variants) {
            selectedMode = variant.mode;
            response = await send(variant.body);
            data = await response.json().catch(() => ({}));
            if (response.ok) {
                genericCompatibilityModes.set(compatibilityKey, selectedMode);
                break;
            }
            if (!isGeminiInvalidArgument(response, data)) break;
            rejectedModes.push(selectedMode);
        }
        if (!response.ok && isGeminiInvalidArgument(response, data)) {
            console.warn('Generic Gemini route rejected every compatible request form.', {
                model, rejectedModes, providerStatus:data?.error?.status || 'INVALID_ARGUMENT',
                providerMessage:String(data?.error?.message || '').slice(0, 300)
            });
            const error = new Error('The translation model rejected its request configuration. Verify that Render uses the Tier 1 Gemini API key and the model variables shown in DEPLOYMENT.md.');
            error.status = 502; error.code = 'MODEL_REQUEST_INVALID'; throw error;
        }
        if (!response.ok) { const error = new Error(data?.error?.message || 'Gemini request failed.'); error.status = response.status; throw error; }
        return data;
    } catch (error) {
        if (error.name === 'AbortError') {
            const timeoutError = new Error(`${model} timed out.`); timeoutError.status = 504; throw timeoutError;
        }
        throw error;
    } finally { clearTimeout(timeout); }
}

async function runLearningFeatureUncached(feature, input, uid) {
    const body = buildLearningRequest(feature, input);
    const languageMetrics = {
        fromLang:String(input?.sourceLang || input?.practiceLang || input?.language || '').toUpperCase(),
        toLang:String(input?.targetLang || input?.supportLang || input?.language || '').toUpperCase(),
        feature
    };
    let data; let result; let model = PRIMARY_MODEL; let thinkingLevel = PRIMARY_THINKING;
    let operation = `learning_${feature}_primary`;
    let started = performance.now(); let fallbackUsed = false;
    try {
        data = await callGemini(body, {
            model, thinkingLevel,
            timeoutMs:feature === 'focused_practice' ? 50_000 : 25_000
        });
        result = parseGeminiJSON(data);
        const qualityIssues = feature === 'focused_practice' ? focusedPracticeQualityIssues(result) : [];
        if (qualityIssues.length) {
            const error = new Error(`Focused practice was incomplete: ${qualityIssues.join('; ')}.`);
            error.code = 'FOCUSED_PRACTICE_INCOMPLETE';
            throw error;
        }
    } catch (primaryError) {
        recordUsage(uid, `${operation}_error`, {
            ...languageMetrics, model, thinkingLevel,
            latencyMs:Math.max(0, Math.round(performance.now() - started)),
            errorCode:primaryError.code || 'REQUEST_FAILED'
        }).catch(() => {});
        fallbackUsed = true;
        model = FALLBACK_MODEL; thinkingLevel = FALLBACK_THINKING;
        operation = `learning_${feature}_fallback`;
        started = performance.now();
        data = await callGemini(body, {
            model, thinkingLevel,
            timeoutMs:feature === 'focused_practice' ? 75_000 : 35_000
        });
        result = parseGeminiJSON(data);
        const qualityIssues = feature === 'focused_practice' ? focusedPracticeQualityIssues(result) : [];
        if (qualityIssues.length) {
            const error = new Error(`Focused practice was incomplete: ${qualityIssues.join('; ')}.`);
            error.status = 502;
            error.code = 'FOCUSED_PRACTICE_INCOMPLETE';
            throw error;
        }
    }
    const usage = { ...measuredGeminiUsage(data, started, model, thinkingLevel), ...languageMetrics };
    recordUsage(uid, operation, usage).catch(() => {});
    return {
        result,
        meta:{
            feature, model, thinkingLevel, fallbackUsed,
            latencyMs:usage.latencyMs
        }
    };
}

async function runLearningFeature(feature, input, uid) {
    if (feature !== 'focused_practice') return runLearningFeatureUncached(feature, input, uid);
    const cacheKey = stableHash(JSON.stringify({
        sourceLang:input?.sourceLang,
        targetLang:input?.targetLang,
        query:input?.query,
        translations:input?.translations,
        meanings:input?.meanings,
        wordFamily:input?.wordFamily
    }));
    const now = Date.now();
    const cached = focusedPracticeCache.get(cacheKey);
    if (cached?.expiresAt > now) return JSON.parse(JSON.stringify(cached.value));
    if (cached) focusedPracticeCache.delete(cacheKey);
    if (focusedPracticeFlights.has(cacheKey)) return focusedPracticeFlights.get(cacheKey);
    const flight = runLearningFeatureUncached(feature, input, uid).then(value => {
        focusedPracticeCache.set(cacheKey, { value, expiresAt:Date.now() + 24 * 60 * 60_000 });
        while (focusedPracticeCache.size > 400) focusedPracticeCache.delete(focusedPracticeCache.keys().next().value);
        return JSON.parse(JSON.stringify(value));
    }).finally(() => focusedPracticeFlights.delete(cacheKey));
    focusedPracticeFlights.set(cacheKey, flight);
    return flight;
}

function liveTranslationRequest(text, sourceLang, targetLang) {
    const targetName = LANGUAGES[targetLang];
    const sourceInstruction = sourceLang === 'AUTO'
        ? `Detect the source language and return its supported ISO code from: ${Object.keys(LANGUAGES).join(', ')}.`
        : `The source language is ${LANGUAGES[sourceLang]} (${sourceLang}). Return ${sourceLang} as sourceLang.`;
    return {
        systemInstruction:{ parts:[{ text:`You are Qelumi's faithful text and conversation translator. ${sourceInstruction} Translate the complete supplied text naturally into ${targetName} (${targetLang}). Preserve every paragraph's meaning, tone, politeness, names, numbers, register and line structure. Do not explain, censor, expand or answer the text. Return strict JSON only.` }] },
        contents:[{ role:'user', parts:[{ text:`Text to translate:\n${text}` }] }],
        generationConfig:{
            responseMimeType:'application/json',
            maxOutputTokens:8192,
            responseSchema:{
                type:'OBJECT',
                properties:{
                    sourceLang:{ type:'STRING', enum:Object.keys(LANGUAGES) },
                    translatedText:{ type:'STRING' }
                },
                required:['sourceLang','translatedText']
            }
        }
    };
}

async function translateLiveText({ text, sourceLang, targetLang }, uid) {
    const cleanMessage = String(text || '').normalize('NFKC').trim()
        .replace(/\r\n?/gu, '\n')
        .replace(/[^\S\n]+/gu, ' ')
        .replace(/\n{3,}/gu, '\n\n')
        .slice(0, 8000);
    const source = String(sourceLang || 'AUTO').trim().toUpperCase();
    const target = String(targetLang || '').trim().toUpperCase();
    if (!cleanMessage) throw Object.assign(new Error('A spoken or typed message is required.'), { status:400 });
    if (source !== 'AUTO' && !LANGUAGES[source]) throw Object.assign(new Error('Unsupported source language.'), { status:400 });
    if (!LANGUAGES[target]) throw Object.assign(new Error('Unsupported destination language.'), { status:400 });
    if (source !== 'AUTO' && source === target) throw Object.assign(new Error('Choose two different languages.'), { status:400 });
    const body = liveTranslationRequest(cleanMessage, source, target);
    let data; let result; let model = PRIMARY_MODEL; let thinkingLevel = PRIMARY_THINKING;
    let operation = 'live_translation_primary'; let started = performance.now(); let fallbackUsed = false;
    try {
        data = await callGemini(body, { model, thinkingLevel, timeoutMs:30_000 });
        result = parseGeminiJSON(data);
        if (!LANGUAGES[result?.sourceLang] || !String(result?.translatedText || '').trim()) throw new Error('The live translation was incomplete.');
    } catch (primaryError) {
        recordUsage(uid, `${operation}_error`, {
            fromLang:source, toLang:target, model, thinkingLevel,
            latencyMs:Math.max(0, Math.round(performance.now() - started)),
            errorCode:primaryError.code || 'REQUEST_FAILED'
        }).catch(() => {});
        fallbackUsed = true; model = FALLBACK_MODEL; thinkingLevel = FALLBACK_THINKING;
        operation = 'live_translation_fallback'; started = performance.now();
        data = await callGemini(body, { model, thinkingLevel, timeoutMs:45_000 });
        result = parseGeminiJSON(data);
    }
    const detectedSource = source === 'AUTO' ? String(result?.sourceLang || '').toUpperCase() : source;
    const translatedText = String(result?.translatedText || '').trim();
    if (!LANGUAGES[detectedSource] || !translatedText) {
        throw Object.assign(new Error('The live translation was incomplete. Please try again.'), { status:502 });
    }
    const usage = {
        ...measuredGeminiUsage(data, started, model, thinkingLevel),
        fromLang:detectedSource, toLang:target, feature:'live_translation'
    };
    recordUsage(uid, operation, usage).catch(() => {});
    return {
        sourceLang:detectedSource, targetLang:target, sourceText:cleanMessage, translatedText,
        meta:{model, thinkingLevel, fallbackUsed, latencyMs:usage.latencyMs}
    };
}

function parseLiveAudioData(value) {
    const match = String(value || '').match(/^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/);
    if (!match) throw Object.assign(new Error('The recorded audio format is invalid.'), { status:400 });
    const aliases = {
        'audio/x-m4a':'audio/mp4', 'audio/mp4a-latm':'audio/mp4',
        'audio/x-wav':'audio/wav', 'audio/wave':'audio/wav'
    };
    const requestedMimeType = String(match[1] || '').toLowerCase().trim();
    const mimeType = aliases[requestedMimeType] || requestedMimeType;
    const accepted = mimeType.startsWith('audio/') || mimeType === 'video/webm';
    if (!accepted) throw Object.assign(new Error('The uploaded media format is not supported.'), { status:415 });
    const data = match[2].replace(/\s+/g, '');
    const byteLength = Buffer.from(data, 'base64').length;
    if (byteLength < 32) throw Object.assign(new Error('No usable audio was captured.'), { status:400 });
    if (byteLength > 6 * 1024 * 1024) {
        throw Object.assign(new Error('That recording is too large. Record no more than 3 minutes at a time.'), { status:413 });
    }
    return {mimeType, data};
}

function liveTranscriptionRequest(audio) {
    return {
        systemInstruction:{ parts:[{ text:`You are Qelumi's speech transcription engine. Detect the spoken language from these supported codes: ${Object.keys(LANGUAGES).join(', ')}. Transcribe only clearly audible speech faithfully in its original language and writing system. Preserve names, numbers, fillers and sentence boundaries. Never translate, answer, explain or invent inaudible words. Return strict JSON only.` }] },
        contents:[{ role:'user', parts:[
            { inlineData:{ mimeType:audio.mimeType, data:audio.data } },
            { text:'Detect the spoken language and transcribe this recording.' }
        ] }],
        generationConfig:{
            responseMimeType:'application/json',
            maxOutputTokens:4096,
            responseSchema:{
                type:'OBJECT',
                properties:{
                    sourceLang:{ type:'STRING', enum:Object.keys(LANGUAGES) },
                    transcript:{ type:'STRING' }
                },
                required:['sourceLang','transcript']
            }
        }
    };
}

async function transcribeLiveAudio(audioData, uid) {
    const audio = parseLiveAudioData(audioData);
    const body = liveTranscriptionRequest(audio);
    let data; let result; let model = PRIMARY_MODEL; let thinkingLevel = PRIMARY_THINKING;
    let operation = 'live_transcription_primary'; let started = performance.now(); let fallbackUsed = false;
    try {
        data = await callGemini(body, { model, thinkingLevel, timeoutMs:60_000 });
        result = parseGeminiJSON(data);
        if (!LANGUAGES[result?.sourceLang] || !String(result?.transcript || '').trim()) {
            throw new Error('No clear speech was recognised in that recording.');
        }
    } catch (primaryError) {
        recordUsage(uid, `${operation}_error`, {
            model, thinkingLevel,
            latencyMs:Math.max(0, Math.round(performance.now() - started)),
            errorCode:primaryError.code || 'REQUEST_FAILED'
        }).catch(() => {});
        fallbackUsed = true; model = FALLBACK_MODEL; thinkingLevel = FALLBACK_THINKING;
        operation = 'live_transcription_fallback'; started = performance.now();
        data = await callGemini(body, { model, thinkingLevel, timeoutMs:90_000 });
        result = parseGeminiJSON(data);
    }
    const sourceLang = String(result?.sourceLang || '').toUpperCase();
    const transcript = String(result?.transcript || '').trim();
    if (!LANGUAGES[sourceLang] || !transcript) {
        throw Object.assign(new Error('No clear speech was recognised. Please try again closer to the microphone.'), { status:422 });
    }
    const usage = {
        ...measuredGeminiUsage(data, started, model, thinkingLevel),
        fromLang:sourceLang, toLang:'', feature:'live_transcription'
    };
    recordUsage(uid, operation, usage).catch(() => {});
    return {sourceLang, transcript, meta:{model, thinkingLevel, fallbackUsed, latencyMs:usage.latencyMs}};
}

function translationContext(body) {
    const query = String(body?.query || '').normalize('NFKC').trim().replace(/\s+/gu, ' ').slice(0, 300);
    const fromLang = String(body?.fromLang || '').trim().toUpperCase();
    const toLang = String(body?.toLang || '').trim().toUpperCase();
    if (!query) throw Object.assign(new Error('A word or expression is required.'), { status:400 });
    if (!LANGUAGES[fromLang] || !LANGUAGES[toLang]) throw Object.assign(new Error('Unsupported source or destination language.'), { status:400 });
    return { query, fromLang, toLang, definitionsOnly:body?.definitionsOnly === true || fromLang === toLang };
}

async function sendFeedbackNotification(feedbackId, feedback) {
    if (!resend || !FEEDBACK_EMAIL_FROM || !FEEDBACK_EMAIL_TO) {
        const error = new Error('Feedback email delivery is not configured.');
        error.code = 'email/not-configured';
        throw error;
    }
    const submitted = new Date(feedback.date).toISOString();
    const replyTo = validEmail(feedback.replyEmail) ? feedback.replyEmail : (validEmail(feedback.accountEmail) ? feedback.accountEmail : undefined);
    const plainText = [
        `Category: ${categoryLabel(feedback.category)}`,
        `Date: ${submitted}`,
        `User UID: ${feedback.uid}`,
        `Account email: ${feedback.accountEmail || 'Not available'}`,
        `Reply address: ${replyTo || 'Not supplied'}`,
        feedback.attachmentName ? `Attachment: ${feedback.attachmentName} (available in the Administrator Dashboard)` : '',
        '', 'Feedback:', feedback.text
    ].filter(line => line !== '').join('\n');
    const html = `<h2>New Qelumi feedback</h2>
        <table cellpadding="6" cellspacing="0" style="border-collapse:collapse">
            <tr><td><b>Category</b></td><td>${htmlEscape(categoryLabel(feedback.category))}</td></tr>
            <tr><td><b>Date</b></td><td>${htmlEscape(submitted)}</td></tr>
            <tr><td><b>User UID</b></td><td><code>${htmlEscape(feedback.uid)}</code></td></tr>
            <tr><td><b>Account email</b></td><td>${htmlEscape(feedback.accountEmail || 'Not available')}</td></tr>
            <tr><td><b>Reply address</b></td><td>${htmlEscape(replyTo || 'Not supplied')}</td></tr>
            ${feedback.attachmentName ? `<tr><td><b>Attachment</b></td><td>${htmlEscape(feedback.attachmentName)} (available in the Administrator Dashboard)</td></tr>` : ''}
        </table>
        <h3>Feedback</h3><div style="white-space:pre-wrap">${htmlEscape(feedback.text)}</div>`;
    const { data, error } = await resend.emails.send({
        from:FEEDBACK_EMAIL_FROM,
        to:[FEEDBACK_EMAIL_TO],
        subject:`[Qelumi Feedback] ${categoryLabel(feedback.category)}`,
        text:plainText,
        html,
        ...(replyTo ? { replyTo } : {}),
        tags:[
            { name:'category', value:feedback.category },
            { name:'feedback_id', value:feedbackId.replace(/[^A-Za-z0-9_-]/g, '_') }
        ]
    }, { idempotencyKey:`qelumi-feedback/${feedbackId}` });
    if (error) throw new Error(error.message || 'Email provider rejected the notification.');
    return data;
}

async function resolveUserEmails(uids) {
    const identifiers = [...new Set(uids.filter(Boolean))];
    const emails = new Map();
    for (let index = 0; index < identifiers.length; index += 100) {
        const batch = identifiers.slice(index, index + 100);
        try {
            const result = await auth.getUsers(batch.map(uid => ({ uid })));
            result.users.forEach(userRecord => emails.set(userRecord.uid, userRecord.email || ''));
        } catch (error) {
            console.warn('Unable to resolve some user emails.', error.message);
        }
    }
    return emails;
}

app.get('/health', (_req, res) => res.json({
    ok:true, service:'linguist-backend', version:BACKEND_VERSION, schemaVersion:DICTIONARY_SCHEMA_VERSION,
    requestCompatibility:'adaptive-json-v2',
    progressiveTranslation:{
        enabled:true,
        mode:'complete-list-then-on-demand-details',
        previewRendering:false,
        compactDetailAugmentation:true,
        parallelMeaningExamples:true,
        translationListSchemaVersion:TRANSLATION_LIST_SCHEMA_VERSION,
        legacyPreviewSchemaVersion:PREVIEW_SCHEMA_VERSION
    },
    learningFeatures:{
        contextLens:true, mistakes:true, shadowing:true, conversations:true,
        stories:true, cefr:true, writingCoach:true,
        mobileBridge:true, performanceDashboard:true,
        liveTranscript:true, automaticSpeechDetection:true,
        localConversation:true, connectedConversation:true,
        languageLab:true, savedWorkspaces:true,
        automaticConversationTranslation:true, automaticConversationPlayback:true,
        readAloudVoiceControls:true, readAloudVoiceInstallHelp:true,
        normalizedAndroidVoiceLocales:true,
        focusedPracticeBanks:true, focusedPracticeFiveRounds:true,
        completeTranslationFirst:true,
        onDemandTranslationDetails:true,
        seamlessDetailReveal:true,
        meaningAlignedContextExamples:true,
        liveInterimTranscription:true,
        deduplicatedLiveTranscription:true,
        editableTranscriptTranslation:true,
        textTranslation:true,
        textTranslationAutoDetect:true,
        longTextTranslation:true,
        persistentSaveFeedback:true,
        stickyTranslationSearch:true,
        viewportStickySearchBanner:true,
        searchFocusLanguageControls:true,
        overlapAwareLiveTranscription:true,
        bilingualAntonyms:true,
        publicStorePages:true,
        authenticatedAccountDeletion:true,
        simplifiedNavigation:true,
        unifiedLibrary:true,
        personalisedOnboarding:true,
        qelumiPath:true,
        purposeCollections:true,
        dictionaryQualityWorkflow:true,
        publicVerifiedDictionary:true,
        privacySafeProductAnalytics:true,
        revenueCatEntitlements:true,
        referrals:true
    },
    reliabilityTargets:{cachedP95Ms:500, translationListP95Ms:5000, detailsP95Ms:15000, requestFailureRateMax:0.01, benchmarkCases:600},
    monetization:{enforcementEnabled:process.env.BILLING_ENFORCEMENT_ENABLED === 'true', provider:'RevenueCat'},
    models:{ primary:PRIMARY_MODEL, primaryThinking:PRIMARY_THINKING, fallback:FALLBACK_MODEL, fallbackThinking:FALLBACK_THINKING },
    renderCache:{
        enabled:true,
        ttlMs:translationService.cache.l1TtlMs,
        negativeTtlMs:translationService.cache.l1NegativeTtlMs,
        maxEntries:translationService.cache.l1MaxEntries,
        ...translationService.l1Stats()
    },
    feedbackEmailConfigured:!!(resend && FEEDBACK_EMAIL_FROM && FEEDBACK_EMAIL_TO),
    costRatesConfigured:!!(
        Number(process.env.GEMINI_PRIMARY_INPUT_USD_PER_MILLION || 0)
        && Number(process.env.GEMINI_PRIMARY_OUTPUT_USD_PER_MILLION || 0)
    )
}));

function publicDictionaryPayload(snapshot) {
    if (!snapshot?.exists) return null;
    const entry = snapshot.data();
    if (entry.deletedAt || entry.qualityStatus !== 'verified' || entry.verificationStatus !== 'qelumi_verified') return null;
    try {
        const result = typeof entry.fullJSON === 'string' ? JSON.parse(entry.fullJSON) : entry.translation;
        return {
            id:snapshot.id,
            query:entry.originalQuery,
            fromLang:entry.fromLang,
            toLang:entry.toLang,
            result,
            qualityStatus:'verified',
            verificationStatus:'qelumi_verified',
            verifiedAt:timestampMillis(entry.verifiedAt),
            updatedAt:timestampMillis(entry.updatedAt)
        };
    } catch (_) { return null; }
}

app.get('/api/public/dictionary/:id', rateLimit({windowMs:60_000, max:120}), async (req, res) => {
    if (!/^[a-f0-9]{64}$/i.test(req.params.id)) return res.status(400).json({error:{message:'Invalid dictionary entry identifier.'}});
    const payload = publicDictionaryPayload(await dictionaryReference(req.params.id).get());
    if (!payload) return res.status(404).json({error:{message:'That verified dictionary entry is not public.'}});
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600').json(payload);
});

app.get('/api/public/dictionary', rateLimit({windowMs:60_000, max:120}), async (req, res) => {
    try {
        const context = translationContext(req.query);
        const id = dictionaryDocumentId(context.query, context.fromLang, context.toLang);
        const payload = publicDictionaryPayload(await dictionaryReference(id).get());
        if (!payload) return res.status(404).json({error:{message:'That verified dictionary entry is not public.'}});
        res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600').json(payload);
    } catch (error) { res.status(error.status || 400).json({error:{message:error.message}}); }
});

app.post('/api/auth/email-exists', rateLimit({ windowMs:15 * 60_000, max:20, key:req => `email:${req.ip}` }), async (req, res) => {
    try {
        await auth.getUserByEmail(String(req.body?.email || '').trim().toLowerCase());
        res.json({ exists:true });
    } catch (error) {
        if (error.code === 'auth/user-not-found') return res.json({ exists:false });
        res.status(500).json({ error:{ message:'Unable to check that account.' } });
    }
});

app.post('/api/product-events', requireUser,
    rateLimit({windowMs:60 * 60_000, max:500, key:req => `product-events:${req.user.uid}`}), async (req, res) => {
        const event = String(req.body?.event || '').trim();
        if (!productEventNames.has(event)) return res.status(400).json({error:{message:'Unsupported product event.'}});
        await productEventsCollection().add({
            event,
            userHash:stableHash(req.user.uid),
            accountKind:req.user.firebase?.sign_in_provider === 'anonymous' ? 'guest' : 'registered',
            metadata:cleanProductMetadata(req.body?.metadata),
            timestamp:Date.now(),
            createdAt:FieldValue.serverTimestamp()
        });
        res.status(201).json({ok:true});
    });

app.get('/api/billing/status', requireUser, async (req, res) => {
    const status = await billingState(req.user.uid);
    res.json({
        enforcementEnabled:process.env.BILLING_ENFORCEMENT_ENABLED === 'true',
        entitlement:status.entitlement,
        usage:status.usage,
        limits:status.limits,
        month:currentBillingMonth()
    });
});

app.post('/api/webhooks/revenuecat', async (req, res) => {
    const expected = String(process.env.REVENUECAT_WEBHOOK_SECRET || '');
    const supplied = String(req.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!expected || supplied.length !== expected.length
        || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
        return res.status(401).json({error:{message:'Invalid RevenueCat webhook authorization.'}});
    }
    const event = req.body?.event || {};
    const uid = String(event.app_user_id || '').trim();
    if (!uid || uid.startsWith('$RCAnonymousID:')) return res.json({ok:true, ignored:true});
    const expirationAtMs = Number(event.expiration_at_ms || 0);
    const expired = ['EXPIRATION'].includes(String(event.type || '').toUpperCase()) || (expirationAtMs && expirationAtMs <= Date.now());
    const willRenew = !['CANCELLATION', 'EXPIRATION', 'BILLING_ISSUE'].includes(String(event.type || '').toUpperCase());
    await billingEntitlementsCollection().doc(uid).set({
        active:!expired,
        productId:String(event.product_id || ''),
        store:String(event.store || ''),
        eventType:String(event.type || ''),
        expiresAt:expirationAtMs,
        willRenew,
        entitlementIds:Array.isArray(event.entitlement_ids) ? event.entitlement_ids.slice(0, 20) : [],
        updatedAt:FieldValue.serverTimestamp()
    }, {merge:true});
    res.json({ok:true});
});

app.get('/api/referrals/me', requireUser, requireRegisteredUser, async (req, res) => {
    const code = publicReferralCode(req.user.uid);
    await referralCodesCollection().doc(code).set({uid:req.user.uid, code, createdAt:FieldValue.serverTimestamp()}, {merge:true});
    const rewards = await referralClaimsCollection().where('inviterUid', '==', req.user.uid).get();
    res.json({code, rewards:rewards.size});
});

app.post('/api/referrals/claim', requireUser, requireRegisteredUser,
    rateLimit({windowMs:24 * 60 * 60_000, max:5, key:req => `referral-claim:${req.user.uid}`}), async (req, res) => {
        const code = String(req.body?.code || '').trim().toUpperCase().slice(0, 20);
        const codeSnapshot = await referralCodesCollection().doc(code).get();
        if (!codeSnapshot.exists) return res.status(404).json({error:{message:'That referral code is invalid.'}});
        const inviterUid = String(codeSnapshot.data()?.uid || '');
        if (!inviterUid || inviterUid === req.user.uid) return res.status(400).json({error:{message:'You cannot use your own referral code.'}});
        const claimReference = referralClaimsCollection().doc(req.user.uid);
        let created = false;
        await db.runTransaction(async transaction => {
            if ((await transaction.get(claimReference)).exists) return;
            transaction.create(claimReference, {inviteeUid:req.user.uid, inviterUid, code, createdAt:FieldValue.serverTimestamp()});
            transaction.set(billingEntitlementsCollection().doc(req.user.uid), {bonusCredits:FieldValue.increment(10)}, {merge:true});
            transaction.set(billingEntitlementsCollection().doc(inviterUid), {bonusCredits:FieldValue.increment(10)}, {merge:true});
            created = true;
        });
        res.json({ok:true, created, bonusCredits:created ? 10 : 0});
    });

app.delete('/api/account', requireUser,
    rateLimit({ windowMs:60 * 60_000, max:5, key:req => `account-delete:${req.user.uid}` }),
    async (req, res) => {
        try {
            if (req.body?.confirmation !== 'DELETE') {
                return res.status(400).json({ error:{ code:'DELETION_NOT_CONFIRMED', message:'Type DELETE to confirm permanent account deletion.' } });
            }
            const authenticationAgeSeconds = Math.floor(Date.now() / 1000) - Number(req.user.auth_time || 0);
            if (!Number.isFinite(authenticationAgeSeconds) || authenticationAgeSeconds < 0 || authenticationAgeSeconds > 10 * 60) {
                return res.status(401).json({ error:{ code:'RECENT_LOGIN_REQUIRED', message:'For security, sign out and sign in again before deleting your account.' } });
            }
            await deleteQelumiAccountData(req.user);
            res.json({ ok:true, deleted:true });
        } catch (error) {
            if (error.code === 'auth/user-not-found') return res.json({ ok:true, deleted:true });
            res.status(error.status || 500).json({ error:{ code:error.code || 'ACCOUNT_DELETION_FAILED', message:error.message || 'The account could not be deleted.' } });
        }
    });

app.get('/api/profile', requireUser, async (req, res) => {
    const profile = await qelumiProfilesCollection().doc(req.user.uid).get();
    res.json({ profile:{ username:profile.exists ? String(profile.data()?.username || '') : '' } });
});

app.post('/api/profile', requireUser, requireRegisteredUser,
    rateLimit({ windowMs:60 * 60_000, max:12, key:req => `profile:${req.user.uid}` }), async (req, res) => {
        try {
            const next = cleanUsername(req.body?.username);
            const profileReference = qelumiProfilesCollection().doc(req.user.uid);
            const usernameReference = qelumiUsernamesCollection().doc(next.documentId);
            await db.runTransaction(async transaction => {
                const [profileSnapshot, usernameSnapshot] = await Promise.all([
                    transaction.get(profileReference), transaction.get(usernameReference)
                ]);
                if (usernameSnapshot.exists && usernameSnapshot.data()?.uid !== req.user.uid) {
                    throw Object.assign(new Error('That username is already in use.'), { status:409 });
                }
                const previousNormalized = normalizeUsername(profileSnapshot.data()?.username || '');
                if (previousNormalized && previousNormalized !== next.normalized) {
                    transaction.delete(qelumiUsernamesCollection().doc(stableHash(previousNormalized)));
                }
                transaction.set(usernameReference, {
                    uid:req.user.uid, username:next.username, normalized:next.normalized,
                    updatedAt:FieldValue.serverTimestamp()
                });
                transaction.set(profileReference, {
                    uid:req.user.uid, username:next.username, normalized:next.normalized,
                    updatedAt:FieldValue.serverTimestamp()
                }, { merge:true });
            });
            res.json({ ok:true, profile:{username:next.username} });
        } catch (error) {
            res.status(error.status || 500).json({ error:{ message:error.message || 'The username could not be saved.' } });
        }
    });

app.post('/api/live/translate', requireUser,
    rateLimit({ windowMs:60 * 60_000, max:180, key:req => `live-translate:${req.user.uid}` }), async (req, res) => {
        try {
            res.json({ translation:await translateLiveText(req.body || {}, req.user.uid) });
        } catch (error) {
            res.status(error.status || 500).json({ error:{ message:error.message, code:error.code || 'LIVE_TRANSLATION_FAILED' } });
        }
    });

app.post('/api/live/transcribe', requireUser,
    rateLimit({ windowMs:60 * 60_000, max:120, key:req => `live-transcribe:${req.user.uid}` }), async (req, res) => {
        try {
            res.json({ transcription:await transcribeLiveAudio(req.body?.audioData, req.user.uid) });
        } catch (error) {
            res.status(error.status || 500).json({ error:{ message:error.message, code:error.code || 'LIVE_TRANSCRIPTION_FAILED' } });
        }
    });

app.get('/api/live-conversations', requireUser, requireRegisteredUser, async (req, res) => {
    const snapshot = await liveConversationsCollection().where('memberUids', 'array-contains', req.user.uid).limit(40).get();
    const rooms = snapshot.docs.map(document => publicLiveRoom(document))
        .sort((left, right) => right.updatedAtMs - left.updatedAtMs);
    res.json({ rooms });
});

app.post('/api/live-conversations', requireUser, requireRegisteredUser,
    rateLimit({ windowMs:60 * 60_000, max:20, key:req => `live-room-create:${req.user.uid}` }), async (req, res) => {
        try {
            const selfLanguage = String(req.body?.selfLanguage || '').toUpperCase();
            const partnerLanguage = String(req.body?.partnerLanguage || '').toUpperCase();
            const partnerUsername = String(req.body?.partnerUsername || '').normalize('NFKC').trim();
            if (!LANGUAGES[selfLanguage] || !LANGUAGES[partnerLanguage] || selfLanguage === partnerLanguage) {
                return res.status(400).json({ error:{ message:'Choose two different supported languages.' } });
            }
            const selfProfile = await qelumiProfilesCollection().doc(req.user.uid).get();
            const selfUsername = String(selfProfile.data()?.username || '');
            let partnerUid = ''; let partnerDisplayUsername = '';
            if (partnerUsername) {
                const normalizedPartner = normalizeUsername(partnerUsername.replace(/^@/, ''));
                const usernameSnapshot = await qelumiUsernamesCollection().doc(stableHash(normalizedPartner)).get();
                if (!usernameSnapshot.exists) return res.status(404).json({ error:{ message:'No Qelumi user has that exact username.' } });
                partnerUid = String(usernameSnapshot.data()?.uid || '');
                partnerDisplayUsername = String(usernameSnapshot.data()?.username || partnerUsername);
                if (!partnerUid || partnerUid === req.user.uid) return res.status(400).json({ error:{ message:'Invite another Qelumi user, not your own username.' } });
            }
            const roomReference = liveConversationsCollection().doc();
            const inviteCode = partnerUid ? '' : await uniqueInviteCode();
            const now = Date.now();
            const participants = [
                {uid:req.user.uid, username:selfUsername, language:selfLanguage},
                ...(partnerUid ? [{uid:partnerUid, username:partnerDisplayUsername, language:partnerLanguage}] : [])
            ];
            const room = {
                status:partnerUid ? 'active' : 'waiting',
                languageA:selfLanguage, languageB:partnerLanguage,
                memberUids:participants.map(item => item.uid), participants,
                creatorUid:req.user.uid, inviteCode,
                createdAt:FieldValue.serverTimestamp(), updatedAt:FieldValue.serverTimestamp(),
                createdAtMs:now, updatedAtMs:now, expiresAtMs:now + 7 * 24 * 60 * 60_000
            };
            await roomReference.set(room);
            res.status(201).json({ room:publicLiveRoom(room, roomReference.id) });
        } catch (error) {
            res.status(error.status || 500).json({ error:{ message:error.message || 'The conversation could not be created.' } });
        }
    });

app.post('/api/live-conversations/join', requireUser, requireRegisteredUser,
    rateLimit({ windowMs:60 * 60_000, max:30, key:req => `live-room-join:${req.user.uid}` }), async (req, res) => {
        try {
            const inviteCode = String(req.body?.inviteCode || '').trim().toUpperCase().replace(/[^A-Z2-9]/g, '');
            if (inviteCode.length !== 8) return res.status(400).json({ error:{ message:'Enter the complete eight-character invite code.' } });
            const match = await liveConversationsCollection().where('inviteCode', '==', inviteCode).limit(1).get();
            if (match.empty) return res.status(404).json({ error:{ message:'That invite code was not found.' } });
            const roomReference = match.docs[0].ref;
            const profile = await qelumiProfilesCollection().doc(req.user.uid).get();
            await db.runTransaction(async transaction => {
                const snapshot = await transaction.get(roomReference);
                if (!snapshot.exists) throw Object.assign(new Error('That conversation no longer exists.'), { status:404 });
                const room = snapshot.data();
                const members = Array.isArray(room.memberUids) ? room.memberUids : [];
                if (members.includes(req.user.uid)) return;
                if (members.length >= 2 || room.status === 'closed') throw Object.assign(new Error('That conversation already has two participants.'), { status:409 });
                if (Number(room.expiresAtMs || 0) < Date.now()) throw Object.assign(new Error('That invite code has expired.'), { status:410 });
                const participants = participantList(room.participants);
                participants.push({
                    uid:req.user.uid, username:String(profile.data()?.username || ''), language:String(room.languageB || '')
                });
                transaction.update(roomReference, {
                    memberUids:[...members, req.user.uid], participants, status:'active', inviteCode:'',
                    updatedAt:FieldValue.serverTimestamp(), updatedAtMs:Date.now()
                });
            });
            const joined = await roomReference.get();
            res.json({ room:publicLiveRoom(joined) });
        } catch (error) {
            res.status(error.status || 500).json({ error:{ message:error.message || 'The conversation could not be joined.' } });
        }
    });

app.get('/api/live-conversations/:roomId', requireUser, requireRegisteredUser, async (req, res) => {
    const room = await liveConversationsCollection().doc(String(req.params.roomId || '')).get();
    if (!room.exists) return res.status(404).json({ error:{ message:'Conversation not found.' } });
    if (!Array.isArray(room.data()?.memberUids) || !room.data().memberUids.includes(req.user.uid)) {
        return res.status(403).json({ error:{ message:'You do not have access to that conversation.' } });
    }
    res.json({ room:publicLiveRoom(room) });
});

app.post('/api/live-conversations/:roomId/messages', requireUser, requireRegisteredUser,
    rateLimit({ windowMs:60 * 60_000, max:240, key:req => `live-room-message:${req.user.uid}` }), async (req, res) => {
        try {
            const roomReference = liveConversationsCollection().doc(String(req.params.roomId || ''));
            const roomSnapshot = await roomReference.get();
            if (!roomSnapshot.exists) return res.status(404).json({ error:{ message:'Conversation not found.' } });
            const room = roomSnapshot.data();
            if (!Array.isArray(room.memberUids) || !room.memberUids.includes(req.user.uid)) {
                return res.status(403).json({ error:{ message:'You do not have access to that conversation.' } });
            }
            if (room.memberUids.length !== 2 || room.status !== 'active') {
                return res.status(409).json({ error:{ message:'Wait for the second participant before sending a message.' } });
            }
            const participant = participantList(room.participants).find(item => item.uid === req.user.uid);
            const sourceLang = String(participant?.language || '');
            const targetLang = sourceLang === room.languageA ? room.languageB : room.languageA;
            const translation = await translateLiveText({
                text:req.body?.text, sourceLang, targetLang
            }, req.user.uid);
            const messageReference = roomReference.collection('messages').doc();
            const now = Date.now();
            const message = {
                senderUid:req.user.uid, sourceText:translation.sourceText, translatedText:translation.translatedText,
                sourceLang:translation.sourceLang, targetLang:translation.targetLang,
                createdAt:FieldValue.serverTimestamp(), createdAtMs:now
            };
            await Promise.all([
                messageReference.set(message),
                roomReference.update({updatedAt:FieldValue.serverTimestamp(), updatedAtMs:now})
            ]);
            res.status(201).json({ message:{id:messageReference.id, ...message, createdAt:null} });
        } catch (error) {
            res.status(error.status || 500).json({ error:{ message:error.message || 'The message could not be sent.' } });
        }
    });

app.post('/api/live-conversations/:roomId/save', requireUser, requireRegisteredUser,
    rateLimit({ windowMs:60 * 60_000, max:30, key:req => `live-room-save:${req.user.uid}` }), async (req, res) => {
        const roomReference = liveConversationsCollection().doc(String(req.params.roomId || ''));
        const roomSnapshot = await roomReference.get();
        if (!roomSnapshot.exists) return res.status(404).json({ error:{ message:'Conversation not found.' } });
        const room = roomSnapshot.data();
        if (!Array.isArray(room.memberUids) || !room.memberUids.includes(req.user.uid)) {
            return res.status(403).json({ error:{ message:'You do not have access to that conversation.' } });
        }
        const messagesSnapshot = await roomReference.collection('messages').limit(250).get();
        const messages = messagesSnapshot.docs.map(document => ({id:document.id, ...document.data(), createdAt:null}))
            .sort((left, right) => Number(left.createdAtMs || 0) - Number(right.createdAtMs || 0));
        await db.doc(`artifacts/${APP_ID}/users/${req.user.uid}/conversation_sessions/live-${roomReference.id}`).set({
            mode:'connected', roomId:roomReference.id,
            languageA:room.languageA, languageB:room.languageB,
            participants:participantList(room.participants), messages,
            createdAtMs:Number(room.createdAtMs || 0), savedAt:Date.now()
        }, {merge:true});
        res.json({ok:true, messageCount:messages.length});
    });

app.post('/api/gemini', requireUser, rateLimit({ windowMs:60 * 60_000, max:80, key:req => `gemini:${req.user.uid}` }), async (req, res) => {
    try {
        let data;
        let started = performance.now();
        try {
            data = await callGemini(req.body);
            recordUsage(req.user.uid, 'gemini_primary', measuredGeminiUsage(data, started, PRIMARY_MODEL, PRIMARY_THINKING)).catch(() => {});
        } catch (primaryError) {
            recordUsage(req.user.uid, 'gemini_primary_error', {
                model:PRIMARY_MODEL, thinkingLevel:PRIMARY_THINKING,
                latencyMs:Math.max(0, Math.round(performance.now() - started)), errorCode:primaryError.code || 'REQUEST_FAILED'
            }).catch(() => {});
            started = performance.now();
            data = await callGemini(req.body, { model:FALLBACK_MODEL, thinkingLevel:FALLBACK_THINKING });
            recordUsage(req.user.uid, 'gemini_fallback', measuredGeminiUsage(data, started, FALLBACK_MODEL, FALLBACK_THINKING)).catch(() => {});
        }
        res.json(data);
    } catch (error) {
        res.status(error.status || 500).json({ error:{ message:error.message } });
    }
});

app.post('/api/translate', requireUser, rateLimit({ windowMs:60 * 60_000, max:120, key:req => `translate:${req.user.uid}` }), async (req, res) => {
    try {
        const context = translationContext(req.body);
        const forceRefresh = req.body?.forceRefresh === true && (req.user.uid === ADMIN_UID || req.user.admin === true);
        const response = await translationService.getCore(context, req.user.uid, { forceRefresh });
        if (response.meta?.source !== 'global_dictionary' && response.meta?.source !== 'render_l1') recordBillingUsage(req.user.uid, 'newTranslations').catch(() => {});
        res.json(response);
    } catch (error) {
        res.status(error.status || 500).json({ error:{ message:error.message, code:error.code || 'TRANSLATION_FAILED' } });
    }
});

app.post('/api/translate/list', requireUser, rateLimit({ windowMs:60 * 60_000, max:180, key:req => `translation-list:${req.user.uid}` }), async (req, res) => {
    try {
        const context = translationContext(req.body);
        const response = await translationService.getTranslationList(context, req.user.uid);
        if (response.meta?.source !== 'global_dictionary' && response.meta?.source !== 'preview_cache') recordBillingUsage(req.user.uid, 'newTranslations').catch(() => {});
        res.json(response);
    } catch (error) {
        res.status(error.status || 500).json({ error:{ message:error.message, code:error.code || 'TRANSLATION_LIST_FAILED' } });
    }
});

app.post('/api/translate/details', requireUser, rateLimit({ windowMs:60 * 60_000, max:120, key:req => `translation-details:${req.user.uid}` }), async (req, res) => {
    try {
        const context = translationContext(req.body);
        const forceRefresh = req.body?.forceRefresh === true
            && (req.user.uid === ADMIN_UID || req.user.admin === true);
        const response = await translationService.getCompleteDetails(context, req.user.uid, { forceRefresh });
        if (Array.isArray(response.meta?.modelCalls) && response.meta.modelCalls.length) recordBillingUsage(req.user.uid, 'detailedTranslations').catch(() => {});
        res.json(response);
    } catch (error) {
        res.status(error.status || 500).json({ error:{ message:error.message, code:error.code || 'TRANSLATION_DETAILS_FAILED' } });
    }
});

app.post('/api/translate/preview', requireUser, rateLimit({ windowMs:60 * 60_000, max:180, key:req => `translation-preview:${req.user.uid}` }), async (req, res) => {
    try {
        const context = translationContext(req.body);
        res.json(await translationService.getPreview(context, req.user.uid));
    } catch (error) {
        res.status(error.status || 500).json({ error:{ message:error.message, code:error.code || 'PREVIEW_FAILED' } });
    }
});

app.post('/api/translate/contexts', requireUser, rateLimit({ windowMs:60 * 60_000, max:120, key:req => `contexts:${req.user.uid}` }), async (req, res) => {
    try {
        const context = translationContext(req.body);
        res.json(await translationService.getContexts(context, req.user.uid));
    } catch (error) {
        res.status(error.status || 500).json({ error:{ message:error.message, code:error.code || 'CONTEXTS_FAILED' } });
    }
});

app.post('/api/game/distractors', requireUser, rateLimit({ windowMs:60 * 60_000, max:30, key:req => `distractors:${req.user.uid}` }), async (req, res) => {
    try {
        const fromLang = String(req.body?.fromLang || '').trim().toUpperCase();
        const toLang = String(req.body?.toLang || '').trim().toUpperCase();
        const original = String(req.body?.original || '').trim().slice(0, 500);
        const translated = String(req.body?.translated || '').trim().slice(0, 500);
        const correct = String(req.body?.correct || '').trim().slice(0, 200);
        const count = Math.min(4, Math.max(2, Number(req.body?.count || 4)));
        if (!LANGUAGES[fromLang] || !LANGUAGES[toLang] || !original || !correct) {
            return res.status(400).json({ error:{ message:'A valid quiz sentence, answer and language pair are required.' } });
        }
        res.json(await translationService.getDistractors({ fromLang, toLang, original, translated, correct, count }, req.user.uid));
    } catch (error) {
        res.status(error.status || 500).json({ error:{ message:error.message, code:error.code || 'DISTRACTORS_FAILED' } });
    }
});

const learningRoute = feature => async (req, res) => {
    try {
        const response = await runLearningFeature(feature, req.body || {}, req.user.uid);
        recordBillingUsage(req.user.uid, 'aiPracticeSessions').catch(() => {});
        res.json(response);
    } catch (error) {
        res.status(error.status || 500).json({
            error:{ message:error.message, code:error.code || `LEARNING_${feature.toUpperCase()}_FAILED` }
        });
    }
};

app.post('/api/learning/context-lens', requireUser,
    rateLimit({ windowMs:60 * 60_000, max:50, key:req => `context-lens:${req.user.uid}` }),
    enforceAllowance('aiPracticeSessions'),
    learningRoute('context_lens'));
app.post('/api/learning/shadowing', requireUser,
    rateLimit({ windowMs:60 * 60_000, max:30, key:req => `shadowing:${req.user.uid}` }),
    enforceAllowance('aiPracticeSessions'),
    learningRoute('shadowing'));
app.post('/api/learning/conversation', requireUser,
    rateLimit({ windowMs:60 * 60_000, max:100, key:req => `conversation:${req.user.uid}` }),
    enforceAllowance('aiPracticeSessions'),
    learningRoute('conversation'));
app.post('/api/learning/story', requireUser,
    rateLimit({ windowMs:60 * 60_000, max:20, key:req => `story:${req.user.uid}` }),
    enforceAllowance('aiPracticeSessions'),
    learningRoute('story'));
app.post('/api/learning/writing-coach', requireUser,
    rateLimit({ windowMs:60 * 60_000, max:40, key:req => `writing-coach:${req.user.uid}` }),
    enforceAllowance('aiPracticeSessions'),
    learningRoute('writing_coach'));
app.post('/api/learning/focused-practice', requireUser,
    rateLimit({ windowMs:60 * 60_000, max:12, key:req => `focused-practice:${req.user.uid}` }),
    enforceAllowance('aiPracticeSessions'),
    learningRoute('focused_practice'));

app.post('/api/feedback', requireUser, rateLimit({ windowMs:60 * 60_000, max:10, key:req => `feedback:${req.user.uid}` }), async (req, res) => {
    const category = feedbackCategories.has(req.body?.category) ? req.body.category : (feedbackCategories.has(req.body?.type) ? req.body.type : 'other');
    const text = String(req.body?.text || '').trim();
    const replyEmail = String(req.body?.replyEmail || req.body?.email || '').trim().toLowerCase();
    const attachmentName = String(req.body?.attachmentName || '').trim().slice(0, 240);
    const attachmentData = typeof req.body?.attachmentData === 'string' ? req.body.attachmentData : '';
    const translationQuery = String(req.body?.translationQuery || '').normalize('NFKC').trim().replace(/\s+/g, ' ').slice(0, 300);
    const translationFromLang = String(req.body?.translationFromLang || '').toUpperCase().slice(0, 5);
    const translationToLang = String(req.body?.translationToLang || '').toUpperCase().slice(0, 5);
    if (!text || text.length > 10_000) return res.status(400).json({ error:{ message:'Feedback must contain between 1 and 10,000 characters.' } });
    if (replyEmail && !validEmail(replyEmail)) return res.status(400).json({ error:{ message:'The reply email address is invalid.' } });
    if (attachmentData.length > 700_000) return res.status(413).json({ error:{ message:'The feedback attachment is too large.' } });

    const feedbackRef = feedbackCollection().doc();
    const feedback = {
        uid:req.user.uid,
        accountEmail:req.user.email || '',
        replyEmail,
        category,
        type:category,
        text,
        date:Date.now(),
        status:'new',
        notificationStatus:'pending',
        notificationAttempts:0,
        hasAttachment:!!attachmentData,
        ...(category === 'translation' && translationQuery && LANGUAGES[translationFromLang] && LANGUAGES[translationToLang]
            ? {translationQuery, translationFromLang, translationToLang,
                dictionaryEntryId:dictionaryDocumentId(translationQuery, translationFromLang, translationToLang)} : {}),
        createdAt:FieldValue.serverTimestamp(),
        ...(attachmentName ? { attachmentName } : {}),
        ...(attachmentData ? { attachmentData } : {})
    };
    await feedbackRef.set(feedback);
    if (feedback.dictionaryEntryId) {
        const entryReference = dictionaryReference(feedback.dictionaryEntryId);
        await db.runTransaction(async transaction => {
            const snapshot = await transaction.get(entryReference);
            if (!snapshot.exists) return;
            transaction.set(entryReference, {
                qualityStatus:'reported',
                previousQualityStatus:snapshot.data()?.qualityStatus || 'generated',
                reportedAt:FieldValue.serverTimestamp(),
                reportedBy:stableHash(req.user.uid),
                qualityUpdatedAt:Date.now()
            }, {merge:true});
        }).catch(() => {});
        translationService.invalidateDocumentId(feedback.dictionaryEntryId);
    }
    try {
        const delivery = await sendFeedbackNotification(feedbackRef.id, feedback);
        await feedbackRef.update({
            notificationStatus:'sent', notificationEmailId:delivery?.id || '',
            notificationAttempts:FieldValue.increment(1), notificationSentAt:FieldValue.serverTimestamp(),
            notificationError:FieldValue.delete()
        });
        res.status(201).json({ ok:true, id:feedbackRef.id, notificationStatus:'sent' });
    } catch (error) {
        const status = error.code === 'email/not-configured' ? 'not_configured' : 'failed';
        await feedbackRef.update({
            notificationStatus:status, notificationAttempts:FieldValue.increment(1),
            notificationError:String(error.message || 'Notification failed.').slice(0, 500),
            notificationUpdatedAt:FieldValue.serverTimestamp()
        });
        res.status(201).json({ ok:true, id:feedbackRef.id, notificationStatus:status });
    }
});

app.post('/api/translation-events', requireUser, rateLimit({ windowMs:60 * 60_000, max:300, key:req => `translation-events:${req.user.uid}` }), async (req, res) => {
    const query = String(req.body?.query || '').normalize('NFKC').trim().replace(/\s+/g, ' ').slice(0, 300);
    const fromLang = String(req.body?.fromLang || '').toUpperCase().slice(0, 5);
    const toLang = String(req.body?.toLang || '').toUpperCase().slice(0, 5);
    const source = translationSources.has(req.body?.source) ? req.body.source : 'generated';
    const outcome = translationOutcomes.has(req.body?.outcome) ? req.body.outcome : 'success';
    if (!query) return res.status(400).json({ error:{ message:'A searched word or expression is required.' } });
    const cacheStatus = source === 'global_dictionary' || source === 'dictionary_repair' ? 'common_dictionary'
        : source === 'generated' || source === 'image_analysis' ? 'new'
            : source === 'personal_history' ? 'personal_history' : 'not_applicable';
    const eventRef = translationSearchCollection().doc();
    await eventRef.set({
        uid:req.user.uid,
        userEmail:req.user.email || '',
        query,
        queryLower:query.toLocaleLowerCase(),
        fromLang,
        toLang,
        source,
        sourceLabel:sourceLabel(source),
        cacheStatus,
        outcome,
        definitionsOnly:req.body?.definitionsOnly === true,
        timestamp:Date.now(),
        createdAt:FieldValue.serverTimestamp(),
        error:outcome === 'error' ? String(req.body?.error || '').slice(0, 500) : ''
    });
    res.status(201).json({ ok:true, id:eventRef.id });
});

app.post('/api/jobs', requireUser, rateLimit({ windowMs:60 * 60_000, max:20, key:req => `jobs:${req.user.uid}` }), async (req, res) => {
    const jobRef = db.collection('translation_jobs').doc();
    await jobRef.set({
        uid:req.user.uid, status:'queued', createdAt:FieldValue.serverTimestamp(),
        requestHash:crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex')
    });
    res.status(202).json({ jobId:jobRef.id, status:'queued' });
    try {
        await jobRef.update({ status:'running', startedAt:FieldValue.serverTimestamp() });
        let result; let operation = 'background_job_primary'; let model = PRIMARY_MODEL; let thinkingLevel = PRIMARY_THINKING;
        let started = performance.now();
        try { result = await callGemini(req.body); }
        catch (_) {
            operation = 'background_job_fallback'; model = FALLBACK_MODEL; thinkingLevel = FALLBACK_THINKING;
            started = performance.now();
            result = await callGemini(req.body, { model, thinkingLevel });
        }
        await jobRef.update({ status:'completed', result, completedAt:FieldValue.serverTimestamp() });
        recordUsage(req.user.uid, operation, measuredGeminiUsage(result, started, model, thinkingLevel)).catch(() => {});
    } catch (error) {
        await jobRef.update({ status:'failed', error:error.message, completedAt:FieldValue.serverTimestamp() });
    }
});

app.get('/api/jobs/:id', requireUser, async (req, res) => {
    const snapshot = await db.collection('translation_jobs').doc(req.params.id).get();
    if (!snapshot.exists || (snapshot.data().uid !== req.user.uid && req.user.uid !== ADMIN_UID)) return res.status(404).json({ error:{ message:'Job not found.' } });
    res.json({ id:snapshot.id, ...snapshot.data() });
});

app.post('/api/admin/bootstrap', requireUser, requireAdmin, async (req, res) => {
    const userRecord = await auth.getUser(req.user.uid);
    await auth.setCustomUserClaims(req.user.uid, { ...(userRecord.customClaims || {}), admin:true });
    await administratorRolesCollection().doc(administratorRoleDocumentId(req.user.uid)).set({
        uid:req.user.uid,
        email:userRecord.email || req.user.email || '',
        displayName:userRecord.displayName || '',
        enabled:true,
        primary:req.user.uid === ADMIN_UID,
        grantedBy:req.user.uid,
        updatedAt:FieldValue.serverTimestamp()
    }, { merge:true });
    res.json({ ok:true, message:'Administrator claim assigned. Sign out and back in to refresh it.' });
});

app.get('/api/admin/users/lookup', requireUser, requireAdmin, async (req, res) => {
    try {
        const userRecord = await resolveAdministratorTarget(req.query.identifier);
        res.json({ user:publicAdministratorRecord(userRecord) });
    } catch (error) {
        res.status(error.status || 500).json({ error:{ message:error.message } });
    }
});

app.get('/api/admin/roles', requireUser, requireAdmin, async (_req, res) => {
    try {
        const snapshot = await administratorRolesCollection().get();
        const roleRecords = snapshot.docs.map(document => document.data()).filter(record => record.enabled === true);
        const uids = [...new Set([ADMIN_UID, ...roleRecords.map(record => record.uid).filter(Boolean)])];
        const users = [];
        for (let index = 0; index < uids.length; index += 100) {
            const batch = await auth.getUsers(uids.slice(index, index + 100).map(uid => ({ uid })));
            users.push(...batch.users.map(publicAdministratorRecord));
        }
        users.sort((left, right) => Number(right.primary) - Number(left.primary)
            || String(left.email || left.uid).localeCompare(String(right.email || right.uid), undefined, { sensitivity:'base' }));
        res.json({ administrators:users });
    } catch (error) {
        res.status(500).json({ error:{ message:error.message || 'Unable to list administrators.' } });
    }
});

app.post('/api/admin/roles', requireUser, requireAdmin, async (req, res) => {
    try {
        if (typeof req.body?.enabled !== 'boolean') {
            return res.status(400).json({ error:{ message:'The enabled field must be true or false.' } });
        }
        const target = await resolveAdministratorTarget(req.body?.identifier);
        const enabled = req.body.enabled;
        if (enabled && target.disabled) {
            return res.status(409).json({ error:{ message:'Enable this Firebase account before granting administrator access.' } });
        }
        if (!enabled && target.uid === ADMIN_UID) {
            return res.status(409).json({ error:{ message:'The primary administrator cannot be revoked.' } });
        }
        if (!enabled && target.uid === req.user.uid) {
            return res.status(409).json({ error:{ message:'You cannot revoke your own administrator access.' } });
        }

        const claims = { ...(target.customClaims || {}) };
        if (enabled) claims.admin = true;
        else delete claims.admin;
        await auth.setCustomUserClaims(target.uid, claims);
        if (!enabled) await auth.revokeRefreshTokens(target.uid);

        await administratorRolesCollection().doc(administratorRoleDocumentId(target.uid)).set({
            uid:target.uid,
            email:target.email || '',
            displayName:target.displayName || '',
            enabled,
            primary:target.uid === ADMIN_UID,
            grantedBy:enabled ? req.user.uid : FieldValue.delete(),
            revokedBy:enabled ? FieldValue.delete() : req.user.uid,
            updatedAt:FieldValue.serverTimestamp()
        }, { merge:true });
        await administratorAuditCollection().add({
            action:enabled ? 'administrator_granted' : 'administrator_revoked',
            actorUid:req.user.uid,
            actorEmail:req.user.email || '',
            targetUid:target.uid,
            targetEmail:target.email || '',
            timestamp:FieldValue.serverTimestamp()
        });

        const refreshed = await auth.getUser(target.uid);
        res.json({
            ok:true,
            user:publicAdministratorRecord(refreshed),
            message:enabled
                ? 'Administrator access granted. The user must sign out and back in to refresh the session.'
                : 'Administrator access revoked. Existing sessions will be rejected when their token is refreshed.'
        });
    } catch (error) {
        res.status(error.status || 500).json({ error:{ message:error.message || 'Unable to update administrator access.' } });
    }
});

app.get('/api/admin/metrics', requireUser, requireAdmin, async (_req, res) => {
    const [days, jobs, events] = await Promise.all([
        db.collection('admin_metrics').doc('api_usage').collection('days').orderBy('day', 'desc').limit(30).get(),
        db.collection('translation_jobs').orderBy('createdAt', 'desc').limit(50).get(),
        db.collection('admin_metrics').doc('events').collection('items').orderBy('timestamp', 'desc').limit(100).get()
    ]);
    res.json({
        usage:days.docs.map(document => ({ id:document.id, ...document.data() })),
        jobs:jobs.docs.map(document => ({ id:document.id, ...document.data(), result:undefined })),
        events:events.docs.map(document => ({ id:document.id, ...document.data(), timestamp:timestampMillis(document.data().timestamp) }))
    });
});

app.get('/api/admin/performance', requireUser, requireAdmin, async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 2_000, 5_000);
    const snapshot = await db.collection('admin_metrics').doc('events').collection('items')
        .orderBy('timestamp', 'desc').limit(limit).get();
    const events = snapshot.docs.map(document => ({ id:document.id, ...document.data() }));
    res.json({
        sampleSize:events.length,
        generatedAt:Date.now(),
        pricingConfigured:!!(
            Number(process.env.GEMINI_PRIMARY_INPUT_USD_PER_MILLION || 0)
            && Number(process.env.GEMINI_PRIMARY_OUTPUT_USD_PER_MILLION || 0)
        ),
        ...summarizePerformanceEvents(events)
    });
});

app.get('/api/admin/product', requireUser, requireAdmin, async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 5_000, 10_000);
    const snapshot = await productEventsCollection().orderBy('timestamp', 'desc').limit(limit).get();
    const events = snapshot.docs.map(document => document.data());
    const sevenDaysAgo = Date.now() - 7 * 86_400_000;
    const remembered = events.filter(event => event.event === 'word_remembered' && Number(event.timestamp || 0) >= sevenDaysAgo);
    const funnelNames = ['session_started','translation_result_viewed','word_remembered','daily_plan_opened','daily_plan_summary','subscription_started'];
    const funnel = Object.fromEntries(funnelNames.map(name => [name, events.filter(event => event.event === name).length]));
    res.json({
        generatedAt:Date.now(),
        sampleSize:events.length,
        northStar:{
            name:'Weekly Remembered Words',
            count:remembered.length,
            learners:new Set(remembered.map(event => event.userHash)).size
        },
        funnel,
        accountKinds:{
            guest:events.filter(event => event.accountKind === 'guest').length,
            registered:events.filter(event => event.accountKind === 'registered').length
        },
        recentErrors:events.filter(event => event.event === 'client_error').slice(0, 100)
            .map(event => ({timestamp:event.timestamp, metadata:event.metadata}))
    });
});

async function snapshotDictionaryVersion(reference, action, administratorUid) {
    const snapshot = await reference.get();
    if (!snapshot.exists) throw Object.assign(new Error('Dictionary entry not found.'), {status:404});
    const versionReference = reference.collection('versions').doc();
    await versionReference.set({
        entryId:reference.id,
        action,
        administratorUid,
        snapshot:snapshot.data(),
        timestamp:Date.now(),
        createdAt:FieldValue.serverTimestamp()
    });
    return {snapshot, versionId:versionReference.id};
}

async function validateDictionaryJSON(entry, candidate) {
    const context = dictionaryContext(entry);
    const raw = typeof candidate === 'string' ? JSON.parse(candidate) : candidate;
    const normalized = normalizeTranslationResult(raw, context);
    const issues = coreQualityIssues(normalized, context);
    if (issues.length) throw Object.assign(new Error(`The correction is incomplete: ${issues.join(', ')}.`), {status:400});
    return normalized;
}

app.get('/api/admin/dictionary', requireUser, requireAdmin, async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const snapshot = await db.collectionGroup('global_dictionary').limit(limit).get();
    const includeArchived = req.query.includeArchived === 'true';
    res.json({ entries:snapshot.docs
        .filter(document => includeArchived || !document.data()?.deletedAt)
        .map(document => ({ id:document.id, path:document.ref.path, ...document.data(), fullJSON:undefined })) });
});

app.get('/api/admin/dictionary/:id', requireUser, requireAdmin, async (req, res) => {
    if (!/^[a-f0-9]{64}$/i.test(req.params.id)) return res.status(400).json({error:{message:'Invalid dictionary entry identifier.'}});
    const reference = dictionaryReference(req.params.id);
    const [entry, versions] = await Promise.all([
        reference.get(), reference.collection('versions').orderBy('timestamp', 'desc').limit(50).get()
    ]);
    if (!entry.exists) return res.status(404).json({error:{message:'Dictionary entry not found.'}});
    res.json({
        entry:{id:entry.id, ...entry.data()},
        versions:versions.docs.map(version => ({id:version.id, ...version.data(), createdAt:timestampMillis(version.data().createdAt)}))
    });
});

app.patch('/api/admin/dictionary/:id', requireUser, requireAdmin, async (req, res) => {
    if (!/^[a-f0-9]{64}$/i.test(req.params.id)) return res.status(400).json({error:{message:'Invalid dictionary entry identifier.'}});
    const reference = dictionaryReference(req.params.id);
    const action = String(req.body?.action || '').toLowerCase();
    if (!['verify','report','stale','archive','restore','correct','restore_version'].includes(action)) {
        return res.status(400).json({error:{message:'Unsupported dictionary action.'}});
    }
    try {
        const {snapshot, versionId} = await snapshotDictionaryVersion(reference, action, req.user.uid);
        const entry = snapshot.data();
        let update = {qualityUpdatedAt:Date.now(), qualityUpdatedBy:req.user.uid};
        if (action === 'verify') {
            await validateDictionaryJSON(entry, entry.fullJSON || entry.translation);
            update = {...update, qualityStatus:'verified', verificationStatus:'qelumi_verified', verifiedAt:FieldValue.serverTimestamp(), verifiedBy:req.user.uid, deletedAt:FieldValue.delete()};
        } else if (action === 'report') {
            update = {...update, previousQualityStatus:entry.qualityStatus || 'generated', qualityStatus:'reported', reportedAt:FieldValue.serverTimestamp(), reportedBy:req.user.uid};
        } else if (action === 'stale') {
            update = {...update, previousQualityStatus:entry.qualityStatus || 'generated', qualityStatus:'stale'};
        } else if (action === 'archive') {
            update = {...update, previousQualityStatus:entry.qualityStatus || 'complete', qualityStatus:'superseded', deletedAt:FieldValue.serverTimestamp(), deletedBy:req.user.uid};
        } else if (action === 'restore') {
            update = {...update, qualityStatus:dictionaryQualityStatuses.has(entry.previousQualityStatus) && entry.previousQualityStatus !== 'superseded' ? entry.previousQualityStatus : 'complete', deletedAt:FieldValue.delete(), deletedBy:FieldValue.delete()};
        } else if (action === 'correct') {
            const normalized = await validateDictionaryJSON(entry, req.body?.result);
            update = {...update, fullJSON:JSON.stringify(normalized), schemaVersion:DICTIONARY_SCHEMA_VERSION, modelVersion:DICTIONARY_SCHEMA_VERSION, coreComplete:true, qualityStatus:'verified', verificationStatus:'qelumi_verified', verifiedAt:FieldValue.serverTimestamp(), verifiedBy:req.user.uid, deletedAt:FieldValue.delete()};
        } else if (action === 'restore_version') {
            const selected = await reference.collection('versions').doc(String(req.body?.versionId || '')).get();
            if (!selected.exists) throw Object.assign(new Error('Dictionary version not found.'), {status:404});
            const restored = selected.data()?.snapshot;
            if (!restored) throw Object.assign(new Error('That version cannot be restored.'), {status:400});
            update = {...restored, qualityUpdatedAt:Date.now(), qualityUpdatedBy:req.user.uid, restoredFromVersion:selected.id};
        }
        await reference.set(update, {merge:action !== 'restore_version'});
        translationService.invalidateDocumentId(req.params.id);
        await db.collection('admin_metrics').doc('dictionary_audit').collection('items').add({
            entryId:req.params.id, action, administratorUid:req.user.uid, previousVersionId:versionId,
            timestamp:Date.now(), createdAt:FieldValue.serverTimestamp()
        });
        res.json({ok:true, action, previousVersionId:versionId});
    } catch (error) { res.status(error.status || 500).json({error:{message:error.message}}); }
});

app.post('/api/admin/cache/clear', requireUser, requireAdmin, async (_req, res) => {
    const removed = translationService.clearL1Cache();
    res.json({ ok:true, removed, cache:translationService.l1Stats() });
});

app.delete('/api/admin/dictionary/:id', requireUser, requireAdmin, async (req, res) => {
    if (!/^[a-f0-9]{64}$/i.test(req.params.id)) {
        return res.status(400).json({ error:{ message:'Invalid dictionary entry identifier.' } });
    }
    const reference = dictionaryReference(req.params.id);
    try {
        const {snapshot, versionId} = await snapshotDictionaryVersion(reference, 'archive', req.user.uid);
        await reference.set({
            previousQualityStatus:snapshot.data()?.qualityStatus || 'complete',
            qualityStatus:'superseded', verificationStatus:snapshot.data()?.verificationStatus || 'ai_generated',
            deletedAt:FieldValue.serverTimestamp(), deletedBy:req.user.uid,
            qualityUpdatedAt:Date.now(), qualityUpdatedBy:req.user.uid
        }, {merge:true});
        translationService.invalidateDocumentId(req.params.id);
        res.json({ ok:true, archived:true, previousVersionId:versionId });
    } catch (error) { res.status(error.status || 500).json({error:{message:error.message}}); }
});

app.get('/api/admin/feedback', requireUser, requireAdmin, async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 500, 2_000);
    const snapshot = await feedbackCollection()
        .select('uid', 'accountEmail', 'replyEmail', 'email', 'category', 'type', 'text', 'date', 'status',
            'notificationStatus', 'notificationAttempts', 'notificationEmailId', 'notificationError',
            'attachmentName', 'hasAttachment', 'translationQuery', 'translationFromLang',
            'translationToLang', 'dictionaryEntryId', 'createdAt')
        .orderBy('date', 'desc').limit(limit).get();
    res.json({ feedback:snapshot.docs.map(document => {
        const data = document.data();
        return {
            id:document.id, ...data, date:timestampMillis(data.date), createdAt:timestampMillis(data.createdAt),
            hasAttachment:data.hasAttachment === true || !!data.attachmentName
        };
    }) });
});

app.get('/api/admin/feedback/:id/attachment', requireUser, requireAdmin, async (req, res) => {
    const snapshot = await feedbackCollection().doc(req.params.id).get();
    if (!snapshot.exists || !snapshot.data().attachmentData) return res.status(404).json({ error:{ message:'Attachment not found.' } });
    res.json({ attachmentName:snapshot.data().attachmentName || 'attachment', attachmentData:snapshot.data().attachmentData });
});

app.patch('/api/admin/feedback/:id', requireUser, requireAdmin, async (req, res) => {
    if (!feedbackStatuses.has(req.body?.status)) return res.status(400).json({ error:{ message:'Invalid feedback status.' } });
    await feedbackCollection().doc(req.params.id).update({
        status:req.body.status, reviewedAt:FieldValue.serverTimestamp(), reviewedBy:req.user.uid
    });
    res.json({ ok:true, status:req.body.status });
});

app.post('/api/admin/feedback/:id/retry', requireUser, requireAdmin, async (req, res) => {
    const feedbackRef = feedbackCollection().doc(req.params.id);
    const snapshot = await feedbackRef.get();
    if (!snapshot.exists) return res.status(404).json({ error:{ message:'Feedback not found.' } });
    try {
        const delivery = await sendFeedbackNotification(snapshot.id, snapshot.data());
        await feedbackRef.update({
            notificationStatus:'sent', notificationEmailId:delivery?.id || '',
            notificationAttempts:FieldValue.increment(1), notificationSentAt:FieldValue.serverTimestamp(),
            notificationError:FieldValue.delete()
        });
        res.json({ ok:true, notificationStatus:'sent', notificationEmailId:delivery?.id || '' });
    } catch (error) {
        const status = error.code === 'email/not-configured' ? 'not_configured' : 'failed';
        await feedbackRef.update({
            notificationStatus:status, notificationAttempts:FieldValue.increment(1),
            notificationError:String(error.message || 'Notification failed.').slice(0, 500),
            notificationUpdatedAt:FieldValue.serverTimestamp()
        });
        res.status(502).json({ error:{ message:error.message }, notificationStatus:status });
    }
});

app.get('/api/admin/searches', requireUser, requireAdmin, async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 2_000, 5_000);
    const historyBaseQuery = db.collectionGroup('history').select('query', 'fromLang', 'toLang', 'timestamp');
    const historyQuery = historyBaseQuery.orderBy('timestamp', 'desc').limit(limit).get()
        .catch(error => {
            console.warn('History collection-group index is still building; using unordered fallback.', error.message);
            return historyBaseQuery.limit(limit).get();
        });
    const [auditSnapshot, historySnapshot] = await Promise.all([
        translationSearchCollection().orderBy('timestamp', 'desc').limit(limit).get(),
        historyQuery
    ]);
    const auditEvents = auditSnapshot.docs.map(document => ({
        id:document.id, ...document.data(), timestamp:timestampMillis(document.data().timestamp), legacy:false
    }));
    const appHistory = historySnapshot.docs.filter(document => document.ref.path.startsWith(`artifacts/${APP_ID}/users/`));
    const historyUids = appHistory.map(document => document.ref.path.split('/')[3]);
    const emailMap = await resolveUserEmails(historyUids);
    const auditByKey = new Map();
    for (const event of auditEvents) {
        const key = `${event.uid}|${String(event.query || '').toLocaleLowerCase()}|${event.fromLang || ''}|${event.toLang || ''}`;
        if (!auditByKey.has(key)) auditByKey.set(key, []);
        auditByKey.get(key).push(event.timestamp);
    }
    const legacyEvents = appHistory.flatMap(document => {
        const data = document.data();
        const uid = document.ref.path.split('/')[3];
        const timestamp = timestampMillis(data.timestamp);
        const key = `${uid}|${String(data.query || '').toLocaleLowerCase()}|${data.fromLang || ''}|${data.toLang || ''}`;
        const duplicate = (auditByKey.get(key) || []).some(auditTime => Math.abs(auditTime - timestamp) < 15_000);
        if (duplicate) return [];
        return [{
            id:`legacy:${document.ref.path}`,
            uid,
            userEmail:emailMap.get(uid) || '',
            query:data.query || '',
            queryLower:String(data.query || '').toLocaleLowerCase(),
            fromLang:data.fromLang || '',
            toLang:data.toLang || '',
            source:'legacy_history',
            sourceLabel:'Legacy history — original source unknown',
            cacheStatus:'unknown',
            outcome:'success',
            timestamp,
            legacy:true
        }];
    });
    const searches = [...auditEvents, ...legacyEvents].sort((first, second) => second.timestamp - first.timestamp);
    res.json({ searches, auditCount:auditEvents.length, legacyCount:legacyEvents.length });
});

app.use((error, _req, res, _next) => res.status(error.message === 'Origin not allowed' ? 403 : 500).json({ error:{ message:error.message } }));
app.listen(port, () => console.log(`Qelumi secure backend running on port ${port}`));
