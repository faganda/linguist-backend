#!/usr/bin/env node
import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import {
    PRIMARY_MODEL, PRIMARY_THINKING, DICTIONARY_SCHEMA_VERSION,
    buildCoreRequest, parseGeminiJSON, normalizeTranslationResult, coreQualityIssues,
    dictionaryDocumentId, normalizeDictionaryQuery, createTranslationService,
    buildGeminiCompatibilityRequests
} from '../translation-service.js';

const APP_ID = process.env.APP_ID || 'linguist-app-v7';
const apiKey = process.env.GEMINI_API_KEY;
const maxCandidates = Math.min(500, Math.max(1, Number(process.env.BATCH_PREWARM_LIMIT || 100)));
const minimumSearches = Math.max(1, Number(process.env.BATCH_PREWARM_MIN_SEARCHES || 2));
const scanLimit = Math.min(20_000, Math.max(maxCandidates, Number(process.env.BATCH_PREWARM_SCAN_LIMIT || 5_000)));
const pollMs = Math.max(10_000, Number(process.env.BATCH_POLL_INTERVAL_MS || 30_000));
const maxWaitMs = Math.max(pollMs, Number(process.env.BATCH_MAX_WAIT_MS || 23 * 60 * 60_000));
const freshTtlMs = Math.max(60_000, Number(process.env.DICTIONARY_FRESH_TTL_MS || 30 * 24 * 60 * 60_000));

function initialiseFirebase() {
    if (getApps().length) return getApps()[0];
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return initializeApp({ credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) });
    return initializeApp({ credential:applicationDefault(), projectId:process.env.FIREBASE_PROJECT_ID || 'mylinguist28' });
}

initialiseFirebase();
const db = getFirestore();
const service = createTranslationService({ db, FieldValue, recordUsage:async () => {} });
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const contextKey = item => `${item.fromLang}|${item.toLang}|${normalizeDictionaryQuery(item.query)}`;

function validCandidate(value) {
    return value && typeof value.query === 'string' && value.query.trim()
        && typeof value.fromLang === 'string' && typeof value.toLang === 'string';
}

function configuredSeeds() {
    if (!process.env.BATCH_PREWARM_SEEDS_JSON) return [];
    try {
        const parsed = JSON.parse(process.env.BATCH_PREWARM_SEEDS_JSON);
        return Array.isArray(parsed) ? parsed.filter(validCandidate) : [];
    } catch (error) {
        throw new Error(`BATCH_PREWARM_SEEDS_JSON is invalid JSON: ${error.message}`);
    }
}

async function collectCandidates() {
    const snapshot = await db.collection('admin_metrics').doc('translation_searches').collection('items')
        .orderBy('timestamp', 'desc').limit(scanLimit).get();
    const scores = new Map();
    for (const document of snapshot.docs) {
        const item = document.data();
        if (!validCandidate(item) || item.query === '[Image]' || !['success', 'definitions_only', 'error'].includes(item.outcome || 'success')) continue;
        const context = {
            query:String(item.query).normalize('NFKC').trim().replace(/\s+/gu, ' ').slice(0, 300),
            fromLang:String(item.fromLang).toUpperCase(), toLang:String(item.toLang).toUpperCase(),
            definitionsOnly:item.definitionsOnly === true || item.fromLang === item.toLang
        };
        const key = contextKey(context);
        const previous = scores.get(key) || { context, searches:0, misses:0, errors:0, latest:0 };
        previous.searches += 1;
        if (item.cacheStatus === 'new' || ['generated', 'dictionary_repair'].includes(item.source)) previous.misses += 1;
        if (item.outcome === 'error') previous.errors += 1;
        previous.latest = Math.max(previous.latest, Number(item.timestamp || 0));
        scores.set(key, previous);
    }
    for (const seed of configuredSeeds()) {
        const context = {
            query:String(seed.query).normalize('NFKC').trim().replace(/\s+/gu, ' ').slice(0, 300),
            fromLang:String(seed.fromLang).toUpperCase(), toLang:String(seed.toLang).toUpperCase(),
            definitionsOnly:seed.definitionsOnly === true || seed.fromLang === seed.toLang
        };
        const key = contextKey(context);
        const previous = scores.get(key) || { context, searches:0, misses:0, errors:0, latest:Date.now() };
        previous.seed = true;
        scores.set(key, previous);
    }

    const ranked = [...scores.values()]
        .filter(item => item.seed || item.searches >= minimumSearches || item.errors > 0)
        .sort((a, b) => ((b.errors * 10) + (b.misses * 3) + b.searches) - ((a.errors * 10) + (a.misses * 3) + a.searches));
    const selected = [];
    for (const item of ranked) {
        if (selected.length >= maxCandidates) break;
        const ref = db.doc(`artifacts/${APP_ID}/public/data/global_dictionary/${dictionaryDocumentId(item.context.query, item.context.fromLang, item.context.toLang)}`);
        const snapshot = await ref.get();
        let needsGeneration = !snapshot.exists;
        if (snapshot.exists) {
            const stored = snapshot.data();
            try {
                const raw = typeof stored.fullJSON === 'string' ? JSON.parse(stored.fullJSON) : stored.translation;
                const normalized = normalizeTranslationResult(raw, item.context);
                const updatedAt = stored.updatedAt?.toMillis?.() || Number(stored.updatedAt || 0);
                needsGeneration = coreQualityIssues(normalized, item.context).length > 0
                    || Number(stored.schemaVersion || 0) < DICTIONARY_SCHEMA_VERSION
                    || Date.now() - updatedAt > freshTtlMs;
            } catch (_) { needsGeneration = true; }
        }
        if (needsGeneration) selected.push(item);
    }
    return selected;
}

