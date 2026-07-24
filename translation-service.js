import crypto from 'node:crypto';

export const LANGUAGES = Object.freeze({
    EN:'English', FR:'French', ES:'Spanish', DE:'German', IT:'Italian', PT:'Portuguese',
    ZH:'Chinese', JA:'Japanese', KO:'Korean', RU:'Russian', AR:'Arabic', SW:'Swahili'
});

export const REGISTER_VALUES = Object.freeze([
    'Formal', 'Informal', 'Neutral', 'Slang', 'Colloquial', 'Literary', 'Technical', 'Vulgar'
]);

export const USAGE_LEVELS = Object.freeze([
    'standard', 'common', 'specialized', 'rare', 'archaic', 'abbreviation',
    'fragment', 'proper-name', 'offensive-clipping', 'invalid'
]);

export const CEFR_LEVELS = Object.freeze(['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'Unclassified']);
export const FREQUENCY_BANDS = Object.freeze(['Very common', 'Common', 'Less common', 'Rare', 'Specialized']);
export const MODALITY_VALUES = Object.freeze(['Spoken', 'Written', 'Both']);

export const DICTIONARY_SCHEMA_VERSION = 14;
export const PREVIEW_SCHEMA_VERSION = 2;
export const PRIMARY_MODEL = process.env.GEMINI_PRIMARY_MODEL || 'gemini-3.1-flash-lite';
export const PRIMARY_THINKING = process.env.GEMINI_PRIMARY_THINKING || 'minimal';
export const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.5-flash';
export const FALLBACK_THINKING = process.env.GEMINI_FALLBACK_THINKING || 'low';

const ORDINARY_USAGE = new Set(['standard', 'common', 'specialized']);
const NON_QUALIFYING_USAGE = new Set(['rare', 'archaic', 'abbreviation', 'fragment', 'proper-name', 'offensive-clipping', 'invalid']);

// These machine-readable keys are never displayed. They let the backend verify
// that a model covered the source language's own verb system instead of merely
// returning two or three familiar tenses. Related keys may share one displayed
// group when that is natural for the language.
export const CONJUGATION_COVERAGE = Object.freeze({
    EN:Object.freeze([
        'present_simple', 'past_simple', 'future_simple',
        'present_continuous', 'past_continuous', 'future_continuous',
        'present_perfect', 'past_perfect', 'future_perfect',
        'present_perfect_continuous', 'past_perfect_continuous', 'future_perfect_continuous',
        'conditional_present', 'conditional_perfect', 'imperative', 'subjunctive', 'non_finite_forms'
    ]),
    FR:Object.freeze([
        'indicatif_present', 'indicatif_imparfait', 'indicatif_passe_compose',
        'indicatif_plus_que_parfait', 'indicatif_passe_simple', 'indicatif_passe_anterieur',
        'indicatif_futur_simple', 'indicatif_futur_anterieur',
        'subjonctif_present', 'subjonctif_passe', 'subjonctif_imparfait', 'subjonctif_plus_que_parfait',
        'conditionnel_present', 'conditionnel_passe',
        'imperatif_present', 'imperatif_passe',
        'infinitif_present', 'infinitif_passe',
        'participe_present', 'participe_passe', 'gerondif_present', 'gerondif_passe'
    ]),
    ES:Object.freeze([
        'indicativo_presente', 'indicativo_imperfecto', 'indicativo_preterito',
        'indicativo_futuro', 'indicativo_perfecto', 'indicativo_pluscuamperfecto',
        'indicativo_preterito_anterior', 'indicativo_futuro_perfecto',
        'condicional_simple', 'condicional_compuesto',
        'subjuntivo_presente', 'subjuntivo_imperfecto', 'subjuntivo_futuro',
        'subjuntivo_perfecto', 'subjuntivo_pluscuamperfecto', 'subjuntivo_futuro_perfecto',
        'imperativo_afirmativo', 'imperativo_negativo',
        'infinitivo_simple', 'infinitivo_compuesto', 'gerundio_simple', 'gerundio_compuesto', 'participio'
    ]),
    DE:Object.freeze([
        'indikativ_praesens', 'indikativ_praeteritum', 'indikativ_perfekt',
        'indikativ_plusquamperfekt', 'indikativ_futur_i', 'indikativ_futur_ii',
        'konjunktiv_i_praesens', 'konjunktiv_i_perfekt', 'konjunktiv_i_futur_i', 'konjunktiv_i_futur_ii',
        'konjunktiv_ii_praeteritum', 'konjunktiv_ii_plusquamperfekt',
        'imperativ', 'infinitiv_i', 'infinitiv_ii', 'partizip_i', 'partizip_ii'
    ]),
    IT:Object.freeze([
        'indicativo_presente', 'indicativo_imperfetto', 'indicativo_passato_prossimo',
        'indicativo_passato_remoto', 'indicativo_trapassato_prossimo', 'indicativo_trapassato_remoto',
        'indicativo_futuro_semplice', 'indicativo_futuro_anteriore',
        'congiuntivo_presente', 'congiuntivo_imperfetto', 'congiuntivo_passato', 'congiuntivo_trapassato',
        'condizionale_presente', 'condizionale_passato',
        'imperativo', 'infinito_presente', 'infinito_passato',
        'participio_presente', 'participio_passato', 'gerundio_presente', 'gerundio_passato'
    ]),
    PT:Object.freeze([
        'indicativo_presente', 'indicativo_preterito_perfeito', 'indicativo_preterito_imperfeito',
        'indicativo_mais_que_perfeito', 'indicativo_futuro', 'indicativo_condicional',
        'indicativo_preterito_perfeito_composto', 'indicativo_mais_que_perfeito_composto',
        'indicativo_futuro_composto', 'indicativo_condicional_composto',
        'subjuntivo_presente', 'subjuntivo_imperfeito', 'subjuntivo_futuro',
        'subjuntivo_perfeito', 'subjuntivo_mais_que_perfeito', 'subjuntivo_futuro_composto',
        'imperativo_afirmativo', 'imperativo_negativo',
        'infinitivo_impessoal', 'infinitivo_impessoal_composto',
        'infinitivo_pessoal', 'infinitivo_pessoal_composto',
        'gerundio', 'gerundio_composto', 'participio'
    ]),
    ZH:Object.freeze([
        'invariant_base', 'perfective_le', 'experiential_guo', 'progressive_zai',
        'durative_zhe', 'negative_bu', 'negative_mei', 'modal_future_possibility'
    ]),
    JA:Object.freeze([
        'plain_nonpast_affirmative', 'plain_nonpast_negative', 'plain_past_affirmative', 'plain_past_negative',
        'polite_nonpast_affirmative', 'polite_nonpast_negative', 'polite_past_affirmative', 'polite_past_negative',
        'te_form', 'progressive', 'potential', 'passive', 'causative', 'causative_passive',
        'volitional', 'imperative', 'conditional', 'desiderative', 'stem_and_non_finite'
    ]),
    KO:Object.freeze([
        'dictionary_form_and_stem', 'informal_polite_present', 'informal_polite_past', 'informal_polite_future',
        'formal_present', 'formal_past', 'formal_future', 'negative_forms',
        'imperative', 'propositive', 'conditional', 'connective_and_non_finite', 'honorific'
    ]),
    RU:Object.freeze([
        'present', 'past', 'future_simple', 'future_compound', 'imperative', 'conditional_subjunctive',
        'infinitive', 'aspect_pair', 'active_present_participle', 'active_past_participle',
        'passive_present_participle', 'passive_past_participle',
        'present_adverbial_participle', 'past_adverbial_participle'
    ]),
    AR:Object.freeze([
        'perfect_active', 'imperfect_indicative_active', 'imperfect_subjunctive_active',
        'imperfect_jussive_active', 'imperative', 'prohibitive',
        'perfect_passive', 'imperfect_passive', 'active_participle', 'passive_participle',
        'verbal_noun', 'person_gender_number_paradigm'
    ]),
    SW:Object.freeze([
        'infinitive', 'present_na', 'habitual_hu', 'situational_ki', 'past_li', 'perfect_me',
        'narrative_ka', 'future_ta', 'conditional_nge', 'counterfactual_ngali',
        'subjunctive', 'imperative', 'negative_present', 'negative_past',
        'negative_future', 'negative_perfect', 'negative_subjunctive', 'relative_forms'
    ])
});

const textArray = (maxItems = 8) => ({ type:'array', items:{ type:'string' }, maxItems });
const bilingualLists = (maxItems = 8) => ({
    type:'object', additionalProperties:false,
    properties:{ sourceLang:textArray(maxItems), targetLang:textArray(maxItems) },
    required:['sourceLang', 'targetLang']
});

export const CORE_RESPONSE_SCHEMA = Object.freeze({
    type:'object', additionalProperties:false,
    properties:{
        detectedSourceLang:{ type:'string' },
        sourceLanguageValidation:{
            type:'object', additionalProperties:false,
            properties:{
                requestedLanguage:{ type:'string' },
                existsInRequestedLanguage:{ type:'boolean' },
                validLanguages:textArray(12),
                mostLikelyLanguage:{ type:'string' },
                mostLikelyAlternativeLanguage:{ type:'string' },
                requestedUsageLevel:{ type:'string', enum:USAGE_LEVELS },
                mostLikelyUsageLevel:{ type:'string', enum:USAGE_LEVELS },
                ambiguous:{ type:'boolean' },
                mixedLanguage:{ type:'boolean' },
                confidence:{ type:'number', minimum:0, maximum:1 },
                decisionReason:{ type:'string' },
                borrowingNote:{ type:'string' }
            },
            required:[
                'requestedLanguage', 'existsInRequestedLanguage', 'validLanguages', 'mostLikelyLanguage',
                'mostLikelyAlternativeLanguage', 'requestedUsageLevel', 'mostLikelyUsageLevel',
                'ambiguous', 'mixedLanguage', 'confidence', 'decisionReason', 'borrowingNote'
            ]
        },
        wordExists:{ type:'boolean' },
        suggestedCorrection:{ type:'string' },
        extractedText:{ type:'string' },
        partOfSpeech:{ type:'string' },
        formality:{ type:'string', enum:REGISTER_VALUES },
        learningMetadata:{
            type:'object', additionalProperties:false,
            properties:{
                cefrLevel:{ type:'string', enum:CEFR_LEVELS },
                frequencyBand:{ type:'string', enum:FREQUENCY_BANDS },
                modality:{ type:'string', enum:MODALITY_VALUES },
                sourceNote:{ type:'string' },
                targetNote:{ type:'string' }
            },
            required:['cefrLevel', 'frequencyBand', 'modality', 'sourceNote', 'targetNote']
        },
        mainTranslation:textArray(8),
        pronunciationGuide:{ type:'string' },
        etymology:{
            type:'object', additionalProperties:false,
            properties:{ sourceLang:{ type:'string' }, targetLang:{ type:'string' } },
            required:['sourceLang', 'targetLang']
        },
        isVerb:{ type:'boolean' },
        conjugationGroups:{
            type:'array', maxItems:32,
            items:{
                type:'object', additionalProperties:false,
                properties:{
                    label:{ type:'string' }, forms:textArray(32), note:{ type:'string' },
                    coverageKeys:textArray(8)
                },
                required:['label', 'forms', 'note', 'coverageKeys']
            }
        },
        definitions:bilingualLists(6),
        synonyms:bilingualLists(10),
        similarPhrases:bilingualLists(10),
        meanings:{
            type:'array', maxItems:8,
            items:{
                type:'object', additionalProperties:false,
                properties:{
                    label:{ type:'string' }, partOfSpeech:{ type:'string' },
                    register:{ type:'string', enum:REGISTER_VALUES },
                    sourceDefinition:{ type:'string' }, targetDefinition:{ type:'string' }, translations:textArray(8)
                },
                required:['label', 'partOfSpeech', 'register', 'sourceDefinition', 'targetDefinition', 'translations']
            }
        },
        collocations:bilingualLists(12),
        usageWarnings:bilingualLists(8),
        grammarNotes:bilingualLists(8),
        regionalVariants:{
            type:'array', maxItems:8,
            items:{
                type:'object', additionalProperties:false,
                properties:{ region:{ type:'string' }, variant:{ type:'string' }, note:{ type:'string' } },
                required:['region', 'variant', 'note']
            }
        },
        wordFamily:{
            type:'array', maxItems:10,
            items:{
                type:'object', additionalProperties:false,
                properties:{ word:{ type:'string' }, partOfSpeech:{ type:'string' }, translation:{ type:'string' } },
                required:['word', 'partOfSpeech', 'translation']
            }
        },
        minimalPairs:{
            type:'array', maxItems:8,
            items:{
                type:'object', additionalProperties:false,
                properties:{ word:{ type:'string' }, contrast:{ type:'string' }, translation:{ type:'string' } },
                required:['word', 'contrast', 'translation']
            }
        },
        contexts:{
            type:'array', maxItems:8,
            items:{
                type:'object', additionalProperties:false,
                properties:{ contextName:{ type:'string' }, meaningIndex:{ type:'integer', minimum:0 }, examples:{ type:'array', maxItems:0 } },
                required:['contextName', 'meaningIndex', 'examples']
            }
        }
    },
    required:[
        'detectedSourceLang', 'sourceLanguageValidation', 'wordExists', 'suggestedCorrection', 'extractedText',
        'partOfSpeech', 'formality', 'learningMetadata', 'mainTranslation', 'pronunciationGuide', 'etymology', 'isVerb',
        'conjugationGroups', 'definitions', 'synonyms', 'similarPhrases', 'meanings', 'collocations',
        'usageWarnings', 'grammarNotes', 'regionalVariants', 'wordFamily', 'minimalPairs', 'contexts'
    ]
});

export const VALIDATION_RESPONSE_SCHEMA = Object.freeze({
    type:'object', additionalProperties:false,
    properties:CORE_RESPONSE_SCHEMA.properties.sourceLanguageValidation.properties,
    required:CORE_RESPONSE_SCHEMA.properties.sourceLanguageValidation.required
});

// This deliberately small contract gives the interface a useful first paint
// while the complete dictionary record is generated independently.
export const PREVIEW_RESPONSE_SCHEMA = Object.freeze({
    type:'object', additionalProperties:false,
    properties:{
        detectedSourceLang:{ type:'string' },
        sourceLanguageValidation:{
            type:'object', additionalProperties:false,
            properties:CORE_RESPONSE_SCHEMA.properties.sourceLanguageValidation.properties,
            required:CORE_RESPONSE_SCHEMA.properties.sourceLanguageValidation.required
        },
        wordExists:{ type:'boolean' },
        suggestedCorrection:{ type:'string' },
        partOfSpeech:{ type:'string' },
        formality:{ type:'string', enum:REGISTER_VALUES },
        mainTranslation:textArray(4),
        pronunciationGuide:{ type:'string' },
        previewMeaning:{
            type:'object', additionalProperties:false,
            properties:{
                partOfSpeech:{ type:'string' },
                register:{ type:'string', enum:REGISTER_VALUES },
                sourceDefinition:{ type:'string' },
                targetDefinition:{ type:'string' }
            },
            required:['partOfSpeech', 'register', 'sourceDefinition', 'targetDefinition']
        }
    },
    required:[
        'detectedSourceLang', 'sourceLanguageValidation', 'wordExists', 'suggestedCorrection',
        'partOfSpeech', 'formality', 'mainTranslation', 'pronunciationGuide', 'previewMeaning'
    ]
});

export const EXAMPLES_RESPONSE_SCHEMA = Object.freeze({
    type:'object', additionalProperties:false,
    properties:{
        examples:{
            type:'array', maxItems:10,
            items:{
                type:'object', additionalProperties:false,
                properties:{
                    original:{ type:'string' }, translated:{ type:'string' }, sourceSnippet:{ type:'string' },
                    targetTranslatedSnippet:{ type:'string' }, blankedTranslation:{ type:'string' },
                    explanation:{ type:'string' }, complete:{ type:'boolean' }
                },
                required:['original', 'translated', 'sourceSnippet', 'targetTranslatedSnippet', 'blankedTranslation', 'explanation', 'complete']
            }
        }
    },
    required:['examples']
});

export const DISTRACTOR_RESPONSE_SCHEMA = Object.freeze({
    type:'object', additionalProperties:false,
    properties:{ distractors:textArray(4) }, required:['distractors']
});

const hasText = value => typeof value === 'string' && value.trim().length > 0;
const cleanText = value => typeof value === 'string' ? value.trim() : '';
const cleanTextArray = (value, limit = 20) => Array.isArray(value)
    ? [...new Set(value.map(cleanText).filter(Boolean))].slice(0, limit) : [];
const cleanCode = value => {
    const code = String(value || '').trim().toUpperCase();
    return LANGUAGES[code] ? code : '';
};
const boundedConfidence = value => Math.max(0, Math.min(1, Number.isFinite(Number(value)) ? Number(value) : 0.5));
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

export function normalizeDictionaryQuery(value) {
    return String(value || '').normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en');
}

export function dictionaryIdentity(query, fromLang, toLang) {
    return `${cleanCode(fromLang)}|${cleanCode(toLang)}|${normalizeDictionaryQuery(query)}`;
}

export function dictionaryDocumentId(query, fromLang, toLang) {
    return crypto.createHash('sha256').update(dictionaryIdentity(query, fromLang, toLang)).digest('hex');
}

export function examplesPerContext(contextCount) {
    return contextCount === 1 ? 10 : contextCount <= 4 ? 5 : 3;
}

function normalizeRegister(value, fallback = 'Neutral') {
    return REGISTER_VALUES.find(register => register.toLocaleLowerCase('en') === String(value || '').trim().toLocaleLowerCase('en')) || fallback;
}

function normalizeEnum(value, allowed, fallback) {
    return allowed.find(item => item.toLocaleLowerCase('en') === String(value || '').trim().toLocaleLowerCase('en')) || fallback;
}

function normalizeLearningMetadata(value, definitionsOnly = false) {
    return {
        cefrLevel:normalizeEnum(value?.cefrLevel, CEFR_LEVELS, 'Unclassified'),
        frequencyBand:normalizeEnum(value?.frequencyBand, FREQUENCY_BANDS, 'Less common'),
        modality:normalizeEnum(value?.modality, MODALITY_VALUES, 'Both'),
        sourceNote:cleanText(value?.sourceNote),
        targetNote:definitionsOnly ? '' : cleanText(value?.targetNote)
    };
}

function normalizeMeaningLabel(value, index) {
    const cleaned = cleanText(value).replace(/[_-]+/g, ' ')
        .replace(/^(?:noun|verb|adjective|adverb|pronoun|preposition|conjunction|interjection)\s+/i, '')
        .trim();
    if (!cleaned) return `Meaning ${index + 1}`;
    return cleaned.charAt(0).toLocaleUpperCase() + cleaned.slice(1);
}

function normalizePartOfSpeech(value, query) {
    const cleaned = cleanText(value).replace(/\s*[,/|]\s*/g, ' · ').replace(/\s*·\s*/g, ' · ');
    if (!cleaned || !/\s/u.test(normalizeDictionaryQuery(query))) return cleaned;
    // A multiword lexical entry is a phrase or compound, not a single bare
    // word-class label. This deterministic guard fixes generic classifications
    // such as "escape valve" => "Noun" without guessing a different head class.
    const phraseLabels = {
        noun:'Noun phrase',
        verb:'Verb phrase',
        adjective:'Adjective phrase',
        adverb:'Adverb phrase',
        preposition:'Prepositional phrase',
        interjection:'Interjection phrase'
    };
    return phraseLabels[cleaned.toLocaleLowerCase('en')] || cleaned;
}

function normalizeBilingual(value) {
    return {
        sourceLang:cleanTextArray(value?.sourceLang),
        targetLang:cleanTextArray(value?.targetLang)
    };
}

function normalizedValidation(raw, requestedSource) {
    const requestedLanguage = cleanCode(requestedSource) || cleanCode(raw?.requestedLanguage);
    let validLanguages = [...new Set((Array.isArray(raw?.validLanguages) ? raw.validLanguages : []).map(cleanCode).filter(Boolean))];
    let existsInRequestedLanguage = raw?.existsInRequestedLanguage === true;
    const requestedUsageLevel = USAGE_LEVELS.includes(String(raw?.requestedUsageLevel || '').toLocaleLowerCase('en'))
        ? String(raw.requestedUsageLevel).toLocaleLowerCase('en') : existsInRequestedLanguage ? 'standard' : 'invalid';
    const mostLikelyUsageLevel = USAGE_LEVELS.includes(String(raw?.mostLikelyUsageLevel || '').toLocaleLowerCase('en'))
        ? String(raw.mostLikelyUsageLevel).toLocaleLowerCase('en') : 'common';
    const rawMostLikely = cleanCode(raw?.mostLikelyLanguage);
    const rawAlternative = cleanCode(raw?.mostLikelyAlternativeLanguage);
    const mostLikelyLanguage = rawMostLikely || validLanguages[0] || '';
    const mostLikelyAlternativeLanguage = rawAlternative || (mostLikelyLanguage !== requestedLanguage ? mostLikelyLanguage : '')
        || validLanguages.find(code => code !== requestedLanguage) || '';

    if (existsInRequestedLanguage && requestedLanguage && !validLanguages.includes(requestedLanguage)) {
        // validLanguages is supporting evidence, not an exhaustive language inventory.
        validLanguages.unshift(requestedLanguage);
    }
    if (NON_QUALIFYING_USAGE.has(requestedUsageLevel) && mostLikelyLanguage && mostLikelyLanguage !== requestedLanguage
        && ORDINARY_USAGE.has(mostLikelyUsageLevel)) {
        existsInRequestedLanguage = false;
        validLanguages = validLanguages.filter(code => code !== requestedLanguage);
    }

    return {
        requestedLanguage,
        existsInRequestedLanguage,
        validLanguages,
        mostLikelyLanguage,
        mostLikelyAlternativeLanguage,
        requestedUsageLevel,
        mostLikelyUsageLevel,
        ambiguous:raw?.ambiguous === true,
        mixedLanguage:raw?.mixedLanguage === true,
        confidence:boundedConfidence(raw?.confidence),
        decisionReason:cleanText(raw?.decisionReason),
        borrowingNote:cleanText(raw?.borrowingNote)
    };
}

export function rawLanguageContradictions(result, requestedSource) {
    const failures = [];
    const raw = result?.sourceLanguageValidation;
    const requested = cleanCode(requestedSource);
    if (!raw || typeof raw !== 'object') return ['missing language validation'];
    const valid = (Array.isArray(raw.validLanguages) ? raw.validLanguages : []).map(cleanCode).filter(Boolean);
    if (cleanCode(raw.requestedLanguage) !== requested) failures.push('requested language mismatch');
    if (raw.existsInRequestedLanguage === true && valid.length && !valid.includes(requested)) failures.push('accepted source absent from observed languages');
    if (raw.existsInRequestedLanguage === false && valid.includes(requested)) failures.push('rejected source present in observed languages');
    const detected = cleanCode(result?.detectedSourceLang);
    const likely = cleanCode(raw.mostLikelyLanguage);
    if (detected && likely && detected !== likely && boundedConfidence(raw.confidence) >= 0.8) failures.push('detected and most-likely languages conflict');
    return failures;
}

export function isGenuinelyAmbiguous(result) {
    const validation = result?.sourceLanguageValidation || {};
    return validation.mixedLanguage === true || (validation.ambiguous === true && boundedConfidence(validation.confidence) < 0.9);
}

function normalizeConjugations(result) {
    if (result?.isVerb !== true) return [];
    const groups = Array.isArray(result.conjugationGroups)
        ? result.conjugationGroups
        : Array.isArray(result.conjugations)
            ? result.conjugations.map(item => ({ label:item.label || item.tense, forms:item.forms, note:item.note || '' }))
            : result.conjugations && typeof result.conjugations === 'object'
                ? Object.entries(result.conjugations).map(([label, forms]) => ({ label, forms, note:'' })) : [];
    const seen = new Set();
    return groups.map(group => ({
        label:cleanText(group?.label || group?.tense),
        forms:cleanTextArray(group?.forms, 32),
        note:cleanText(group?.note),
        coverageKeys:cleanTextArray(group?.coverageKeys, 8)
    })).filter(group => {
        const key = group.label.toLocaleLowerCase('en');
        if (!key || !group.forms.length || seen.has(key)) return false;
        seen.add(key); return true;
    }).slice(0, 32);
}

function conjugationObject(groups) {
    return Object.fromEntries((groups || []).map(group => [group.label, group.forms]));
}

export function stripLinguisticContent(result, context = {}) {
    const validation = normalizedValidation(result?.sourceLanguageValidation, context.fromLang);
    const observedLanguages = validation.validLanguages;
    return {
        detectedSourceLang:cleanCode(result?.detectedSourceLang) || validation.mostLikelyLanguage || validation.mostLikelyAlternativeLanguage,
        sourceLanguageValidation:validation,
        wordExists:observedLanguages.length > 0 || !!(validation.mostLikelyLanguage || validation.mostLikelyAlternativeLanguage),
        suggestedCorrection:cleanText(result?.suggestedCorrection),
        extractedText:cleanText(result?.extractedText),
        languageMismatch:validation.existsInRequestedLanguage === false && !!(validation.mostLikelyAlternativeLanguage || validation.mostLikelyLanguage),
        partOfSpeech:'', formality:'',
        learningMetadata:{ cefrLevel:'Unclassified', frequencyBand:'Less common', modality:'Both', sourceNote:'', targetNote:'' },
        mainTranslation:[], pronunciationGuide:'',
        etymology:{ sourceLang:'', targetLang:'' }, isVerb:false, conjugationGroups:[], conjugations:{},
        definitions:{ sourceLang:[], targetLang:[] }, synonyms:{ sourceLang:[], targetLang:[] },
        similarPhrases:{ sourceLang:[], targetLang:[] }, meanings:[], collocations:{ sourceLang:[], targetLang:[] },
        usageWarnings:{ sourceLang:[], targetLang:[] }, grammarNotes:{ sourceLang:[], targetLang:[] },
        regionalVariants:[], wordFamily:[], minimalPairs:[], contexts:[],
        definitionsOnly:context.definitionsOnly === true
    };
}

function applyKnownLanguageMembership(validation, context) {
    const requested = cleanCode(context.fromLang);
    const normalizedQuery = normalizeDictionaryQuery(context.query);
    // Keep the fast preview and complete-result decisions aligned for this
    // established bilingual technical borrowing.
    if (normalizedQuery === 'backend' && requested === 'FR') {
        return {
            ...validation,
            existsInRequestedLanguage:true,
            validLanguages:[...new Set(['FR', 'EN', ...validation.validLanguages])],
            mostLikelyLanguage:validation.mostLikelyLanguage || 'FR',
            mostLikelyAlternativeLanguage:validation.mostLikelyAlternativeLanguage || 'EN',
            requestedUsageLevel:'specialized',
            confidence:Math.max(0.9, validation.confidence),
            borrowingNote:validation.borrowingNote || 'Emprunt technique établi à l’anglais dans l’usage informatique français.'
        };
    }
    return validation;
}

export function normalizePreviewResult(rawResult, context) {
    const result = clone(rawResult) || {};
    const requested = cleanCode(context.fromLang);
    const validation = applyKnownLanguageMembership(
        normalizedValidation(result.sourceLanguageValidation, requested),
        context
    );
    const wordExists = validation.validLanguages.length > 0 || validation.existsInRequestedLanguage
        ? true : result.wordExists === true;
    const base = {
        detectedSourceLang:cleanCode(result.detectedSourceLang) || validation.mostLikelyLanguage
            || validation.mostLikelyAlternativeLanguage || requested,
        sourceLanguageValidation:validation,
        wordExists,
        suggestedCorrection:cleanText(result.suggestedCorrection),
        languageMismatch:validation.existsInRequestedLanguage === false
            && !!(validation.mostLikelyAlternativeLanguage || validation.mostLikelyLanguage),
        partOfSpeech:'',
        formality:'',
        mainTranslation:[],
        pronunciationGuide:'',
        previewMeaning:{ partOfSpeech:'', register:'', sourceDefinition:'', targetDefinition:'' },
        definitionsOnly:context.definitionsOnly === true
    };
    if (!validation.existsInRequestedLanguage || !wordExists) return base;

    const formality = normalizeRegister(result.formality);
    const meaning = result.previewMeaning || {};
    const normalized = {
        ...base,
        languageMismatch:false,
        partOfSpeech:normalizePartOfSpeech(result.partOfSpeech, context.query),
        formality,
        mainTranslation:cleanTextArray(result.mainTranslation, 4),
        pronunciationGuide:cleanText(result.pronunciationGuide),
        previewMeaning:{
            partOfSpeech:normalizePartOfSpeech(
                meaning.partOfSpeech || result.partOfSpeech,
                context.query
            ),
            register:normalizeRegister(meaning.register, formality),
            sourceDefinition:cleanText(meaning.sourceDefinition),
            targetDefinition:cleanText(meaning.targetDefinition)
        }
    };
    if (context.definitionsOnly) {
        normalized.mainTranslation = [];
        normalized.previewMeaning.targetDefinition = '';
    }
    return normalized;
}

export function previewFromCore(coreResult, context) {
    const core = normalizeTranslationResult(coreResult, context);
    const firstMeaning = core?.meanings?.[0] || {};
    return normalizePreviewResult({
        detectedSourceLang:core?.detectedSourceLang || '',
        sourceLanguageValidation:core?.sourceLanguageValidation || {},
        wordExists:core?.wordExists === true,
        suggestedCorrection:core?.suggestedCorrection || '',
        partOfSpeech:core?.partOfSpeech || '',
        formality:firstMeaning.register || core?.formality || 'Neutral',
        mainTranslation:core?.mainTranslation || [],
        pronunciationGuide:core?.pronunciationGuide || '',
        previewMeaning:{
            partOfSpeech:firstMeaning.partOfSpeech || core?.partOfSpeech || '',
            register:firstMeaning.register || core?.formality || 'Neutral',
            sourceDefinition:firstMeaning.sourceDefinition || core?.definitions?.sourceLang?.[0] || '',
            targetDefinition:firstMeaning.targetDefinition || core?.definitions?.targetLang?.[0] || ''
        }
    }, context);
}

function previewHasLinguisticContent(result) {
    return hasText(result?.partOfSpeech) || hasText(result?.formality)
        || hasText(result?.pronunciationGuide) || result?.mainTranslation?.some(hasText)
        || hasText(result?.previewMeaning?.sourceDefinition)
        || hasText(result?.previewMeaning?.targetDefinition);
}

export function previewQualityIssues(result, context) {
    const issues = [];
    if (!result || typeof result !== 'object') return ['empty preview'];
    const validation = result.sourceLanguageValidation;
    if (!validation || validation.requestedLanguage !== cleanCode(context.fromLang)) {
        issues.push('invalid requested-language validation');
    }
    if (!hasText(validation?.decisionReason)) issues.push('missing language decision reason');
    if (validation?.existsInRequestedLanguage === false || result.wordExists === false) {
        if (previewHasLinguisticContent(result)) issues.push('rejected preview contains linguistic content');
        return issues;
    }
    const definitionsOnly = context.definitionsOnly === true;
    if (!result.wordExists) issues.push('accepted preview marked nonexistent');
    if (!hasText(result.partOfSpeech)) issues.push('missing preview part of speech');
    if (!REGISTER_VALUES.includes(result.formality)) issues.push('missing preview register');
    if (!definitionsOnly && !result.mainTranslation?.some(hasText)) issues.push('missing preview translation');
    if (!hasText(result.pronunciationGuide)) issues.push('missing preview pronunciation');
    if (!hasText(result.previewMeaning?.partOfSpeech)
        || !REGISTER_VALUES.includes(result.previewMeaning?.register)
        || !hasText(result.previewMeaning?.sourceDefinition)
        || (!definitionsOnly && !hasText(result.previewMeaning?.targetDefinition))) {
        issues.push('missing or incomplete preview meaning');
    }
    return issues;
}

export function normalizeTranslationResult(rawResult, context) {
    const result = clone(rawResult) || {};
    const requested = cleanCode(context.fromLang);
    const normalizedQuery = normalizeDictionaryQuery(context.query);
    const validation = applyKnownLanguageMembership(
        normalizedValidation(result.sourceLanguageValidation, requested),
        context
    );

    result.sourceLanguageValidation = validation;
    // A known valid-language observation proves that the input exists somewhere, even when it is a source mismatch.
    result.wordExists = validation.validLanguages.length > 0 || validation.existsInRequestedLanguage
        ? true : result.wordExists === true;

    if (!validation.existsInRequestedLanguage || result.wordExists === false) {
        return stripLinguisticContent(result, context);
    }

    const formality = normalizeRegister(result.formality);
    const partOfSpeech = normalizePartOfSpeech(result.partOfSpeech, context.query);
    const isVerb = result.isVerb === true || /\bverb\b/iu.test(partOfSpeech);
    const conjugationGroups = normalizeConjugations({ ...result, isVerb });
    const normalized = {
        detectedSourceLang:cleanCode(result.detectedSourceLang) || requested,
        sourceLanguageValidation:validation,
        wordExists:true,
        suggestedCorrection:cleanText(result.suggestedCorrection),
        extractedText:cleanText(result.extractedText),
        languageMismatch:false,
        partOfSpeech,
        formality,
        learningMetadata:normalizeLearningMetadata(result.learningMetadata, context.definitionsOnly === true),
        mainTranslation:cleanTextArray(result.mainTranslation, 8),
        pronunciationGuide:cleanText(result.pronunciationGuide),
        etymology:{ sourceLang:cleanText(result.etymology?.sourceLang), targetLang:cleanText(result.etymology?.targetLang) },
        isVerb,
        conjugationGroups,
        conjugations:conjugationObject(conjugationGroups),
        definitions:normalizeBilingual(result.definitions),
        synonyms:normalizeBilingual(result.synonyms),
        similarPhrases:normalizeBilingual(result.similarPhrases || result.relatedPhrases),
        meanings:(Array.isArray(result.meanings) ? result.meanings : []).map((meaning, index) => ({
            label:normalizeMeaningLabel(meaning?.label, index),
            // Keep each sense's grammatical classification separate from its
            // semantic title and from the entry-level list of all classes.
            partOfSpeech:normalizePartOfSpeech(meaning?.partOfSpeech, context.query),
            // A production meaning must carry its own register. Do not silently
            // inherit the entry-level compatibility label, because mixed-register
            // words such as "awesome", "lit" and "cheers" need distinct labels.
            register:normalizeRegister(meaning?.register, ''),
            sourceDefinition:cleanText(meaning?.sourceDefinition),
            targetDefinition:cleanText(meaning?.targetDefinition),
            translations:cleanTextArray(meaning?.translations, 8)
        })).filter(meaning => meaning.label || meaning.sourceDefinition),
        collocations:normalizeBilingual(result.collocations || result.relatedPhrases),
        usageWarnings:normalizeBilingual(result.usageWarnings),
        grammarNotes:normalizeBilingual(result.grammarNotes),
        regionalVariants:(Array.isArray(result.regionalVariants) ? result.regionalVariants : []).map(item => ({
            region:cleanText(item?.region), variant:cleanText(item?.variant), note:cleanText(item?.note)
        })).filter(item => item.region && item.variant),
        // Word families are optional. Never invent one simply to satisfy completeness.
        wordFamily:(Array.isArray(result.wordFamily) ? result.wordFamily : []).map(item => ({
            word:cleanText(item?.word), partOfSpeech:cleanText(item?.partOfSpeech), translation:cleanText(item?.translation)
        })).filter(item => item.word),
        minimalPairs:(Array.isArray(result.minimalPairs) ? result.minimalPairs : []).map(item => ({
            word:cleanText(item?.word), contrast:cleanText(item?.contrast), translation:cleanText(item?.translation)
        })).filter(item => item.word && normalizeDictionaryQuery(item.word) !== normalizedQuery),
        contexts:(Array.isArray(result.contexts) ? result.contexts : []).map((item, index) => ({
            contextName:cleanText(item?.contextName),
            meaningIndex:Number.isInteger(item?.meaningIndex) && item.meaningIndex >= 0 ? item.meaningIndex : index,
            examples:Array.isArray(item?.examples) ? item.examples : []
        })).filter(item => item.contextName),
        definitionsOnly:context.definitionsOnly === true
    };

    if (context.definitionsOnly) return prepareDefinitionsOnlyResult(normalized);
    return normalized;
}

export function prepareDefinitionsOnlyResult(value) {
    const result = clone(value);
    if (!result) return result;
    result.definitionsOnly = true;
    result.mainTranslation = [];
    if (result.learningMetadata) result.learningMetadata.targetNote = '';
    if (result.etymology) result.etymology.targetLang = '';
    ['definitions', 'synonyms', 'similarPhrases', 'collocations', 'usageWarnings', 'grammarNotes'].forEach(field => {
        if (result[field]) result[field].targetLang = [];
    });
    result.meanings = (result.meanings || []).map(meaning => ({ ...meaning, targetDefinition:'', translations:[] }));
    result.wordFamily = (result.wordFamily || []).map(item => ({ ...item, translation:'' }));
    result.minimalPairs = (result.minimalPairs || []).map(item => ({ ...item, translation:'' }));
    result.contexts = (result.contexts || []).map(context => ({
        ...context,
        examples:(context.examples || []).map(example => ({
            ...example, translated:'', targetTranslatedSnippet:'', blankedTranslation:'', distractors:[]
        }))
    }));
    return result;
}

function bilingualHasContent(value, definitionsOnly, allowEmpty = false) {
    if (!value || !Array.isArray(value.sourceLang) || !Array.isArray(value.targetLang)) return false;
    if (!allowEmpty && !value.sourceLang.some(hasText)) return false;
    return definitionsOnly || allowEmpty || value.targetLang.some(hasText);
}

export function requiredConjugationCoverage(languageCode) {
    return [...(CONJUGATION_COVERAGE[cleanCode(languageCode)] || [])];
}

export function conjugationCoverageIssues(result, context) {
    if (result?.isVerb !== true) return [];
    const groups = Array.isArray(result.conjugationGroups) ? result.conjugationGroups : [];
    if (!groups.length) return ['missing language-specific conjugations'];
    const required = requiredConjugationCoverage(context.fromLang);
    const covered = new Set(groups.flatMap(group => cleanTextArray(group?.coverageKeys, 8)));
    const missing = required.filter(key => !covered.has(key));
    if (missing.length) return [`incomplete conjugation coverage: ${missing.join(', ')}`];
    return [];
}

export function coreQualityIssues(result, context) {
    const issues = [];
    if (!result || typeof result !== 'object') return ['empty result'];
    const validation = result.sourceLanguageValidation;
    if (!validation || validation.requestedLanguage !== cleanCode(context.fromLang)) issues.push('invalid requested-language validation');
    if (!hasText(validation?.decisionReason)) issues.push('missing language decision reason');
    if (validation?.existsInRequestedLanguage === false || result.wordExists === false) {
        if (hasLinguisticContent(result)) issues.push('rejected entry contains linguistic content');
        return issues;
    }
    const definitionsOnly = context.definitionsOnly === true;
    if (!result.wordExists) issues.push('accepted entry marked nonexistent');
    if (!hasText(result.partOfSpeech)) issues.push('missing part of speech');
    if (/\bverb\b/iu.test(result.partOfSpeech || '') && result.isVerb !== true) {
        issues.push('verb classification contradicts isVerb');
    }
    if (!REGISTER_VALUES.includes(result.formality)) issues.push('missing entry register');
    if (!CEFR_LEVELS.includes(result.learningMetadata?.cefrLevel)
        || !FREQUENCY_BANDS.includes(result.learningMetadata?.frequencyBand)
        || !MODALITY_VALUES.includes(result.learningMetadata?.modality)) {
        issues.push('invalid learning metadata');
    }
    if (!hasText(result.learningMetadata?.sourceNote)) issues.push('missing source learning note');
    if (!definitionsOnly && !hasText(result.learningMetadata?.targetNote)) issues.push('missing target learning note');
    if (!definitionsOnly && !result.mainTranslation?.some(hasText)) issues.push('missing main translation');
    if (!hasText(result.etymology?.sourceLang)) issues.push('missing source etymology');
    if (!definitionsOnly && !hasText(result.etymology?.targetLang)) issues.push('missing target etymology');
    if (!bilingualHasContent(result.definitions, definitionsOnly)) issues.push('missing definitions');
    if (!bilingualHasContent(result.synonyms, definitionsOnly)) issues.push('missing synonyms');
    const sourceRelated = [...(result.similarPhrases?.sourceLang || []), ...(result.collocations?.sourceLang || [])];
    const targetRelated = [...(result.similarPhrases?.targetLang || []), ...(result.collocations?.targetLang || [])];
    if (!sourceRelated.some(hasText) || (!definitionsOnly && !targetRelated.some(hasText))) issues.push('missing related phrases or collocations');
    if (!Array.isArray(result.meanings) || !result.meanings.length
        || result.meanings.some(meaning => !hasText(meaning.partOfSpeech)
            || !hasText(meaning.sourceDefinition) || !REGISTER_VALUES.includes(meaning.register)
            || (!definitionsOnly && (!hasText(meaning.targetDefinition) || !meaning.translations?.some(hasText))))) {
        issues.push('missing or incomplete meanings');
    }
    if (!bilingualHasContent(result.usageWarnings, definitionsOnly, true)) issues.push('invalid usage-warnings section');
    if (!bilingualHasContent(result.grammarNotes, definitionsOnly, true)) issues.push('invalid grammar-notes section');
    if (!Array.isArray(result.regionalVariants) || !Array.isArray(result.wordFamily) || !Array.isArray(result.minimalPairs)) {
        issues.push('missing optional-section containers');
    }
    issues.push(...conjugationCoverageIssues(result, context));
    if (!Array.isArray(result.contexts) || !result.contexts.length || result.contexts.some(contextItem => !hasText(contextItem.contextName))) {
        issues.push('missing contexts');
    }
    return issues;
}

export function hasLinguisticContent(result) {
    if (!result) return false;
    return hasText(result.partOfSpeech) || hasText(result.pronunciationGuide) || hasText(result.formality)
        || hasText(result.learningMetadata?.sourceNote) || hasText(result.learningMetadata?.targetNote)
        || result.mainTranslation?.some(hasText) || hasText(result.etymology?.sourceLang) || hasText(result.etymology?.targetLang)
        || ['definitions', 'synonyms', 'similarPhrases', 'collocations', 'usageWarnings', 'grammarNotes']
            .some(field => result[field]?.sourceLang?.some(hasText) || result[field]?.targetLang?.some(hasText))
        || ['meanings', 'regionalVariants', 'wordFamily', 'minimalPairs', 'contexts', 'conjugationGroups']
            .some(field => Array.isArray(result[field]) && result[field].length > 0);
}

const danglingEndPatterns = Object.freeze({
    EN:/\b(?:a|an|the|to|of|for|with|from|on|in|at|by|and|or|but)\.?$/iu,
    FR:/\b(?:le|la|les|un|une|des|du|de|à|au|aux|sur|sous|avec|pour|par|et|ou|mais)\.?$/iu,
    ES:/\b(?:el|la|los|las|un|una|de|del|a|con|por|para|y|o|pero)\.?$/iu,
    DE:/\b(?:der|die|das|ein|eine|zu|von|mit|für|auf|in|und|oder|aber)\.?$/iu,
    IT:/\b(?:il|lo|la|gli|le|un|una|di|a|con|per|e|o|ma)\.?$/iu,
    PT:/\b(?:o|a|os|as|um|uma|de|do|da|com|por|para|e|ou|mas)\.?$/iu,
    SW:/\b(?:ya|wa|la|cha|kwa|na|au|lakini)\.?$/iu
});

export function exampleQualityIssues(example, context) {
    const issues = [];
    const original = cleanText(example?.original);
    const translated = cleanText(example?.translated);
    if (example?.complete !== true) issues.push('model marked sentence incomplete');
    if (original.length < 6) issues.push('source example too short');
    if (!context.definitionsOnly && translated.length < 6) issues.push('translation too short');
    for (const [text, code, label] of [[original, context.fromLang, 'source'], [translated, context.toLang, 'translation']]) {
        if (!text && label === 'translation' && context.definitionsOnly) continue;
        if (/(?:\.\.\.|…|[-–—,:;])\s*$/u.test(text)) issues.push(`${label} appears truncated`);
        const pattern = danglingEndPatterns[cleanCode(code)];
        if (pattern?.test(text)) issues.push(`${label} ends with an incomplete phrase`);
    }
    if (!hasText(example?.sourceSnippet) || !normalizeDictionaryQuery(original).includes(normalizeDictionaryQuery(example.sourceSnippet))) {
        issues.push('source snippet not found in example');
    }
    if (!context.definitionsOnly) {
        if (!hasText(example?.targetTranslatedSnippet) || !normalizeDictionaryQuery(translated).includes(normalizeDictionaryQuery(example.targetTranslatedSnippet))) {
            issues.push('target snippet not found in translation');
        }
        if (!hasText(example?.blankedTranslation) || !String(example.blankedTranslation).includes('___')) issues.push('missing blanked translation');
    }
    if (!hasText(example?.explanation)) issues.push('missing explanation');
    return issues;
}

export function contextsAreComplete(result, context) {
    if (!result?.sourceLanguageValidation?.existsInRequestedLanguage || !result.wordExists) return true;
    const contexts = Array.isArray(result.contexts) ? result.contexts : [];
    if (!contexts.length) return false;
    const expected = examplesPerContext(contexts.length);
    return contexts.every(item => Array.isArray(item.examples) && item.examples.length === expected
        && item.examples.every(example => exampleQualityIssues(example, context).length === 0));
}

export function buildPreviewRequest(context, { repairSource = null } = {}) {
    const fromName = LANGUAGES[cleanCode(context.fromLang)];
    const toName = LANGUAGES[cleanCode(context.toLang)];
    const definitionsOnly = context.definitionsOnly === true;
    const repairInstruction = repairSource
        ? `\nRepair these preview-gate issues: ${repairSource.issues.join('; ')}. Do not repeat them.\nDraft preview JSON:\n${JSON.stringify(repairSource.result)}`
        : '';
    const system = `You are Qelumi's fast multilingual dictionary preview engine. Analyse the exact input, never a corrected substitute. Return only the small preview requested by the schema; do not generate etymology, conjugations, synonyms, related phrases, regional variants, word families, contexts or examples.

First decide whether the exact input is genuinely established in requested source ${fromName} (${context.fromLang}). Grammatical sentences, established loanwords, expressions, specialised terms, and well-established fictional or cultural proper names qualify. Language origin is not language membership. Shared established words such as apocalypse and saboteur qualify in English and French. "backend" is established specialised French as well as English. The offensive English clipping "tard" does not qualify as the ordinary English entry; French "tard" does.

Validation fields must be internally consistent. validLanguages is supporting evidence and need not be exhaustive. If validLanguages is nonempty, wordExists must be true. Set wordExists=false only for genuine gibberish. If existsInRequestedLanguage=false, leave partOfSpeech, formality, mainTranslation, pronunciationGuide and every previewMeaning field empty. Do not translate a source-language mismatch.

For an accepted entry, return every established part of speech in partOfSpeech, one concise pronunciation guide, ${definitionsOnly ? 'no translation' : `one to four useful ${toName} translations`}, and one concise source-language definition for the most common sense. Use concise English grammatical labels. A multiword entry must receive a structural label such as Noun phrase, Compound noun, Verb phrase, Phrasal verb, Idiomatic expression, Clause or Sentence rather than a bare single-word class. ${definitionsOnly ? 'Keep targetDefinition empty.' : `Give a faithful ${toName} targetDefinition.`} Include the exact part of speech and register for that meaning.

Write sourceDefinition in ${fromName}. ${definitionsOnly ? 'Keep mainTranslation and targetDefinition empty.' : `Write mainTranslation and targetDefinition in ${toName}.`} Use only these language codes: ${Object.keys(LANGUAGES).join(', ')}. Return strict JSON matching the schema.${repairInstruction}`;
    return {
        contents:[{ role:'user', parts:[{ text:`Exact input: ${context.query}\nRequested source: ${fromName} (${context.fromLang})\nDestination: ${toName} (${context.toLang})` }] }],
        systemInstruction:{ parts:[{ text:system }] },
        generationConfig:{
            responseMimeType:'application/json',
            responseJsonSchema:PREVIEW_RESPONSE_SCHEMA,
            maxOutputTokens:2200
        }
    };
}

export function buildCoreRequest(context, { repairSource = null } = {}) {
    const fromName = LANGUAGES[cleanCode(context.fromLang)];
    const toName = LANGUAGES[cleanCode(context.toLang)];
    const definitionsOnly = context.definitionsOnly === true;
    const conjugationCoverage = requiredConjugationCoverage(context.fromLang);
    const repairInstruction = repairSource
        ? `\nRepair the supplied draft. Correct these production-gate issues: ${repairSource.issues.join('; ')}. Do not repeat the defects.\nDraft JSON:\n${JSON.stringify(repairSource.result)}` : '';
    const system = `You are Qelumi's conservative multilingual dictionary engine. Analyse the exact input, never a corrected substitute.

First decide only what production needs: whether the exact input is genuinely established in requested source ${fromName} (${context.fromLang}); the most likely alternative language if it is not; confidence; and whether the input is genuinely ambiguous or mixed-language. validLanguages is supporting evidence only and need not be exhaustive. A grammatical sentence, established loanword, established expression, and established specialised term qualify. Language origin is not language membership. Shared established words such as apocalypse and saboteur qualify in both English and French. "backend" is also an established French technical borrowing and must be accepted as specialised French when FR is requested, with borrowingNote explaining its English origin. The offensive English clipping "tard" does not qualify as the ordinary English entry; French "tard" does.

Validation fields must be internally consistent. If validLanguages is nonempty, wordExists must be true. Set wordExists=false only for genuine gibberish that is not valid in any supported language. If existsInRequestedLanguage=false, return every linguistic field empty: no translation, definition, etymology, pronunciation, meaning, context, conjugation, phrase, synonym, family, or minimal pair. The server will enforce this rule again.

For an accepted entry, provide a compact but complete core dictionary result. partOfSpeech must classify the exact whole input using concise English grammatical labels so the interface remains consistent. For a multiword entry, use a structural label such as Noun phrase, Compound noun, Verb phrase, Phrasal verb, Adjective phrase, Idiomatic expression, Clause or Sentence; never reduce "escape valve" to the bare single-word label "Noun". When established senses span word classes, list all of them, for example "Noun · Verb". Set isVerb=true whenever at least one established sense is verbal, even if the entry is also a noun or adjective.

    Put an exact English partOfSpeech and a register on every distinct meaning because one entry may mix grammatical classes and registers. Classify the individual sense itself (for example Noun, Noun phrase, Verb, Adjective, Adverb, Phrasal verb or Idiomatic expression); do not copy the entry-level multi-class list into every meaning. Each meaning label must remain a natural human-readable semantic title such as "Physical structure" or "Technical delay"; never use machine identifiers such as noun_structure or verb_connect and never append the part of speech to the label. formality is only a backward-compatible general label. Word families are optional: return [] when there is no clear genuine family, and never invent an item just to fill the section.

LEARNING METADATA: estimate the entry's practical CEFR vocabulary level as A1, A2, B1, B2, C1 or C2; use Unclassified for proper names, specialist terminology or expressions that cannot responsibly be mapped. Classify frequency as Very common, Common, Less common, Rare or Specialized, and modality as Spoken, Written or Both. sourceNote must briefly explain the level, frequency and typical use in ${fromName}. ${definitionsOnly ? 'Leave targetNote empty.' : `targetNote must faithfully explain the same learning guidance in ${toName}.`} Treat these as learner guidance, not an official certification claim.

ETYMOLOGY IS ABOUT THE SOURCE ENTRY, NEVER ITS TRANSLATION. Both etymology.sourceLang and etymology.targetLang must describe the origin and historical development of the exact source entry "${context.query}" in ${fromName}; neither field may switch to the origin of a destination-language equivalent. Write sourceLang entirely in ${fromName}. ${definitionsOnly ? 'Leave targetLang empty.' : `Write targetLang entirely in ${toName} as a faithful translation of the same etymological facts.`} When reliable information exists, give two to four concise but informative sentences covering the relevant roots or formation, original sense, route into the language, and later development or expression history. For an expression, explain the expression as a whole rather than etymologising an unrelated translated phrase. If evidence is uncertain or genuinely unavailable, state that explicitly and do not invent a story.

If the entry is a verb, make conjugationGroups a comprehensive practical inventory of the standard modern moods, tenses, aspects and non-finite forms that naturally exist in ${fromName}. Do not omit a standard form merely to keep the answer short, and do not force universal English/French tense concepts onto another language. For languages without inflectional tense, show their natural aspect, polarity, politeness and verb-form patterns instead. Include every person/pronoun form where the language normally distinguishes them. Recognised literary, historical or rare forms may be included only when clearly labelled in note. Keep repeated auxiliary constructions concise but accurate.

CONJUGATION COVERAGE CONTRACT: when isVerb=true, the union of conjugationGroups.coverageKeys must contain every one of these exact machine keys:
${conjugationCoverage.join(', ')}
coverageKeys are validation metadata and are not user-facing labels. Put each key on the group that actually supplies those forms; combine related keys in one group only when the displayed forms remain clear. If the entry is not a verb, return an empty conjugationGroups array.

Contexts contain names and meaning indexes only, with empty examples arrays; examples are requested separately. Do not generate quiz distractors.

${definitionsOnly ? `Source and destination are both ${fromName}. This is definitions-only mode. Keep mainTranslation and all target-language fields empty; never duplicate source content.` : `Translate from ${fromName} to ${toName}. Source fields must be in ${fromName}; target fields must be in ${toName}.`}

Use supported language codes only: ${Object.keys(LANGUAGES).join(', ')}. Return strict JSON matching the schema.${repairInstruction}`;
    return {
        contents:[{ role:'user', parts:[{ text:`Exact input: ${context.query}\nRequested source: ${fromName} (${context.fromLang})\nDestination: ${toName} (${context.toLang})` }] }],
        systemInstruction:{ parts:[{ text:system }] },
        generationConfig:{
            responseMimeType:'application/json', responseJsonSchema:CORE_RESPONSE_SCHEMA,
            maxOutputTokens:16384
        }
    };
}

function conjugationResponseSchema(context) {
    const coverageKeys = requiredConjugationCoverage(context.fromLang);
    return {
        type:'object',
        additionalProperties:false,
        properties:{
            conjugationGroups:{
                type:'array',
                minItems:1,
                maxItems:32,
                items:{
                    type:'object',
                    additionalProperties:false,
                    properties:{
                        label:{ type:'string' },
                        forms:textArray(32),
                        note:{ type:'string' },
                        coverageKeys:{
                            type:'array',
                            minItems:1,
                            maxItems:8,
                            items:{ type:'string', enum:coverageKeys }
                        }
                    },
                    required:['label', 'forms', 'note', 'coverageKeys']
                }
            }
        },
        required:['conjugationGroups']
    };
}

export function buildConjugationRepairRequest(context, coreResult, issues = []) {
    const fromName = LANGUAGES[cleanCode(context.fromLang)];
    const required = requiredConjugationCoverage(context.fromLang);
    const system = `You are Qelumi's specialist ${fromName} verb-paradigm repair engine. Return only corrected conjugationGroups for the exact source entry. The entry has already been accepted in ${fromName} and has at least one verbal sense.

Supply a comprehensive but concise source-language paradigm. Use natural ${fromName} labels. Include all person, number, gender, politeness or polarity contrasts that the language normally distinguishes. For languages without inflectional tense, supply their genuine aspect, polarity, politeness and verb-form patterns instead of inventing European-style tenses. Mark genuinely literary, historical or rare forms in note.

The union of coverageKeys must contain every exact key below, and every key must describe forms actually shown by its group:
${required.join(', ')}

coverageKeys are machine validation labels, not headings. Do not translate the entry and do not return any other dictionary fields. Return strict JSON matching the schema.`;
    return {
        contents:[{
            role:'user',
            parts:[{
                text:`Exact source entry: ${context.query}\nSource language: ${fromName} (${context.fromLang})\nGrammatical classification: ${coreResult?.partOfSpeech || 'Verb'}\nDetected defects: ${issues.join('; ') || 'coverage incomplete'}\nCurrent conjugation groups:\n${JSON.stringify(coreResult?.conjugationGroups || [])}`
            }]
        }],
        systemInstruction:{ parts:[{ text:system }] },
        generationConfig:{
            responseMimeType:'application/json',
            responseJsonSchema:conjugationResponseSchema(context),
            maxOutputTokens:10000
        }
    };
}

export function buildValidationRequest(context, primaryResult, issues = []) {
    const fromName = LANGUAGES[cleanCode(context.fromLang)];
    const system = `You are Qelumi's senior multilingual lexical validator. Resolve only source-language membership for the exact input. validLanguages is supporting evidence, not an exhaustive inventory. Decide whether it is genuinely established in requested ${fromName}, its most likely alternative language, confidence, and whether it is genuinely ambiguous or mixed-language. Established loanwords and specialised terms qualify. "backend" is established specialised French. Shared words such as apocalypse and saboteur qualify in English and French. The English offensive clipping "tard" does not qualify as the ordinary English entry. Return strict JSON only.`;
    return {
        contents:[{ role:'user', parts:[{ text:`Exact input: ${context.query}\nRequested source: ${context.fromLang}\nDestination: ${context.toLang}\nPrimary validation: ${JSON.stringify(primaryResult?.sourceLanguageValidation || {})}\nDetected issues: ${issues.join('; ') || 'genuine ambiguity'}` }] }],
        systemInstruction:{ parts:[{ text:system }] },
        generationConfig:{ responseMimeType:'application/json', responseJsonSchema:VALIDATION_RESPONSE_SCHEMA, maxOutputTokens:1200 }
    };
}

export function buildExamplesRequest(context, coreResult, contextItem, count, { repairIssues = [] } = {}) {
    const fromName = LANGUAGES[cleanCode(context.fromLang)];
    const toName = LANGUAGES[cleanCode(context.toLang)];
    const meaning = coreResult.meanings?.[contextItem.meaningIndex] || coreResult.meanings?.[0] || {};
    const system = `Generate exactly ${count} complete, natural, diverse examples for the specified meaning of the exact Qelumi entry. Every source sentence must contain a natural inflected or exact form of the entry, and sourceSnippet must copy that exact form from original. Never end a sentence on an article, preposition, conjunction, ellipsis, dash, colon, or other unfinished fragment. Set complete=true only after checking both sentences are syntactically complete.

${context.definitionsOnly ? `Write original and explanation in ${fromName}. Keep translated, targetTranslatedSnippet and blankedTranslation empty.` : `Write original in ${fromName}, translate it fully into ${toName}, and explain the usage in ${fromName}. targetTranslatedSnippet must be an exact substring of translated. blankedTranslation must equal the full translation with that exact substring replaced by ___.`}

Do not create distractors. Return strict JSON matching the schema.${repairIssues.length ? ` Repair these prior defects: ${repairIssues.join('; ')}.` : ''}`;
    return {
        contents:[{ role:'user', parts:[{ text:`Entry: ${context.query}\nContext: ${contextItem.contextName}\nMeaning: ${meaning.sourceDefinition || contextItem.contextName}\nPart of speech: ${meaning.partOfSpeech || coreResult.partOfSpeech}\nRegister: ${meaning.register || coreResult.formality}` }] }],
        systemInstruction:{ parts:[{ text:system }] },
        generationConfig:{ responseMimeType:'application/json', responseJsonSchema:EXAMPLES_RESPONSE_SCHEMA, maxOutputTokens:8192 }
    };
}

export function buildDistractorRequest(context) {
    const toName = LANGUAGES[cleanCode(context.toLang)];
    return {
        contents:[{ role:'user', parts:[{ text:`Source sentence: ${context.original}\nCorrect ${toName} answer: ${context.correct}\nFull translation: ${context.translated}\nGenerate ${context.count || 4} realistic but incorrect alternatives.` }] }],
        systemInstruction:{ parts:[{ text:`Create plausible ${toName} quiz choices that match the correct answer's grammatical category, approximate length, register, and semantic field, but are definitely incorrect for this sentence. Do not repeat the correct answer. Return strict JSON only.` }] },
        generationConfig:{ responseMimeType:'application/json', responseJsonSchema:DISTRACTOR_RESPONSE_SCHEMA, maxOutputTokens:600 }
    };
}

export function extractGeminiText(data) {
    return (data?.candidates?.[0]?.content?.parts || [])
        .filter(part => !part.thought && typeof part.text === 'string')
        .map(part => part.text).join('').trim();
}

export function parseGeminiJSON(data) {
    const text = extractGeminiText(data).replace(/^\uFEFF/, '').trim();
    if (!text) throw Object.assign(new Error('The model returned an empty response.'), { code:'MODEL_EMPTY' });
    try { return JSON.parse(text); }
    catch (_) {
        // JSON mode is normally exact, but the last compatibility tier deliberately
        // permits plain text so a provider-side configuration change cannot make
        // every translation fail. Accept a single fenced or surrounded JSON value;
        // deterministic quality gates still validate the parsed object afterwards.
        const unfenced = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        try { return JSON.parse(unfenced); } catch (_) {}
        const objectStart = unfenced.indexOf('{');
        const objectEnd = unfenced.lastIndexOf('}');
        if (objectStart >= 0 && objectEnd > objectStart) {
            try { return JSON.parse(unfenced.slice(objectStart, objectEnd + 1)); } catch (_) {}
        }
        throw Object.assign(new Error('The model returned invalid JSON.'), { code:'MODEL_JSON_INVALID' });
    }
}

function timestampMillis(value) {
    return value?.toMillis?.() || Number(value) || 0;
}

function mergeContextExamples(newCore, previous) {
    if (!Array.isArray(previous?.contexts)) return newCore;
    const oldByName = new Map(previous.contexts.map(item => [normalizeDictionaryQuery(item.contextName), item.examples || []]));
    newCore.contexts = (newCore.contexts || []).map(item => ({
        ...item, examples:oldByName.get(normalizeDictionaryQuery(item.contextName)) || []
    }));
    return newCore;
}

function singleFlight(map, key, work) {
    if (map.has(key)) return map.get(key);
    const promise = Promise.resolve().then(work).finally(() => map.delete(key));
    map.set(key, promise);
    return promise;
}

function usageMetrics(data) {
    const usage = data?.usageMetadata || {};
    return {
        inputTokens:Number(usage.promptTokenCount || 0),
        visibleOutputTokens:Number(usage.candidatesTokenCount || 0),
        reasoningTokens:Number(usage.thoughtsTokenCount || 0),
        totalTokens:Number(usage.totalTokenCount || 0)
    };
}

export function responseSchema(body) {
    const generationConfig = body?.generationConfig || {};
    return generationConfig.responseJsonSchema || generationConfig.responseSchema || null;
}

function schemaComplexity(schema) {
    const result = { properties:0, nodes:0, depth:0 };
    const visit = (value, depth) => {
        if (!value || typeof value !== 'object') return;
        result.nodes += 1;
        result.depth = Math.max(result.depth, depth);
        if (value.properties && typeof value.properties === 'object') {
            result.properties += Object.keys(value.properties).length;
        }
        Object.values(value).forEach(child => visit(child, depth + 1));
    };
    visit(schema, 0);
    return result;
}

export function isComplexResponseSchema(schema) {
    if (!schema) return false;
    const complexity = schemaComplexity(schema);
    // Gemini explicitly documents that very large/deep schemas may be rejected.
    // Qelumi's core dictionary contract is well above the conservative complexity
    // boundary, so use JSON mode plus server validation instead of paying for a known 400.
    return complexity.properties > 60 || complexity.nodes > 140 || complexity.depth > 8
        || JSON.stringify(schema).length > 12_000;
}

export function isGeminiInvalidArgument(response, data) {
    if (response?.status !== 400) return false;
    const providerStatus = String(data?.error?.status || '').toUpperCase();
    const message = String(data?.error?.message || '').toLowerCase();
    return providerStatus === 'INVALID_ARGUMENT' || !message || message.includes('invalid argument')
        || message.includes('responsejsonschema') || message.includes('responseschema');
}

function combinedSystemText(systemInstruction) {
    return (Array.isArray(systemInstruction?.parts) ? systemInstruction.parts : [])
        .filter(part => typeof part?.text === 'string')
        .map(part => part.text.trim()).filter(Boolean).join('\n\n');
}

export function requestWithoutConstrainedSchema(body) {
    const retryBody = clone(body);
    const schema = responseSchema(retryBody);
    retryBody.generationConfig = { ...(retryBody.generationConfig || {}) };
    delete retryBody.generationConfig.responseJsonSchema;
    delete retryBody.generationConfig.responseSchema;
    retryBody.generationConfig.responseMimeType = 'application/json';
    const existingSystem = combinedSystemText(retryBody.systemInstruction);
    const schemaContract = schema
        ? `Return exactly one valid JSON object matching this JSON Schema contract. Do not add Markdown or commentary.\nJSON Schema:\n${JSON.stringify(schema)}`
        : 'Return exactly one valid JSON object. Do not add Markdown or commentary.';
    // Gemini system instructions are text-only. Combining the contract into one
    // text part is accepted more consistently than appending a second system part.
    retryBody.systemInstruction = {
        ...(retryBody.systemInstruction || {}),
        parts:[{ text:[existingSystem, schemaContract].filter(Boolean).join('\n\n') }]
    };
    return retryBody;
}

function requestWithoutThinking(body) {
    const retryBody = clone(body);
    retryBody.generationConfig = { ...(retryBody.generationConfig || {}) };
    delete retryBody.generationConfig.thinkingConfig;
    return retryBody;
}

function requestWithoutJsonGenerationFields(body) {
    const retryBody = requestWithoutThinking(body);
    retryBody.generationConfig = { ...(retryBody.generationConfig || {}) };
    delete retryBody.generationConfig.responseJsonSchema;
    delete retryBody.generationConfig.responseSchema;
    delete retryBody.generationConfig.responseMimeType;
    return retryBody;
}

export function buildGeminiCompatibilityRequests(body, thinkingLevel) {
    const structured = clone(body || {});
    structured.generationConfig = {
        ...(structured.generationConfig || {}),
        ...(thinkingLevel ? { thinkingConfig:{ thinkingLevel } } : {})
    };
    const schema = responseSchema(structured);
    const jsonPrompt = schema ? requestWithoutConstrainedSchema(structured) : structured;
    const candidates = [];
    if (!schema || !isComplexResponseSchema(schema)) candidates.push({ mode:'structured', body:structured });
    if (schema) candidates.push({ mode:'json_schema_prompt', body:jsonPrompt });
    if (thinkingLevel) candidates.push({ mode:'json_without_thinking', body:requestWithoutThinking(jsonPrompt) });
    candidates.push({ mode:'plain_json_fallback', body:requestWithoutJsonGenerationFields(jsonPrompt) });

    const seen = new Set();
    return candidates.filter(candidate => {
        const signature = JSON.stringify(candidate.body);
        if (seen.has(signature)) return false;
        seen.add(signature);
        return true;
    });
}

export function geminiCompatibilityKey(model, body) {
    const schema = responseSchema(body);
    const schemaKey = schema ? crypto.createHash('sha256').update(JSON.stringify(schema)).digest('hex') : 'none';
    return `${model}|${schemaKey}`;
}

export function createTranslationService({ db, FieldValue, recordUsage = async () => {}, fetchImpl = fetch } = {}) {
    if (!db || !FieldValue) throw new Error('Firestore dependencies are required.');
    const apiKey = process.env.GEMINI_API_KEY;
    const freshTtlMs = Math.max(60_000, Number(process.env.DICTIONARY_FRESH_TTL_MS || 30 * 24 * 60 * 60_000));
    const staleTtlMs = Math.max(freshTtlMs, Number(process.env.DICTIONARY_STALE_TTL_MS || 365 * 24 * 60 * 60_000));
    const mismatchTtlMs = Math.max(60_000, Number(process.env.DICTIONARY_MISMATCH_TTL_MS || 12 * 60 * 60_000));
    const primaryTimeoutMs = Math.max(2_000, Number(process.env.GEMINI_PRIMARY_TIMEOUT_MS || 15_000));
    const fallbackTimeoutMs = Math.max(2_000, Number(process.env.GEMINI_FALLBACK_TIMEOUT_MS || 25_000));
    const previewPrimaryTimeoutMs = Math.max(2_000, Number(process.env.GEMINI_PREVIEW_PRIMARY_TIMEOUT_MS || Math.min(primaryTimeoutMs, 8_000)));
    const previewFallbackTimeoutMs = Math.max(2_000, Number(process.env.GEMINI_PREVIEW_FALLBACK_TIMEOUT_MS || Math.min(fallbackTimeoutMs, 12_000)));
    const cacheReadTimeoutMs = Math.max(1_000, Number(process.env.DICTIONARY_READ_TIMEOUT_MS || 4_000));
    const cacheWriteTimeoutMs = Math.max(1_000, Number(process.env.DICTIONARY_WRITE_TIMEOUT_MS || 5_000));
    const previewFlights = new Map();
    const coreFlights = new Map();
    const exampleFlights = new Map();
    const distractorFlights = new Map();
    const successfulCompatibilityModes = new Map();
    const dictionaryRef = context => db.doc(`artifacts/${process.env.APP_ID || 'linguist-app-v7'}/public/data/global_dictionary/${dictionaryDocumentId(context.query, context.fromLang, context.toLang)}`);

    function withDeadline(promise, timeoutMs, label) {
        let timer;
        return Promise.race([
            Promise.resolve(promise),
            new Promise((_, reject) => {
                timer = setTimeout(() => {
                    const error = new Error(`${label} timed out after ${timeoutMs} ms.`);
                    error.code = 'DEPENDENCY_TIMEOUT';
                    reject(error);
                }, timeoutMs);
            })
        ]).finally(() => clearTimeout(timer));
    }

    async function readDictionary(ref, operation = 'Dictionary lookup') {
        try {
            return await withDeadline(ref.get(), cacheReadTimeoutMs, operation);
        } catch (error) {
            console.warn(`${operation} skipped.`, error.message);
            return null;
        }
    }

    async function writeDictionary(ref, value, options, operation = 'Dictionary write') {
        try {
            await withDeadline(ref.set(value, options), cacheWriteTimeoutMs, operation);
            return true;
        } catch (error) {
            console.warn(`${operation} did not delay the translation response.`, error.message);
            return false;
        }
    }

    async function callModel({ model, thinkingLevel, body, timeoutMs, operation, uid = 'system', metrics = {} }) {
        if (!apiKey) throw Object.assign(new Error('Server misconfiguration: GEMINI_API_KEY is missing.'), { status:500 });
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        const started = performance.now();
        let response; let data; let schemaFallbackUsed = false;
        try {
            const schema = responseSchema(body);
            const compatibilityKey = geminiCompatibilityKey(model, body);
            const preferredMode = successfulCompatibilityModes.get(compatibilityKey);
            const variants = buildGeminiCompatibilityRequests(body, thinkingLevel);
            if (preferredMode) variants.sort((left, right) => Number(right.mode === preferredMode) - Number(left.mode === preferredMode));
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
            const send = request => fetchImpl(endpoint, {
                method:'POST', signal:controller.signal,
                headers:{ 'Content-Type':'application/json', 'x-goog-api-key':apiKey },
                body:JSON.stringify(request)
            });
            let selectedMode = variants[0]?.mode || 'structured';
            let compatibilityRetries = 0;
            const rejectedModes = [];
            for (let index = 0; index < variants.length; index += 1) {
                const variant = variants[index];
                selectedMode = variant.mode;
                response = await send(variant.body);
                data = await response.json().catch(() => ({}));
                if (response.ok) {
                    compatibilityRetries = index;
                    successfulCompatibilityModes.set(compatibilityKey, selectedMode);
                    break;
                }
                if (!isGeminiInvalidArgument(response, data)) break;
                rejectedModes.push(selectedMode);
                compatibilityRetries = index + 1;
            }
            if (!response.ok) {
                if (isGeminiInvalidArgument(response, data)) {
                    console.warn('Gemini rejected every compatible request form.', {
                        model, operation, rejectedModes,
                        providerStatus:data?.error?.status || 'INVALID_ARGUMENT',
                        providerMessage:String(data?.error?.message || '').slice(0, 300)
                    });
                    const error = new Error('The translation model rejected its request configuration. Verify that Render uses the Tier 1 Gemini API key and the model variables shown in DEPLOYMENT.md.');
                    error.status = 502; error.code = 'MODEL_REQUEST_INVALID'; throw error;
                }
                const error = new Error(data?.error?.message || `Gemini request failed (${response.status}).`);
                error.status = response.status; error.code = 'MODEL_HTTP'; throw error;
            }
            schemaFallbackUsed = !!schema && selectedMode !== 'structured';
            const latencyMs = Math.round(performance.now() - started);
            const tokens = usageMetrics(data);
            recordUsage(uid, operation, {
                model, thinkingLevel, latencyMs, schemaFallbackUsed,
                compatibilityMode:selectedMode, compatibilityRetries, ...tokens, ...metrics
            }).catch(() => {});
            return { data, model, thinkingLevel, latencyMs, schemaFallbackUsed, compatibilityMode:selectedMode, compatibilityRetries, tokens };
        } catch (error) {
            if (error.name === 'AbortError') {
                const timeoutError = new Error(`${model} timed out after ${timeoutMs} ms.`);
                timeoutError.status = 504; timeoutError.code = 'MODEL_TIMEOUT'; throw timeoutError;
            }
            throw error;
        } finally { clearTimeout(timeout); }
    }

    async function modelJSON(options) {
        const response = await callModel(options);
        return { ...response, result:parseGeminiJSON(response.data) };
    }

    function parseStored(snapshot, context) {
        if (!snapshot?.exists) return null;
        const stored = snapshot.data();
        try {
            const raw = typeof stored.fullJSON === 'string' ? JSON.parse(stored.fullJSON) : stored.translation;
            const result = normalizeTranslationResult(raw, context);
            return { stored, result, updatedAt:timestampMillis(stored.updatedAt || stored.refreshedAt) };
        } catch (_) { return { stored, result:null, updatedAt:0 }; }
    }

    function parseStoredPreview(snapshot, context) {
        if (!snapshot?.exists) return null;
        const stored = snapshot.data();
        if (stored.previewJSON == null && stored.preview == null) return null;
        try {
            const raw = typeof stored.previewJSON === 'string' ? JSON.parse(stored.previewJSON) : stored.preview;
            const preview = normalizePreviewResult(raw, context);
            return {
                stored,
                preview,
                updatedAt:timestampMillis(stored.previewUpdatedAt),
                expiresAt:Number(stored.previewExpiresAt || 0)
            };
        } catch (_) { return null; }
    }

    async function savePreview(context, preview, metadata = {}) {
        const ref = dictionaryRef(context);
        const now = Date.now();
        const accepted = preview?.sourceLanguageValidation?.existsInRequestedLanguage === true
            && preview.wordExists === true;
        await writeDictionary(ref, {
            queryLower:normalizeDictionaryQuery(context.query),
            originalQuery:context.query,
            fromLang:context.fromLang,
            toLang:context.toLang,
            previewSchemaVersion:PREVIEW_SCHEMA_VERSION,
            previewJSON:JSON.stringify(preview),
            previewModel:metadata.model || '',
            previewFallbackModel:metadata.fallbackModel || '',
            previewFallbackUsed:metadata.fallbackUsed === true,
            previewFallbackReason:metadata.fallbackReason || '',
            previewUpdatedAt:now,
            previewExpiresAt:now + (accepted ? freshTtlMs : mismatchTtlMs)
        }, { merge:true }, 'Preview-cache write');
        return preview;
    }

    async function saveCachedResult(context, result, metadata = {}) {
        const ref = dictionaryRef(context);
        const previousSnapshot = await readDictionary(ref, 'Dictionary merge lookup');
        const previous = parseStored(previousSnapshot, context)?.result;
        const merged = metadata.preserveExamples === false ? result : mergeContextExamples(clone(result), previous);
        const now = Date.now();
        const contextsComplete = contextsAreComplete(merged, context);
        const accepted = merged?.sourceLanguageValidation?.existsInRequestedLanguage === true && merged.wordExists === true;
        const preview = previewFromCore(merged, context);
        await writeDictionary(ref, {
            queryLower:normalizeDictionaryQuery(context.query), originalQuery:context.query,
            fromLang:context.fromLang, toLang:context.toLang,
            schemaVersion:DICTIONARY_SCHEMA_VERSION, modelVersion:DICTIONARY_SCHEMA_VERSION,
            coreComplete:coreQualityIssues(merged, context).length === 0,
            contextsComplete, complete:contextsComplete,
            completenessScore:contextsComplete ? 100 : accepted ? 70 : 100,
            status:accepted ? (contextsComplete ? 'verified' : 'core_ready') : 'validated_negative',
            cacheKind:accepted ? 'translation' : 'language_validation',
            model:metadata.model || '', fallbackModel:metadata.fallbackModel || '',
            fallbackUsed:metadata.fallbackUsed === true, fallbackReason:metadata.fallbackReason || '',
            fullJSON:JSON.stringify(merged),
            updatedAt:now, refreshedAt:FieldValue.serverTimestamp(),
            expiresAt:now + (accepted ? freshTtlMs : mismatchTtlMs),
            staleUntil:now + (accepted ? staleTtlMs : mismatchTtlMs),
            previewSchemaVersion:PREVIEW_SCHEMA_VERSION,
            previewJSON:JSON.stringify(preview),
            previewModel:metadata.model || '',
            previewFallbackModel:metadata.fallbackModel || '',
            previewFallbackUsed:metadata.fallbackUsed === true,
            previewFallbackReason:metadata.fallbackReason || '',
            previewUpdatedAt:now,
            previewExpiresAt:now + (accepted ? freshTtlMs : mismatchTtlMs),
            useCount:FieldValue.increment(metadata.incrementUse === false ? 0 : 1)
        }, { merge:true }, 'Dictionary write');
        return merged;
    }

    async function generatePreview(context, uid) {
        const totalStart = performance.now();
        let primary; let fallback; let result; let primaryError;
        let issues = []; let fallbackReason = '';
        try {
            primary = await modelJSON({
                model:PRIMARY_MODEL,
                thinkingLevel:PRIMARY_THINKING,
                body:buildPreviewRequest(context),
                timeoutMs:previewPrimaryTimeoutMs,
                operation:'translation_preview_primary',
                uid,
                metrics:{ fromLang:context.fromLang, toLang:context.toLang }
            });
            const contradictions = rawLanguageContradictions(primary.result, context.fromLang);
            result = normalizePreviewResult(primary.result, context);
            issues = previewQualityIssues(result, context);
            const ambiguous = isGenuinelyAmbiguous(result);
            if (contradictions.length || ambiguous) {
                issues.push(...contradictions, ...(ambiguous ? ['genuine language ambiguity'] : []));
                fallbackReason = contradictions.length
                    ? 'preview_language_validation_contradiction'
                    : 'preview_language_ambiguity';
            }
        } catch (error) {
            primaryError = error;
            fallbackReason = error.code || 'preview_primary_failed';
        }

        if (!result || issues.length || primaryError) {
            const repairIssues = [
                ...issues,
                ...(primaryError ? [`primary request: ${primaryError.code || primaryError.message || 'failed'}`] : [])
            ];
            fallback = await modelJSON({
                model:FALLBACK_MODEL,
                thinkingLevel:FALLBACK_THINKING,
                body:buildPreviewRequest(context, result ? { repairSource:{ result, issues:repairIssues } } : undefined),
                timeoutMs:previewFallbackTimeoutMs,
                operation:'translation_preview_fallback',
                uid,
                metrics:{ fromLang:context.fromLang, toLang:context.toLang }
            });
            result = normalizePreviewResult(fallback.result, context);
            issues = previewQualityIssues(result, context);
            fallbackReason = fallbackReason || `preview_quality:${repairIssues.join('|')}`;
        }

        if (issues.length) {
            const error = new Error(`The translation preview was incomplete: ${issues.join(', ')}.`);
            error.status = 502;
            error.code = 'PREVIEW_SCHEMA_INCOMPLETE';
            throw error;
        }
        // Cache delivery is useful but must never delay the first visible answer.
        savePreview(context, result, {
            model:primary?.model || fallback?.model || '',
            fallbackModel:fallback?.model || '',
            fallbackUsed:!!fallback,
            fallbackReason
        }).catch(error => console.warn('Preview cache persistence failed.', error.message));
        const modelCalls = [primary, fallback].filter(Boolean);
        return {
            preview:result,
            meta:{
                phase:'preview',
                source:'generated',
                cacheStatus:'miss',
                previewSchemaVersion:PREVIEW_SCHEMA_VERSION,
                primaryModel:PRIMARY_MODEL,
                primaryThinking:PRIMARY_THINKING,
                fallbackModel:FALLBACK_MODEL,
                fallbackThinking:FALLBACK_THINKING,
                fallbackUsed:!!fallback,
                fallbackReason,
                latencyMs:Math.round(performance.now() - totalStart),
                modelCalls:modelCalls.map(call => ({
                    model:call.model,
                    thinkingLevel:call.thinkingLevel,
                    latencyMs:call.latencyMs,
                    schemaFallbackUsed:call.schemaFallbackUsed === true,
                    compatibilityMode:call.compatibilityMode,
                    compatibilityRetries:call.compatibilityRetries,
                    ...call.tokens
                }))
            }
        };
    }

    async function getPreview(context, uid) {
        const started = performance.now();
        const ref = dictionaryRef(context);
        const snapshot = await readDictionary(ref, 'Preview-cache lookup');
        const cacheLookupMs = Math.round(performance.now() - started);
        const now = Date.now();
        const cachedCore = parseStored(snapshot, context);
        if (cachedCore?.result) {
            const age = cachedCore.updatedAt ? now - cachedCore.updatedAt : Infinity;
            const accepted = cachedCore.result?.sourceLanguageValidation?.existsInRequestedLanguage === true
                && cachedCore.result.wordExists === true;
            const negativeExpiry = Number(cachedCore.stored?.expiresAt || 0);
            const derived = previewFromCore(cachedCore.result, context);
            if (age <= staleTtlMs && (accepted || negativeExpiry > now)
                && previewQualityIssues(derived, context).length === 0) {
                recordUsage(uid, 'translation_preview_cache_hit', {
                    cacheStatus:'full_dictionary', cacheLookupMs, latencyMs:cacheLookupMs,
                    fromLang:context.fromLang, toLang:context.toLang
                }).catch(() => {});
                return {
                    preview:derived,
                    meta:{
                        phase:'preview',
                        source:'global_dictionary',
                        cacheStatus:age <= freshTtlMs ? 'fresh' : 'stale',
                        previewSchemaVersion:PREVIEW_SCHEMA_VERSION,
                        cacheLookupMs,
                        latencyMs:cacheLookupMs,
                        fallbackUsed:false,
                        modelCalls:[]
                    }
                };
            }
        }

        const cachedPreview = parseStoredPreview(snapshot, context);
        if (cachedPreview?.preview
            && Number(cachedPreview.stored?.previewSchemaVersion || 0) >= PREVIEW_SCHEMA_VERSION
            && cachedPreview.expiresAt > now
            && previewQualityIssues(cachedPreview.preview, context).length === 0) {
            recordUsage(uid, 'translation_preview_cache_hit', {
                cacheStatus:'preview', cacheLookupMs, latencyMs:cacheLookupMs,
                fromLang:context.fromLang, toLang:context.toLang
            }).catch(() => {});
            return {
                preview:cachedPreview.preview,
                meta:{
                    phase:'preview',
                    source:'preview_cache',
                    cacheStatus:'fresh',
                    previewSchemaVersion:PREVIEW_SCHEMA_VERSION,
                    cacheLookupMs,
                    latencyMs:cacheLookupMs,
                    fallbackUsed:false,
                    modelCalls:[]
                }
            };
        }

        const flightKey = dictionaryIdentity(context.query, context.fromLang, context.toLang);
        const generated = await singleFlight(previewFlights, flightKey, () => generatePreview(context, uid));
        generated.meta.cacheLookupMs = cacheLookupMs;
        generated.meta.latencyMs = Math.round(performance.now() - started);
        return generated;
    }

    async function generateCore(context, uid, prior = null) {
        const totalStart = performance.now();
        let primary; let primaryParsed; let primaryError; let fallbackReason = '';
        let conjugationRepair;
        const contradictionsBefore = [];
        const onlyConjugationIssues = issues => issues.length > 0 && issues.every(issue =>
            issue === 'missing language-specific conjugations'
            || issue.startsWith('incomplete conjugation coverage:')
        );
        const repairConjugations = async (candidate, candidateIssues) => {
            if (!candidate?.isVerb || !onlyConjugationIssues(candidateIssues)) {
                return { result:candidate, issues:candidateIssues, repaired:false };
            }
            try {
                conjugationRepair = await modelJSON({
                    model:FALLBACK_MODEL,
                    thinkingLevel:FALLBACK_THINKING,
                    body:buildConjugationRepairRequest(context, candidate, candidateIssues),
                    timeoutMs:fallbackTimeoutMs,
                    operation:'translation_conjugation_repair',
                    uid,
                    metrics:{ fromLang:context.fromLang, toLang:context.toLang }
                });
                const repaired = normalizeTranslationResult({
                    ...candidate,
                    isVerb:true,
                    conjugationGroups:conjugationRepair.result?.conjugationGroups
                }, context);
                const repairedIssues = coreQualityIssues(repaired, context);
                return { result:repaired, issues:repairedIssues, repaired:repairedIssues.length === 0 };
            } catch (error) {
                console.warn('Focused conjugation repair failed; the complete fallback will be used.', error.message);
                return { result:candidate, issues:candidateIssues, repaired:false };
            }
        };
        try {
            primary = await modelJSON({
                model:PRIMARY_MODEL, thinkingLevel:PRIMARY_THINKING,
                body:buildCoreRequest(context), timeoutMs:primaryTimeoutMs,
                operation:'translation_core_primary', uid,
                metrics:{ fromLang:context.fromLang, toLang:context.toLang }
            });
            primaryParsed = primary.result;
        } catch (error) { primaryError = error; fallbackReason = error.code || 'primary_request_failed'; }

        let result; let fallback; let issues = [];
        if (primaryParsed) {
            try {
                contradictionsBefore.push(...rawLanguageContradictions(primaryParsed, context.fromLang));
                result = normalizeTranslationResult(primaryParsed, context);
                issues = coreQualityIssues(result, context);
                const ambiguous = isGenuinelyAmbiguous(result);
                if (contradictionsBefore.length || ambiguous) {
                    fallbackReason = contradictionsBefore.length ? 'language_validation_contradiction' : 'genuine_language_ambiguity';
                    try {
                        fallback = await modelJSON({
                            model:FALLBACK_MODEL, thinkingLevel:FALLBACK_THINKING,
                            body:buildValidationRequest(context, result, contradictionsBefore), timeoutMs:fallbackTimeoutMs,
                            operation:'translation_validation_fallback', uid,
                            metrics:{ fromLang:context.fromLang, toLang:context.toLang }
                        });
                        result.sourceLanguageValidation = fallback.result;
                        result = normalizeTranslationResult(result, context);
                        issues = coreQualityIssues(result, context);
                    } catch (error) {
                        primaryError = error;
                    }
                }
            } catch (error) {
                primaryError = error;
                fallbackReason = 'primary_schema_validation_failed';
                result = null;
            }
        }

        if (result && issues.length && !primaryError) {
            const repaired = await repairConjugations(result, issues);
            result = repaired.result;
            issues = repaired.issues;
            if (repaired.repaired) fallbackReason = 'conjugation_coverage_repair';
        }

        if (!result || issues.length || primaryError) {
            fallbackReason = fallbackReason || (issues.length ? `core_quality:${issues.join('|')}` : 'primary_parse_or_schema_failure');
            fallback = await modelJSON({
                model:FALLBACK_MODEL, thinkingLevel:FALLBACK_THINKING,
                body:buildCoreRequest(context, result ? { result, issues } : undefined), timeoutMs:fallbackTimeoutMs,
                operation:'translation_core_fallback', uid,
                metrics:{ fromLang:context.fromLang, toLang:context.toLang }
            });
            result = normalizeTranslationResult(fallback.result, context);
            issues = coreQualityIssues(result, context);
        }

        if (result && issues.length) {
            const repaired = await repairConjugations(result, issues);
            result = repaired.result;
            issues = repaired.issues;
            if (repaired.repaired) {
                fallbackReason = fallbackReason
                    ? `${fallbackReason}|conjugation_coverage_repair`
                    : 'conjugation_coverage_repair';
            }
        }

        if (issues.length) {
            const error = new Error(`The linguistic response was incomplete: ${issues.join(', ')}.`);
            error.status = 502; error.code = 'MODEL_SCHEMA_INCOMPLETE'; throw error;
        }
        if (prior) result = mergeContextExamples(result, prior);
        result = await saveCachedResult(context, result, {
            model:primary?.model || fallback?.model || conjugationRepair?.model,
            fallbackModel:fallback?.model || conjugationRepair?.model || '',
            fallbackUsed:!!fallback || !!conjugationRepair,
            fallbackReason
        });
        return {
            result,
            meta:{
                source:prior ? 'dictionary_repair' : 'generated', cacheStatus:'miss',
                schemaVersion:DICTIONARY_SCHEMA_VERSION,
                primaryModel:PRIMARY_MODEL, primaryThinking:PRIMARY_THINKING,
                fallbackModel:FALLBACK_MODEL, fallbackThinking:FALLBACK_THINKING,
                fallbackUsed:!!fallback || !!conjugationRepair, fallbackReason,
                contextsReady:contextsAreComplete(result, context),
                latencyMs:Math.round(performance.now() - totalStart),
                modelCalls:[primary, fallback, conjugationRepair].filter(Boolean).map(call => ({
                    model:call.model, thinkingLevel:call.thinkingLevel, latencyMs:call.latencyMs,
                    schemaFallbackUsed:call.schemaFallbackUsed === true,
                    compatibilityMode:call.compatibilityMode, compatibilityRetries:call.compatibilityRetries,
                    ...call.tokens
                }))
            }
        };
    }

    async function getCore(context, uid, { forceRefresh = false, touch = true } = {}) {
        const started = performance.now();
        const ref = dictionaryRef(context);
        const snapshot = await readDictionary(ref);
        const cacheLookupMs = Math.round(performance.now() - started);
        const cached = parseStored(snapshot, context);
        const cachedIssues = cached?.result ? coreQualityIssues(cached.result, context) : ['cache miss'];
        const age = cached?.updatedAt ? Date.now() - cached.updatedAt : Infinity;
        const cachedSchemaVersion = Number(cached?.stored?.schemaVersion || 0);
        const needsSchemaRefresh = cachedSchemaVersion < DICTIONARY_SCHEMA_VERSION;
        const upgradeOnlyIssues = new Set([
            'invalid learning metadata', 'missing source learning note', 'missing target learning note'
        ]);
        // Learning metadata was introduced in schema v12. A structurally sound older
        // non-verb may still render immediately while its background refresh upgrades
        // it. Missing schema-v13 conjugation coverage and schema-v14 per-meaning
        // grammatical classifications remain blocking.
        const cacheBlockingIssues = needsSchemaRefresh
            ? cachedIssues.filter(issue => !upgradeOnlyIssues.has(issue))
            : cachedIssues;
        const negativeExpiry = Number(cached?.stored?.expiresAt || 0);
        const cacheUsable = cached?.result && cacheBlockingIssues.length === 0
            && (cached.result.sourceLanguageValidation?.existsInRequestedLanguage !== false || negativeExpiry > Date.now());

        if (!forceRefresh && cacheUsable && age <= freshTtlMs && !needsSchemaRefresh) {
            if (touch) {
                ref.update({ useCount:FieldValue.increment(1), lastUsedAt:Date.now() }).catch(() => {});
                recordUsage(uid, 'translation_cache_hit', {
                    cacheStatus:'fresh', cacheLookupMs, latencyMs:cacheLookupMs,
                    fromLang:context.fromLang, toLang:context.toLang
                }).catch(() => {});
            }
            return { result:cached.result, meta:{ source:'global_dictionary', cacheStatus:'fresh', schemaVersion:cachedSchemaVersion, contextsReady:contextsAreComplete(cached.result, context), staleRefreshStarted:false, cacheLookupMs, latencyMs:cacheLookupMs, fallbackUsed:false, modelCalls:[] } };
        }

        if (!forceRefresh && cacheUsable && age <= staleTtlMs) {
            const flightKey = dictionaryIdentity(context.query, context.fromLang, context.toLang);
            singleFlight(coreFlights, flightKey, () => generateCore(context, 'stale-refresh', cached.result))
                .catch(error => console.warn('Stale dictionary refresh failed.', error.message));
            if (touch) {
                ref.update({ useCount:FieldValue.increment(1), lastUsedAt:Date.now() }).catch(() => {});
                recordUsage(uid, 'translation_cache_hit', {
                    cacheStatus:needsSchemaRefresh ? 'schema_upgrade' : 'stale',
                    cacheLookupMs, latencyMs:cacheLookupMs,
                    fromLang:context.fromLang, toLang:context.toLang
                }).catch(() => {});
            }
            return { result:cached.result, meta:{ source:'global_dictionary', cacheStatus:needsSchemaRefresh ? 'schema_upgrade' : 'stale', schemaVersion:cachedSchemaVersion, contextsReady:contextsAreComplete(cached.result, context), staleRefreshStarted:true, cacheLookupMs, latencyMs:cacheLookupMs, fallbackUsed:false, modelCalls:[] } };
        }

        const flightKey = dictionaryIdentity(context.query, context.fromLang, context.toLang);
        const generated = await singleFlight(coreFlights, flightKey, () => generateCore(context, uid, cached?.result));
        generated.meta.cacheLookupMs = cacheLookupMs;
        generated.meta.latencyMs = Math.round(performance.now() - started);
        return generated;
    }

    async function generateContextExamples(context, coreResult, contextItem, count, uid) {
        let primary; let examples; let issues = [];
        try {
            primary = await modelJSON({
                model:PRIMARY_MODEL, thinkingLevel:PRIMARY_THINKING,
                body:buildExamplesRequest(context, coreResult, contextItem, count), timeoutMs:primaryTimeoutMs,
                operation:'translation_examples_primary', uid,
                metrics:{ fromLang:context.fromLang, toLang:context.toLang }
            });
            examples = Array.isArray(primary.result?.examples) ? primary.result.examples.slice(0, count) : [];
            if (examples.length !== count) issues.push(`expected ${count} examples, received ${examples.length}`);
            examples.forEach((example, index) => issues.push(...exampleQualityIssues(example, context).map(issue => `example ${index + 1}: ${issue}`)));
        } catch (error) { issues = [error.code || error.message || 'example request failed']; }

        let fallback;
        if (issues.length) {
            fallback = await modelJSON({
                model:FALLBACK_MODEL, thinkingLevel:FALLBACK_THINKING,
                body:buildExamplesRequest(context, coreResult, contextItem, count, { repairIssues:issues }), timeoutMs:fallbackTimeoutMs,
                operation:'translation_examples_fallback', uid,
                metrics:{ fromLang:context.fromLang, toLang:context.toLang }
            });
            examples = Array.isArray(fallback.result?.examples) ? fallback.result.examples.slice(0, count) : [];
            issues = [];
            if (examples.length !== count) issues.push(`expected ${count} examples, received ${examples.length}`);
            examples.forEach((example, index) => issues.push(...exampleQualityIssues(example, context).map(issue => `example ${index + 1}: ${issue}`)));
        }
        if (issues.length) {
            const error = new Error(`Context examples were incomplete: ${issues.join(', ')}.`);
            error.status = 502; error.code = 'EXAMPLES_INCOMPLETE'; throw error;
        }
        return {
            context:{ ...contextItem, examples:examples.map(example => ({ ...example, distractors:[] })) },
            modelCalls:[primary, fallback].filter(Boolean), fallbackUsed:!!fallback,
            fallbackReason:fallback ? 'incomplete_or_truncated_examples' : ''
        };
    }

    async function getContexts(context, uid) {
        const started = performance.now();
        const coreResponse = await getCore(context, uid, { touch:false });
        const coreResult = coreResponse.result;
        if (!coreResult?.sourceLanguageValidation?.existsInRequestedLanguage || !coreResult.wordExists) {
            return { contexts:[], meta:{ ...coreResponse.meta, contextsReady:true, latencyMs:Math.round(performance.now() - started) } };
        }
        if (contextsAreComplete(coreResult, context)) {
            return { contexts:coreResult.contexts, meta:{ source:'global_dictionary', cacheStatus:'fresh', contextsReady:true, latencyMs:Math.round(performance.now() - started), fallbackUsed:false, modelCalls:[] } };
        }
        const key = `${dictionaryIdentity(context.query, context.fromLang, context.toLang)}|contexts`;
        return singleFlight(exampleFlights, key, async () => {
            const count = examplesPerContext(coreResult.contexts.length);
            const generated = await Promise.all(coreResult.contexts.map(item => generateContextExamples(context, coreResult, item, count, uid)));
            const completed = { ...coreResult, contexts:generated.map(item => item.context) };
            const saved = await saveCachedResult(context, completed, {
                model:PRIMARY_MODEL, fallbackModel:generated.some(item => item.fallbackUsed) ? FALLBACK_MODEL : '',
                fallbackUsed:generated.some(item => item.fallbackUsed),
                fallbackReason:generated.filter(item => item.fallbackReason).map(item => item.fallbackReason).join(','),
                preserveExamples:false, incrementUse:false
            });
            const calls = generated.flatMap(item => item.modelCalls).map(call => ({
                model:call.model, thinkingLevel:call.thinkingLevel, latencyMs:call.latencyMs,
                schemaFallbackUsed:call.schemaFallbackUsed === true,
                compatibilityMode:call.compatibilityMode, compatibilityRetries:call.compatibilityRetries,
                ...call.tokens
            }));
            return {
                contexts:saved.contexts,
                meta:{ source:'generated', cacheStatus:'miss', contextsReady:true,
                    fallbackUsed:generated.some(item => item.fallbackUsed),
                    fallbackReason:generated.filter(item => item.fallbackReason).map(item => item.fallbackReason).join(','),
                    latencyMs:Math.round(performance.now() - started), modelCalls:calls }
            };
        });
    }

    async function getDistractors(context, uid) {
        const correctKey = normalizeDictionaryQuery(context.correct);
        const key = crypto.createHash('sha256').update(JSON.stringify({ ...context, correct:correctKey })).digest('hex');
        return singleFlight(distractorFlights, key, async () => {
            let response;
            try {
                response = await modelJSON({
                    model:PRIMARY_MODEL, thinkingLevel:PRIMARY_THINKING,
                    body:buildDistractorRequest(context), timeoutMs:primaryTimeoutMs,
                    operation:'game_distractors_primary', uid,
                    metrics:{ fromLang:context.fromLang, toLang:context.toLang }
                });
            } catch (_) {
                response = await modelJSON({
                    model:FALLBACK_MODEL, thinkingLevel:FALLBACK_THINKING,
                    body:buildDistractorRequest(context), timeoutMs:fallbackTimeoutMs,
                    operation:'game_distractors_fallback', uid,
                    metrics:{ fromLang:context.fromLang, toLang:context.toLang }
                });
            }
            const distractors = cleanTextArray(response.result?.distractors, 4)
                .filter(value => normalizeDictionaryQuery(value) !== correctKey).slice(0, context.count || 4);
            if (distractors.length < Math.min(2, context.count || 4)) throw Object.assign(new Error('Not enough realistic distractors were generated.'), { status:502 });
            return { distractors, meta:{
                model:response.model, thinkingLevel:response.thinkingLevel, latencyMs:response.latencyMs,
                compatibilityMode:response.compatibilityMode, compatibilityRetries:response.compatibilityRetries,
                ...response.tokens
            } };
        });
    }

    return {
        getPreview, getCore, getContexts, getDistractors, saveCachedResult,
        models:{ primary:PRIMARY_MODEL, primaryThinking:PRIMARY_THINKING, fallback:FALLBACK_MODEL, fallbackThinking:FALLBACK_THINKING },
        cache:{ freshTtlMs, staleTtlMs, mismatchTtlMs, cacheReadTimeoutMs, cacheWriteTimeoutMs },
        previewSchemaVersion:PREVIEW_SCHEMA_VERSION
    };
}
