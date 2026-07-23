import crypto from 'node:crypto';
import { LANGUAGES } from './translation-service.js';

export const LEARNING_FEATURES = Object.freeze([
    'context_lens', 'shadowing', 'conversation', 'story', 'writing_coach'
]);

const textArray = (maxItems = 10) => ({
    type:'array', maxItems, items:{ type:'string' }
});

const CONTEXT_LENS_SCHEMA = Object.freeze({
    type:'object', additionalProperties:false,
    properties:{
        extractedText:{ type:'string' },
        selectedText:{ type:'string' },
        dictionaryForm:{ type:'string' },
        sourceLanguage:{ type:'string' },
        targetLanguage:{ type:'string' },
        contextualTranslation:{ type:'string' },
        partOfSpeech:{ type:'string' },
        register:{ type:'string' },
        cefrLevel:{ type:'string' },
        frequencyBand:{ type:'string' },
        sourceExplanation:{ type:'string' },
        targetExplanation:{ type:'string' },
        contextClues:textArray(5),
        example:{ type:'string' },
        exampleTranslation:{ type:'string' }
    },
    required:[
        'extractedText', 'selectedText', 'dictionaryForm', 'sourceLanguage', 'targetLanguage',
        'contextualTranslation', 'partOfSpeech', 'register', 'cefrLevel', 'frequencyBand',
        'sourceExplanation', 'targetExplanation', 'contextClues', 'example', 'exampleTranslation'
    ]
});

const SHADOWING_SCHEMA = Object.freeze({
    type:'object', additionalProperties:false,
    properties:{
        transcript:{ type:'string' },
        overallScore:{ type:'number', minimum:0, maximum:100 },
        soundAccuracy:{ type:'number', minimum:0, maximum:100 },
        fluency:{ type:'number', minimum:0, maximum:100 },
        stress:{ type:'number', minimum:0, maximum:100 },
        rhythm:{ type:'number', minimum:0, maximum:100 },
        intonation:{ type:'number', minimum:0, maximum:100 },
        wordFeedback:{
            type:'array', maxItems:30,
            items:{
                type:'object', additionalProperties:false,
                properties:{
                    word:{ type:'string' },
                    score:{ type:'number', minimum:0, maximum:100 },
                    issue:{ type:'string' },
                    suggestion:{ type:'string' }
                },
                required:['word', 'score', 'issue', 'suggestion']
            }
        },
        summary:{ type:'string' },
        nextStep:{ type:'string' }
    },
    required:[
        'transcript', 'overallScore', 'soundAccuracy', 'fluency', 'stress', 'rhythm',
        'intonation', 'wordFeedback', 'summary', 'nextStep'
    ]
});

const CONVERSATION_SCHEMA = Object.freeze({
    type:'object', additionalProperties:false,
    properties:{
        assistantMessage:{ type:'string' },
        assistantTranslation:{ type:'string' },
        correction:{
            type:'object', additionalProperties:false,
            properties:{
                original:{ type:'string' },
                corrected:{ type:'string' },
                explanation:{ type:'string' }
            },
            required:['original', 'corrected', 'explanation']
        },
        usefulPhrases:{
            type:'array', maxItems:5,
            items:{
                type:'object', additionalProperties:false,
                properties:{
                    phrase:{ type:'string' },
                    translation:{ type:'string' },
                    note:{ type:'string' }
                },
                required:['phrase', 'translation', 'note']
            }
        },
        missionProgress:{ type:'number', minimum:0, maximum:100 },
        completed:{ type:'boolean' },
        completionFeedback:{ type:'string' }
    },
    required:[
        'assistantMessage', 'assistantTranslation', 'correction', 'usefulPhrases',
        'missionProgress', 'completed', 'completionFeedback'
    ]
});

const STORY_SCHEMA = Object.freeze({
    type:'object', additionalProperties:false,
    properties:{
        title:{ type:'string' },
        story:{ type:'string' },
        translation:{ type:'string' },
        narrationLanguage:{ type:'string' },
        vocabulary:{
            type:'array', maxItems:12,
            items:{
                type:'object', additionalProperties:false,
                properties:{
                    word:{ type:'string' },
                    usedForm:{ type:'string' },
                    translation:{ type:'string' }
                },
                required:['word', 'usedForm', 'translation']
            }
        },
        questions:{
            type:'array', minItems:3, maxItems:5,
            items:{
                type:'object', additionalProperties:false,
                properties:{
                    question:{ type:'string' },
                    choices:{ type:'array', minItems:4, maxItems:4, items:{ type:'string' } },
                    correctIndex:{ type:'integer', minimum:0, maximum:3 },
                    explanation:{ type:'string' }
                },
                required:['question', 'choices', 'correctIndex', 'explanation']
            }
        }
    },
    required:['title', 'story', 'translation', 'narrationLanguage', 'vocabulary', 'questions']
});