async function geminiBatchRequest(path, init = {}) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${path}`, {
        ...init,
        headers:{ 'Content-Type':'application/json', 'x-goog-api-key':apiKey, ...(init.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || `Gemini Batch request failed (${response.status}).`);
    return data;
}

async function submitBatch(candidates) {
    const requests = candidates.map((item, index) => {
        const request = buildCoreRequest(item.context);
        // The core schema is intentionally supplied as a prompt contract because
        // Gemini may reject schemas of this complexity before a batch job starts.
        const compatibleRequest = buildGeminiCompatibilityRequests(request, PRIMARY_THINKING)[0].body;
        return { request:compatibleRequest, metadata:{ key:`${index}:${dictionaryDocumentId(item.context.query, item.context.fromLang, item.context.toLang)}` } };
    });
    return geminiBatchRequest(`models/${encodeURIComponent(PRIMARY_MODEL)}:batchGenerateContent`, {
        method:'POST', body:JSON.stringify({ batch:{
            display_name:`qelumi-nightly-${new Date().toISOString().slice(0, 10)}`,
            input_config:{ requests:{ requests } }
        } })
    });
}

async function pollBatch(name) {
    const started = Date.now();
    while (Date.now() - started < maxWaitMs) {
        const status = await geminiBatchRequest(name);
        const state = status?.metadata?.state || status?.state;
        console.log(`Batch ${name}: ${state || 'pending'}`);
        if (['JOB_STATE_SUCCEEDED', 'JOB_STATE_FAILED', 'JOB_STATE_CANCELLED', 'JOB_STATE_EXPIRED'].includes(state)) return status;
        await sleep(pollMs);
    }
    throw new Error(`Batch ${name} did not finish within ${maxWaitMs} ms.`);
}

async function applyResults(status, candidates) {
    const responses = status?.response?.inlinedResponses || status?.response?.inlined_responses || [];
    let stored = 0; let rejected = 0;
    for (let index = 0; index < candidates.length; index += 1) {
        const inline = responses[index];
        if (!inline?.response) { rejected += 1; continue; }
        const context = candidates[index].context;
        try {
            const raw = parseGeminiJSON(inline.response);
            const result = normalizeTranslationResult(raw, context);
            const issues = coreQualityIssues(result, context);
            if (issues.length) { console.warn(`Skipped ${contextKey(context)}: ${issues.join(', ')}`); rejected += 1; continue; }
            await service.saveCachedResult(context, result, {
                model:PRIMARY_MODEL, fallbackUsed:false, fallbackReason:'', incrementUse:false
            });
            stored += 1;
        } catch (error) {
            console.warn(`Skipped ${contextKey(context)}: ${error.message}`); rejected += 1;
        }
    }
    return { stored, rejected };
}

async function finishBatch(jobRef, name, candidates) {
    await jobRef.update({ status:'running', lastPolledAt:FieldValue.serverTimestamp() });
    const status = await pollBatch(name);
    const state = status?.metadata?.state || status?.state;
    if (state !== 'JOB_STATE_SUCCEEDED') {
        await jobRef.update({ status:'failed', state, error:status?.error?.message || '', completedAt:FieldValue.serverTimestamp() });
        throw new Error(`Gemini Batch finished with ${state}.`);
    }
    const result = await applyResults(status, candidates);
    await jobRef.update({ status:'succeeded', state, ...result, completedAt:FieldValue.serverTimestamp() });
    console.log(`Nightly pre-generation complete: ${result.stored} stored, ${result.rejected} rejected by the production gate.`);
}

async function main() {
    if (!apiKey) throw new Error('GEMINI_API_KEY is required.');
    const day = new Date().toISOString().slice(0, 10);
    const jobRef = db.doc(`admin_metrics/nightly_batches/jobs/${day}`);
    const existing = await jobRef.get();
    if (existing.exists && !process.argv.includes('--force')) {
        const saved = existing.data();
        if (saved.status === 'succeeded' || saved.status === 'nothing_to_do') {
            console.log(`Nightly batch ${day} is already ${saved.status}; no duplicate job was submitted.`);
            return;
        }
        if (['submitted', 'running'].includes(saved.status) && saved.name && Array.isArray(saved.candidateContexts)) {
            console.log(`Resuming existing batch ${saved.name}; no duplicate job was submitted.`);
            await finishBatch(jobRef, saved.name, saved.candidateContexts.map(context => ({ context })));
            return;
        }
        if (['submitted', 'running', 'preparing'].includes(saved.status)) {
            console.log(`Nightly batch ${day} is already ${saved.status}, but cannot be resumed automatically. Use --force only after checking Gemini Batch jobs.`);
            return;
        }
    }
    const candidates = await collectCandidates();
    if (!candidates.length) {
        await jobRef.set({ status:'nothing_to_do', date:day, checkedAt:FieldValue.serverTimestamp() }, { merge:true });
        console.log('No missing, incomplete, or stale high-value dictionary entries need pre-generation.');
        return;
    }
    await jobRef.set({
        status:'preparing', date:day, model:PRIMARY_MODEL, thinkingLevel:PRIMARY_THINKING,
        candidateCount:candidates.length, candidateKeys:candidates.map(item => contextKey(item.context)),
        candidateContexts:candidates.map(item => item.context),
        createdAt:FieldValue.serverTimestamp()
    });
    const submitted = await submitBatch(candidates);
    const name = submitted.name || submitted.metadata?.name;
    if (!name) throw new Error('Gemini Batch did not return a job name.');
    await jobRef.update({ status:'submitted', name, submittedAt:FieldValue.serverTimestamp() });
    console.log(`Submitted ${candidates.length} requests as ${name}.`);
    await finishBatch(jobRef, name, candidates);
}

main().catch(error => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
});
