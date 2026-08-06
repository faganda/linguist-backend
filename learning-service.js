import { LANGUAGES } from './translation-service.js';

export const LEARNING_FEATURES = Object.freeze([
    'context_lens', 'shadowing', 'conversation', 'story', 'writing_coach',
    'focused_practice'
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

const fiveItems = item => ({
    type:'array', minItems:5, maxItems:5, items:item
});

const oneToSixteenItems = item => ({
    type:'array', minItems:1, maxItems:16, items:item
});

const sentencePracticeItem = Object.freeze({
    type:'object', additionalProperties:false,
    properties:{
        sourceSentence:{ type:'string' },
        targetSentence:{ type:'string' }
    },
    required:['sourceSentence', 'targetSentence']
});

const FOCUSED_PRACTICE_SCHEMA = Object.freeze({
    type:'object', additionalProperties:false,
    properties:{
        sentenceBuilder:fiveItems(sentencePracticeItem),
        translationRace:fiveItems({
            type:'object', additionalProperties:false,
            properties:{
                sourceSentence:{ type:'string' }, targetSentence:{ type:'string' },
                acceptedAnswers:textArray(5)
            },
            required:['sourceSentence', 'targetSentence', 'acceptedAnswers']
        }),
        contextDetective:fiveItems({
            type:'object', additionalProperties:false,
            properties:{
                sourceSentence:{ type:'string' }, targetSentence:{ type:'string' },
                meaningLabel:{ type:'string' }, sourceDefinition:{ type:'string' },
                targetDefinition:{ type:'string' }, choices:textArray(4)
            },
            required:['sourceSentence', 'targetSentence', 'meaningLabel', 'sourceDefinition', 'targetDefinition', 'choices']
        }),
        wordFamilies:fiveItems({
            type:'object', additionalProperties:false,
            properties:{
                word:{ type:'string' }, translation:{ type:'string' },
                partOfSpeech:{ type:'string' }, clue:{ type:'string' },
                choices:textArray(4)
            },
            required:['word', 'translation', 'partOfSpeech', 'clue', 'choices']
        }),
        clozeQuiz:fiveItems({
            type:'object', additionalProperties:false,
            properties:{
                sourceSentence:{ type:'string' }, targetSentence:{ type:'string' },
                clozeSentence:{ type:'string' }, answer:{ type:'string' }
            },
            required:['sourceSentence', 'targetSentence', 'clozeSentence', 'answer']
        }),
        listeningChallenge:fiveItems({
            type:'object', additionalProperties:false,
            properties:{
                sourceSentence:{ type:'string' }, targetSentence:{ type:'string' },
                acceptedAnswers:textArray(5),
                choices:{ type:'array', minItems:4, maxItems:4, items:{ type:'string' } }
            },
            required:['sourceSentence', 'targetSentence', 'acceptedAnswers', 'choices']
        }),
        pronunciationCoach:oneToSixteenItems({
            type:'object', additionalProperties:false,
            properties:{
                text:{ type:'string' }, translation:{ type:'string' },
                partOfSpeech:{ type:'string' }, formLabel:{ type:'string' }
            },
            required:['text', 'translation', 'partOfSpeech', 'formLabel']
        }),
        shadowingStudio:fiveItems(sentencePracticeItem)
    },
    required:[
        'sentenceBuilder', 'translationRace', 'contextDetective', 'wordFamilies',
        'clozeQuiz', 'listeningChallenge', 'pronunciationCoach', 'shadowingStudio'
    ]
});

export const LEARNING_SCHEMAS = Object.freeze({
    context_lens:CONTEXT_LENS_SCHEMA,
    shadowing:SHADOWING_SCHEMA,
    conversation:CONVERSATION_SCHEMA,
    story:STORY_SCHEMA,
    writing_coach:WRITING_SCHEMA,
    focused_practice:FOCUSED_PRACTICE_SCHEMA
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

const cleanFocusedMeanings = value => (Array.isArray(value) ? value : []).slice(0, 12).map(item => ({
    label:cleanText(item?.label, 160),
    partOfSpeech:cleanText(item?.partOfSpeech, 80),
    register:cleanText(item?.register, 40),
    sourceDefinition:cleanText(item?.sourceDefinition, 500),
    targetDefinition:cleanText(item?.targetDefinition, 500),
    translations:(Array.isArray(item?.translations) ? item.translations : [])
        .slice(0, 12).map(entry => cleanText(entry, 160)).filter(Boolean)
})).filter(item => item.label || item.sourceDefinition);

const cleanFocusedFamily = value => (Array.isArray(value) ? value : []).slice(0, 20).map(item => ({
    word:cleanText(item?.word, 120),
    translation:cleanText(item?.translation, 160),
    partOfSpeech:cleanText(item?.partOfSpeech, 80)
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

    if (feature === 'focused_practice') {
        const source = language(input.sourceLang);
        const target = language(input.targetLang);
        const query = cleanText(input.query, 180);
        const translations = (Array.isArray(input.translations) ? input.translations : [])
            .slice(0, 20).map(item => cleanText(item, 180)).filter(Boolean);
        const meanings = cleanFocusedMeanings(input.meanings);
        const wordFamily = cleanFocusedFamily(input.wordFamily);
        if (!query || !translations.length || !meanings.length) {
            throw Object.assign(new Error('A complete translated entry is required for focused practice.'), { status:400 });
        }
        const system = `You are Qelumi's focused-practice author. Create eight independent exercises about the exact source entry "${query}". Sentence Builder, Translation Race, Context Detective, Word Families, Cloze Quiz, Listening Challenge and Shadowing Studio must each contain exactly five usable items. Pronunciation Coach is a word-and-form set and may contain 1 to 16 unique items.

All sourceSentence values across all seven sentence-based exercise arrays must be different from one another, not merely punctuation variants. Use natural ${source.name} sentences and faithful ${target.name} translations. Every sentence must illustrate one of the supplied meanings accurately and contain the exact entry, a supplied word-family member, or a genuine natural inflected form. Never borrow a sentence from an unrelated sense, topic or sport merely because it contains a similar word. Keep examples appropriate for general learners.

Exercise contracts:
- sentenceBuilder: five sentences suitable for rearranging word-by-word.
- translationRace: five source sentences, faithful target sentences, and acceptedAnswers containing the full target sentence plus up to four genuinely equivalent answers.
- contextDetective: five sentences, the exact supplied meaning label and definitions they illustrate, and 2-4 plausible meaning-label choices including the correct label.
- wordFamilies: five genuine family words or morphologically related forms. If the supplied family is small, include responsible inflected or derived forms; never invent a word. choices contains 2-4 source-language words including the answer.
- clozeQuiz: five sentences with clozeSentence equal to sourceSentence except that one permitted vocabulary form is replaced once by ___. The answer must be the exact entry, a supplied word-family member, or a genuine principal/inflected form. For an English verb, deliberately cover the gerund/present participle, past simple (preterite) and past participle when those forms exist; use the language's own pedagogically useful principal forms for other languages.
- listeningChallenge: five new sentences for source-language audio and target-language comprehension. acceptedAnswers contains the targetSentence and up to four genuinely equivalent spoken answers. choices contains exactly four plausible ${target.name} sentences, including targetSentence exactly once; wrong choices must be realistic and close enough to require careful listening.
- pronunciationCoach: return the exact entry first, followed by genuine supplied word-family members and useful principal forms. These items contain only the isolated source word or expression in text, never a full sentence. For an English verb include its gerund/present participle, past simple (preterite) and past participle when they exist. For another language choose its own useful principal forms rather than imposing English grammar. Remove duplicates and never invent a form merely to reach five items.
- shadowingStudio: five new, natural source sentences suitable for shadowing.

Do not reuse any source sentence between exercise types. Do not return commentary. Return strict JSON only.`;
        return request(system,
            `Source: ${source.name} (${source.code})\nTarget: ${target.name} (${target.code})\nExact entry: ${query}\nTranslations: ${translations.join(' · ')}\nMeanings:\n${JSON.stringify(meanings)}\nKnown word family:\n${JSON.stringify(wordFamily)}`,
            FOCUSED_PRACTICE_SCHEMA, { maxOutputTokens:12_000 });
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

const focusedPracticeGroups = Object.freeze([
    'sentenceBuilder', 'translationRace', 'contextDetective', 'wordFamilies',
    'clozeQuiz', 'listeningChallenge', 'pronunciationCoach', 'shadowingStudio'
]);

export function focusedPracticeQualityIssues(result) {
    const issues = [];
    if (!result || typeof result !== 'object') return ['empty focused-practice result'];
    for (const group of focusedPracticeGroups.filter(group => group !== 'pronunciationCoach')) {
        if (!Array.isArray(result[group]) || result[group].length !== 5) {
            issues.push(`${group} must contain exactly five items`);
        }
    }
    if (!Array.isArray(result.pronunciationCoach)
        || result.pronunciationCoach.length < 1
        || result.pronunciationCoach.length > 16) {
        issues.push('pronunciationCoach must contain between one and sixteen items');
    }
    const sentenceGroups = focusedPracticeGroups.filter(group =>
        group !== 'wordFamilies' && group !== 'pronunciationCoach'
    );
    const seenSentences = new Map();
    for (const group of sentenceGroups) {
        for (const [index, item] of (result[group] || []).entries()) {
            const sourceSentence = cleanText(item?.sourceSentence, 1_000);
            const targetSentence = cleanText(item?.targetSentence, 1_000);
            if (!sourceSentence || !targetSentence) {
                issues.push(`${group} item ${index + 1} is missing a complete bilingual example`);
                continue;
            }
            const key = sourceSentence.toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
            if (seenSentences.has(key)) {
                issues.push(`${group} item ${index + 1} repeats ${seenSentences.get(key)}`);
            } else {
                seenSentences.set(key, `${group} item ${index + 1}`);
            }
        }
    }
    for (const [index, item] of (result.translationRace || []).entries()) {
        if (!Array.isArray(item?.acceptedAnswers) || !item.acceptedAnswers.some(answer => cleanText(answer))) {
            issues.push(`translationRace item ${index + 1} has no accepted answer`);
        }
    }
    for (const [index, item] of (result.contextDetective || []).entries()) {
        if (!cleanText(item?.meaningLabel) || !cleanText(item?.sourceDefinition)
            || !Array.isArray(item?.choices)
            || !item.choices.some(choice => cleanText(choice).toLocaleLowerCase('en') === cleanText(item.meaningLabel).toLocaleLowerCase('en'))) {
            issues.push(`contextDetective item ${index + 1} has an invalid meaning choice`);
        }
    }
    for (const [index, item] of (result.wordFamilies || []).entries()) {
        if (!cleanText(item?.word) || !Array.isArray(item?.choices)
            || !item.choices.some(choice => cleanText(choice).toLocaleLowerCase('en') === cleanText(item.word).toLocaleLowerCase('en'))) {
            issues.push(`wordFamilies item ${index + 1} has an invalid answer choice`);
        }
    }
    for (const [index, item] of (result.clozeQuiz || []).entries()) {
        if (!cleanText(item?.answer) || !String(item?.clozeSentence || '').includes('___')) {
            issues.push(`clozeQuiz item ${index + 1} has an invalid blank`);
        }
    }
    for (const [index, item] of (result.listeningChallenge || []).entries()) {
        const target = cleanText(item?.targetSentence);
        const choices = Array.isArray(item?.choices) ? item.choices.map(choice => cleanText(choice)).filter(Boolean) : [];
        const accepted = Array.isArray(item?.acceptedAnswers) ? item.acceptedAnswers.map(answer => cleanText(answer)).filter(Boolean) : [];
        if (choices.length !== 4
            || new Set(choices.map(choice => choice.toLocaleLowerCase('en'))).size !== 4
            || !choices.some(choice => choice.toLocaleLowerCase('en') === target.toLocaleLowerCase('en'))
            || !accepted.some(answer => answer.toLocaleLowerCase('en') === target.toLocaleLowerCase('en'))) {
            issues.push(`listeningChallenge item ${index + 1} has invalid answer choices`);
        }
    }
    const pronunciationKeys = new Set();
    for (const [index, item] of (result.pronunciationCoach || []).entries()) {
        const text = cleanText(item?.text, 180);
        const key = text.toLocaleLowerCase('en');
        if (!text || !cleanText(item?.formLabel, 120)) {
            issues.push(`pronunciationCoach item ${index + 1} is missing a word or form label`);
        } else if (pronunciationKeys.has(key)) {
            issues.push(`pronunciationCoach item ${index + 1} repeats an earlier pronunciation item`);
        }
        pronunciationKeys.add(key);
    }
    return [...new Set(issues)];
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