const WRITING_SCHEMA = Object.freeze({
    type:'object', additionalProperties:false,
    properties:{
        detectedLanguage:{ type:'string' },
        corrected:{ type:'string' },
        alternatives:{
            type:'object', additionalProperties:false,
            properties:{
                natural:{ type:'string' },
                formal:{ type:'string' },
                neutral:{ type:'string' },
                informal:{ type:'string' }
            },
            required:['natural', 'formal', 'neutral', 'informal']
        },
        changes:{
            type:'array', maxItems:20,
            items:{
                type:'object', additionalProperties:false,
                properties:{
                    original:{ type:'string' },
                    replacement:{ type:'string' },
                    explanation:{ type:'string' }
                },
                required:['original', 'replacement', 'explanation']
            }
        },
        overallExplanation:{ type:'string' }
    },
    required:['detectedLanguage', 'corrected', 'alternatives', 'changes', 'overallExplanation']
});

export const LEARNING_SCHEMAS = Object.freeze({
    context_lens:CONTEXT_LENS_SCHEMA,
    shadowing:SHADOWING_SCHEMA,
    conversation:CONVERSATION_SCHEMA,
    story:STORY_SCHEMA,
    writing_coach:WRITING_SCHEMA
});

const cleanText = (value, maximum = 4_000) => String(value ?? '')
    .normalize('NFKC').trim().replace(/\s+/gu, ' ').slice(0, maximum);

const cleanCode = value => {
    const code = String(value || '').trim().toUpperCase();
    return LANGUAGES[code] ? code : '';
};

const language = value => {
    const code = cleanCode(value);
    if (!code) throw Object.assign(new Error('A supported language is required.'), { status:400 });
    return { code, name:LANGUAGES[code] };
};

const cleanHistory = value => (Array.isArray(value) ? value : []).slice(-12).map(item => ({
    role:item?.role === 'assistant' ? 'assistant' : 'user',
    text:cleanText(item?.text, 1_000)
})).filter(item => item.text);

const cleanVocabulary = value => (Array.isArray(value) ? value : []).slice(0, 12).map(item => ({
    word:cleanText(item?.word || item?.query, 120),
    translation:cleanText(item?.translation || item?.mainTranslation, 160),
    fromLang:cleanCode(item?.fromLang),
    toLang:cleanCode(item?.toLang)
})).filter(item => item.word);

export function parseInlineMedia(value, allowedPrefixes) {
    const match = String(value || '').match(/^data:([^,]+),([\s\S]*)$/i);
    const metadata = match?.[1]?.split(';').map(item => item.trim()).filter(Boolean) || [];
    const rawMimeType = String(metadata.shift() || '').toLowerCase();
    const isBase64 = metadata.some(item => item.toLowerCase() === 'base64');
    const supported = allowedPrefixes.some(prefix => rawMimeType.startsWith(prefix));
    if (!match || !rawMimeType || !isBase64 || !supported) {
        throw Object.assign(new Error('The uploaded media format is not supported.'), { status:400 });
    }
    const data = match[2].replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(data)) {
        throw Object.assign(new Error('The uploaded media format is not supported.'), { status:400 });
    }
    const size = Math.floor(data.length * 0.75);
    if (!data || size > 8_000_000) {
        throw Object.assign(new Error('The uploaded media must be smaller than 8 MB.'), { status:413 });
    }
    const mimeAliases = {
        'audio/x-m4a':'audio/mp4',
        'audio/mp4a-latm':'audio/mp4',
        'audio/x-wav':'audio/wav',
        'audio/wave':'audio/wav'
    };
    return { mimeType:mimeAliases[rawMimeType] || rawMimeType, data };
}

function request(system, userText, schema, { parts = [], maxOutputTokens = 4_096 } = {}) {
    return {
        contents:[{ role:'user', parts:[{ text:userText }, ...parts] }],
        systemInstruction:{ parts:[{ text:system }] },
        generationConfig:{
            responseMimeType:'application/json',
            responseJsonSchema:schema,
            maxOutputTokens
        }
    };
}

