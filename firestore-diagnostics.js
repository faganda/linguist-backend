import crypto from 'node:crypto';

const resourceExhaustedCodes = new Set([8, '8', 'resource-exhausted', 'RESOURCE_EXHAUSTED']);
const MAX_DIAGNOSTIC_TEXT = 800;

const boundedCount = value => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(100_000, Math.trunc(number))) : 0;
};

const safeIdentifier = (value, fallback = 'unknown') => {
    const cleaned = String(value || '').trim().replace(/[^A-Za-z0-9._/-]+/g, '_').slice(0, 160);
    return cleaned || fallback;
};

export function sanitizeFirestoreDiagnosticText(value) {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .replace(/Bearer\s+[^\s,;]+/gi, 'Bearer [redacted]')
        .replace(/AIza[A-Za-z0-9_-]{20,}/g, '[redacted-api-key]')
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
        .replace(/projects\/[^\s/"',)\]}]+/gi, 'projects/[redacted]')
        .replace(/documents\/[^\s"',)\]}]+/gi, 'documents/[redacted]')
        .replace(/\b(?:uid|user_id|userId|history_id|historyId)\s*[:=]\s*["']?[^\s,"']+/gi, match => `${match.split(/[:=]/, 1)[0]}=[redacted]`)
        .trim()
        .slice(0, MAX_DIAGNOSTIC_TEXT);
}

export function isFirestoreResourceExhausted(error) {
    if (resourceExhaustedCodes.has(error?.code)) return true;
    const message = `${error?.name || ''} ${error?.message || ''} ${typeof error?.details === 'string' ? error.details : ''}`;
    return /\bRESOURCE_EXHAUSTED\b|\bquota exceeded\b/i.test(message);
}

function metadataMap(error) {
    try {
        const map = error?.metadata?.getMap?.();
        return map && typeof map === 'object' ? map : {};
    } catch (_) {
        return {};
    }
}

function flattenDiagnosticValues(value, path = '', output = [], seen = new Set(), depth = 0) {
    if (value == null || depth > 6) return output;
    if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
        output.push({path, key:path.split('.').at(-1) || '', binary:true, value:''});
        return output;
    }
    if (['string', 'number', 'boolean'].includes(typeof value)) {
        output.push({path, key:path.split('.').at(-1) || '', binary:false, value:String(value)});
        return output;
    }
    if (typeof value !== 'object' || seen.has(value)) return output;
    seen.add(value);
    if (Array.isArray(value)) {
        value.slice(0, 30).forEach((item, index) => flattenDiagnosticValues(item, `${path}[${index}]`, output, seen, depth + 1));
    } else {
        Object.entries(value).slice(0, 80).forEach(([key, item]) => {
            flattenDiagnosticValues(item, path ? `${path}.${key}` : key, output, seen, depth + 1);
        });
    }
    return output;
}

const normalizedFieldName = value => String(value || '').replace(/[^A-Za-z0-9]/g, '').toLowerCase();

function labelledTextValue(text, label) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const direct = new RegExp(`(?:${escaped})\\s*[:=]\\s*["']?([A-Za-z0-9._:/-]{2,240})`, 'i').exec(text)?.[1];
    if (direct) return direct;
    return new RegExp(`key\\s*:\\s*["']${escaped}["'][\\s\\S]{0,160}?value\\s*:\\s*["']([^"']{2,240})`, 'i').exec(text)?.[1] || '';
}

function safeMetricToken(value) {
    const match = String(value || '').trim().match(/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)+|[A-Za-z][A-Za-z0-9._-]{1,159}/);
    return match ? match[0].slice(0, 240) : '';
}

export function extractFirestoreQuotaDetails(error) {
    const structured = [
        error?.statusDetails,
        error?.errorInfo,
        error?.errorInfoMetadata,
        error?.quotaFailure,
        typeof error?.details === 'object' ? error.details : null,
        metadataMap(error)
    ];
    const flattened = structured.flatMap((value, index) => flattenDiagnosticValues(value, `source${index}`));
    const allText = [error?.message, typeof error?.details === 'string' ? error.details : '', ...flattened.map(item => item.value)]
        .filter(Boolean).join(' ');
    const byField = names => flattened.find(item => names.includes(normalizedFieldName(item.key)) && item.value)?.value || '';
    const metric = byField(['quotametric', 'metric'])
        || labelledTextValue(allText, 'quota_metric')
        || labelledTextValue(allText, 'quota metric')
        || allText.match(/\b((?:firestore|datastore)\.googleapis\.com\/[A-Za-z0-9._/-]+)\b/i)?.[1]
        || '';
    const quotaLimit = byField(['quotalimit', 'limitname'])
        || labelledTextValue(allText, 'quota_limit')
        || labelledTextValue(allText, 'quota limit');
    const quotaId = byField(['quotaid']) || labelledTextValue(allText, 'quota_id');
    const service = byField(['service', 'apiservice'])
        || labelledTextValue(allText, 'service')
        || allText.match(/\b((?:firestore|datastore)\.googleapis\.com)\b/i)?.[1]
        || 'firestore.googleapis.com';
    const reason = error?.reason || byField(['reason'])
        || labelledTextValue(allText, 'reason')
        || (isFirestoreResourceExhausted(error) ? 'RESOURCE_EXHAUSTED' : 'UNKNOWN');
    const quotaValue = byField(['quotavalue']) || labelledTextValue(allText, 'quota_value');
    return {
        providerQuotaMetric:safeMetricToken(metric) || 'not_provided_by_firestore',
        providerQuotaLimit:safeMetricToken(quotaLimit) || 'not_provided_by_firestore',
        providerQuotaId:safeMetricToken(quotaId) || 'not_provided_by_firestore',
        providerQuotaValue:String(quotaValue || 'not_provided_by_firestore').slice(0, 80),
        providerService:safeMetricToken(service) || 'firestore.googleapis.com',
        providerReason:safeIdentifier(reason, 'RESOURCE_EXHAUSTED'),
        providerMessage:sanitizeFirestoreDiagnosticText(
            typeof error?.details === 'string' ? error.details : error?.message || 'Firestore resource exhausted.'
        ),
        binaryStatusDetailsPresent:flattened.some(item => item.binary)
    };
}

export function createFirestoreDiagnosticReference({now = Date.now(), randomBytes = crypto.randomBytes} = {}) {
    const day = new Date(now).toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = Buffer.from(randomBytes(5)).toString('hex').toUpperCase().slice(0, 10).padEnd(10, '0');
    return `QEL-FS-${day}-${suffix}`;
}

export function buildFirestoreResourceDiagnostic(error, context = {}, options = {}) {
    const diagnosticReference = createFirestoreDiagnosticReference(options);
    const attemptedOperations = {
        documentReads:boundedCount(context.documentReads),
        documentWrites:boundedCount(context.documentWrites),
        documentDeletes:boundedCount(context.documentDeletes)
    };
    const activeMetrics = Object.entries(attemptedOperations).filter(([, count]) => count > 0).map(([metric]) => metric);
    const quota = extractFirestoreQuotaDetails(error);
    const effectiveMetric = quota.providerQuotaMetric !== 'not_provided_by_firestore'
        ? quota.providerQuotaMetric
        : activeMetrics.length === 1 ? activeMetrics[0] : 'not_identified_by_provider';
    return {
        diagnosticReference,
        log:{
            event:'firestore_resource_exhausted',
            diagnosticReference,
            occurredAt:new Date(options.now ?? Date.now()).toISOString(),
            operation:safeIdentifier(context.operation, 'firestore_operation'),
            stage:safeIdentifier(context.stage, 'unknown'),
            effectiveMetric,
            metricSource:quota.providerQuotaMetric !== 'not_provided_by_firestore'
                ? 'firestore_error_details' : activeMetrics.length === 1 ? 'operation_stage' : 'not_available',
            attemptedOperations,
            provider:quota,
            request:{
                deleteExamples:context.deleteExamples === true,
                userHash:safeIdentifier(context.userHash, 'not_recorded'),
                resourceHash:safeIdentifier(context.resourceHash, 'not_recorded')
            }
        }
    };
}