export function buildLearningRequest(feature, input = {}) {
    if (!LEARNING_FEATURES.includes(feature)) {
        throw Object.assign(new Error('Unknown learning feature.'), { status:400 });
    }

    if (feature === 'context_lens') {
        const source = language(input.sourceLang);
        const target = language(input.targetLang);
        const selectedText = cleanText(input.selectedText, 160);
        const contextText = cleanText(input.contextText, 8_000);
        let imagePart = [];
        if (input.imageData) {
            const media = parseInlineMedia(input.imageData, ['image/']);
            imagePart = [{ inlineData:media }];
        }
        if (!contextText && !imagePart.length) {
            throw Object.assign(new Error('Paste text or choose an image first.'), { status:400 });
        }
        const system = `You are Qelumi Context Lens. Read the complete real-world context before interpreting the selected word or expression. Identify the exact sense used, not every dictionary sense. Write sourceExplanation and contextClues in ${source.name}; write contextualTranslation and targetExplanation in ${target.name}. Extract visible text faithfully when an image is supplied. Use a CEFR value A1, A2, B1, B2, C1, C2 or Unclassified and a frequency band Very common, Common, Less common, Rare or Specialized. Never invent unreadable image text. Return strict JSON only.`;
        return request(system,
            `Source language: ${source.name} (${source.code})\nTarget language: ${target.name} (${target.code})\nSelected text: ${selectedText || 'Infer the most educational word or expression'}\nContext:\n${contextText || '[Read the attached image]'}`,
            CONTEXT_LENS_SCHEMA, { parts:imagePart, maxOutputTokens:3_200 });
    }

    if (feature === 'shadowing') {
        const source = language(input.language);
        const expectedText = cleanText(input.expectedText, 800);
        if (!expectedText || !input.audioData) {
            throw Object.assign(new Error('A reference sentence and a voice recording are required.'), { status:400 });
        }
        const media = parseInlineMedia(input.audioData, ['audio/', 'video/webm']);
        const system = `You are Qelumi Shadowing Studio, a careful pronunciation coach for ${source.name}. Listen to the recording and compare it only with the reference sentence. Score sound accuracy, fluency, word stress, rhythm and intonation from 0 to 100. Transcribe what is actually audible. Give specific word-level feedback without penalising an intelligible regional accent merely for being regional. If audio quality prevents reliable assessment, lower confidence through the scores and explain that in summary. Return feedback in ${source.name} and strict JSON only.`;
        return request(system, `Reference sentence: ${expectedText}`, SHADOWING_SCHEMA, {
            parts:[{ inlineData:media }], maxOutputTokens:3_000
        });
    }

    if (feature === 'conversation') {
        const practice = language(input.practiceLang);
        const support = language(input.supportLang);
        const level = ['A1','A2','B1','B2','C1','C2'].includes(String(input.level || '').toUpperCase())
            ? String(input.level).toUpperCase() : 'B1';
        const scenario = cleanText(input.scenario, 300) || 'Everyday conversation';
        const userMessage = cleanText(input.userMessage, 1_000);
        const history = cleanHistory(input.history);
        if (!userMessage && history.length) {
            throw Object.assign(new Error('Say or type a response to continue.'), { status:400 });
        }
        const system = `You are Qelumi Conversation Missions. Role-play "${scenario}" naturally in ${practice.name} at CEFR ${level}. Stay in character, keep each response concise, and advance toward a clear practical goal. assistantMessage must be in ${practice.name}; assistantTranslation, correction explanations and phrase notes must be in ${support.name}. Correct only meaningful errors and keep correction fields empty when the user's message is already suitable. Mark completed after 6 to 10 useful turns or once the mission goal is achieved. Return strict JSON only.`;
        return request(system,
            `Conversation so far:\n${history.map(item => `${item.role}: ${item.text}`).join('\n') || '[Start the mission]'}\nCurrent learner response: ${userMessage || '[Begin]'}\nMission: ${scenario}`,
            CONVERSATION_SCHEMA, { maxOutputTokens:2_500 });
    }

    if (feature === 'story') {
        const practice = language(input.practiceLang);
        const support = language(input.supportLang);
        const level = ['A1','A2','B1','B2','C1','C2'].includes(String(input.level || '').toUpperCase())
            ? String(input.level).toUpperCase() : 'B1';
        const vocabulary = cleanVocabulary(input.vocabulary);
        if (vocabulary.length < 3) {
            throw Object.assign(new Error('At least three study words are required for a personalised story.'), { status:400 });
        }
        const system = `You are Qelumi Story Lab. Write one coherent, memorable mini-story in ${practice.name} at CEFR ${level}, naturally using every supplied vocabulary item or an appropriate inflected form. Provide a faithful ${support.name} translation. Then create 3 to 5 comprehension questions in ${practice.name}, each with exactly four plausible ${practice.name} choices and one correct index. Avoid childish content unless the level or topic requires it. Return strict JSON only.`;
        return request(system,
            `Practice language: ${practice.name}\nSupport language: ${support.name}\nVocabulary:\n${vocabulary.map(item => `- ${item.word}${item.translation ? ` = ${item.translation}` : ''}`).join('\n')}`,
            STORY_SCHEMA, { maxOutputTokens:5_000 });
    }

    const writing = language(input.language);
    const text = cleanText(input.text, 8_000);
    if (!text) throw Object.assign(new Error('Enter a sentence or paragraph to review.'), { status:400 });
    const system = `You are Qelumi Writing & Tone Coach for ${writing.name}. Correct grammar, spelling, punctuation and unnatural phrasing while preserving meaning. Supply natural, formal, neutral and informal versions; where a register would be inappropriate, still provide the closest safe equivalent and explain it. Each change must teach a concrete rule or usage point. Write all explanations in ${writing.name}. Return strict JSON only.`;
    return request(system, `Text to review:\n${text}`, WRITING_SCHEMA, { maxOutputTokens:4_500 });
}

export function correctionDocumentId(uid, query, fromLang, toLang, section, createdAt = Date.now()) {
    return crypto.createHash('sha256')
        .update(`${uid}|${cleanCode(fromLang)}|${cleanCode(toLang)}|${cleanText(query, 300).toLocaleLowerCase()}|${cleanText(section, 80)}|${createdAt}`)
        .digest('hex');
}

export function sanitizeCorrectionValue(value, maximum = 20_000) {
    if (value == null) return null;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length > maximum) {
            throw Object.assign(new Error('The proposed correction is too large.'), { status:413 });
        }
        return trimmed;
    }
    const serialised = JSON.stringify(value);
    if (serialised.length > maximum) {
        throw Object.assign(new Error('The proposed correction is too large.'), { status:413 });
    }
    return JSON.parse(serialised);
}

export function percentile(values, requestedPercentile) {
    const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    if (!sorted.length) return 0;
    const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(requestedPercentile * sorted.length) - 1));
    return sorted[index];
}

export function summarizePerformanceEvents(events = []) {
    const usable = events.map(event => ({
        operation:String(event?.operation || 'unknown'),
        model:String(event?.metadata?.model || 'cache'),
        fromLang:cleanCode(event?.metadata?.fromLang),
        toLang:cleanCode(event?.metadata?.toLang),
        latencyMs:Math.max(0, Number(event?.metadata?.latencyMs || event?.metadata?.cacheLookupMs || 0)),
        tokens:Math.max(0, Number(event?.metadata?.totalTokens || 0)),
        cost:Math.max(0, Number(event?.metadata?.estimatedCostUsd || 0)),
        cacheHit:event?.operation === 'translation_cache_hit',
        fallback:String(event?.operation || '').includes('fallback')
    })).filter(event => event.latencyMs > 0 || event.cacheHit);
    const latencies = usable.map(event => event.latencyMs);
    const aggregate = list => {
        const groupLatencies = list.map(event => event.latencyMs);
        return {
            calls:list.length,
            p50LatencyMs:Math.round(percentile(groupLatencies, 0.5)),
            p95LatencyMs:Math.round(percentile(groupLatencies, 0.95)),
            averageLatencyMs:list.length ? Math.round(groupLatencies.reduce((sum, value) => sum + value, 0) / list.length) : 0,
            tokens:list.reduce((sum, event) => sum + event.tokens, 0),
            estimatedCostUsd:Number(list.reduce((sum, event) => sum + event.cost, 0).toFixed(6))
        };
    };
    const groupBy = key => [...usable.reduce((groups, event) => {
        const label = key(event);
        if (!groups.has(label)) groups.set(label, []);
        groups.get(label).push(event);
        return groups;
    }, new Map())].map(([name, list]) => ({ name, ...aggregate(list) }))
        .sort((first, second) => second.p95LatencyMs - first.p95LatencyMs);
    return {
        ...aggregate(usable),
        cacheHits:usable.filter(event => event.cacheHit).length,
        cacheHitRate:usable.length ? Number((usable.filter(event => event.cacheHit).length / usable.length).toFixed(4)) : 0,
        fallbacks:usable.filter(event => event.fallback).length,
        fallbackRate:usable.length ? Number((usable.filter(event => event.fallback).length / usable.length).toFixed(4)) : 0,
        byOperation:groupBy(event => event.operation),
        byModel:groupBy(event => event.model),
        byLanguagePair:groupBy(event => event.fromLang && event.toLang ? `${event.fromLang}→${event.toLang}` : 'Unspecified')
    };
}
