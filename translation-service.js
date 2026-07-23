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

export const DICTIONARY_SCHEMA_VERSION = 11;
export const PREVIEW_SCHEMA_VERSION = 2;
export const PRIMARY_MODEL = process.env.GEMINI_PRIMARY_MODEL || 'gemini-3.1-flash-lite';
export const PRIMARY_THINKING = process.env.GEMINI_PRIMARY_THINKING || 'minimal';
export const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.5-flash';
export const FALLBACK_THINKING = process.env.GEMINI_FALLBACK_THINKING || 'low';

const ORDINARY_USAGE = new Set(['standard', 'common', 'specialized']);
const NON_QUALIFYING_USAGE = new Set(['rare', 'archaic', 'abbreviation', 'fragment', 'proper-name', 'offensive-clipping', 'invalid']);
const conjugationInventory = rows => Object.freeze(rows.map(([categoryKey, referenceLabel, minForms = 1]) =>
    Object.freeze({ categoryKey, referenceLabel, minForms })));

// These are coverage contracts, not universal claims that every language
// grammaticalises tense in the same way. Languages without tense inflection
// use their natural aspect, mood, politeness or construction inventory instead.
export const CONJUGATION_INVENTORIES = Object.freeze({
    EN:conjugationInventory([
        ['present_simple','Present simple',6], ['present_continuous','Present continuous',6],
        ['present_perfect','Present perfect',6], ['present_perfect_continuous','Present perfect continuous',6],
        ['past_simple','Past simple',6], ['past_continuous','Past continuous',6],
        ['past_perfect','Past perfect',6], ['past_perfect_continuous','Past perfect continuous',6],
        ['future_simple','Future simple',6], ['future_continuous','Future continuous',6],
        ['future_perfect','Future perfect',6], ['future_perfect_continuous','Future perfect continuous',6],
        ['conditional_present','Present conditional',6], ['conditional_perfect','Perfect conditional',6],
        ['imperative','Imperative',1], ['non_finite_forms','Infinitives, gerund and participles',3]
    ]),
    FR:conjugationInventory([
        ['indicatif_present','Indicatif présent',6], ['indicatif_imparfait','Indicatif imparfait',6],
        ['indicatif_passe_simple','Indicatif passé simple',6], ['indicatif_futur_simple','Indicatif futur simple',6],
        ['indicatif_passe_compose','Indicatif passé composé',6], ['indicatif_plus_que_parfait','Indicatif plus-que-parfait',6],
        ['indicatif_passe_anterieur','Indicatif passé antérieur',6], ['indicatif_futur_anterieur','Indicatif futur antérieur',6],
        ['subjonctif_present','Subjonctif présent',6], ['subjonctif_passe','Subjonctif passé',6],
        ['subjonctif_imparfait','Subjonctif imparfait (littéraire)',6],
        ['subjonctif_plus_que_parfait','Subjonctif plus-que-parfait (littéraire)',6],
        ['conditionnel_present','Conditionnel présent',6], ['conditionnel_passe_1','Conditionnel passé, première forme',6],
        ['conditionnel_passe_2','Conditionnel passé, deuxième forme (littéraire)',6],
        ['imperatif_present','Impératif présent',3], ['imperatif_passe','Impératif passé',3],
        ['infinitif_present','Infinitif présent',1], ['infinitif_passe','Infinitif passé',1],
        ['participe_present','Participe présent',1], ['participe_passe','Participe passé et composé',1],
        ['gerondif_present','Gérondif présent',1], ['gerondif_passe','Gérondif passé',1]
    ]),
    ES:conjugationInventory([
        ['indicativo_presente','Indicativo presente',6], ['indicativo_imperfecto','Indicativo pretérito imperfecto',6],
        ['indicativo_preterito','Indicativo pretérito perfecto simple',6], ['indicativo_futuro','Indicativo futuro simple',6],
        ['condicional_simple','Condicional simple',6], ['indicativo_perfecto_compuesto','Indicativo pretérito perfecto compuesto',6],
        ['indicativo_pluscuamperfecto','Indicativo pluscuamperfecto',6], ['indicativo_preterito_anterior','Indicativo pretérito anterior (literario)',6],
        ['indicativo_futuro_perfecto','Indicativo futuro perfecto',6], ['condicional_compuesto','Condicional compuesto',6],
        ['subjuntivo_presente','Subjuntivo presente',6], ['subjuntivo_imperfecto','Subjuntivo pretérito imperfecto (-ra y -se)',6],
        ['subjuntivo_futuro','Subjuntivo futuro (raro/jurídico)',6], ['subjuntivo_perfecto','Subjuntivo pretérito perfecto',6],
        ['subjuntivo_pluscuamperfecto','Subjuntivo pluscuamperfecto',6], ['subjuntivo_futuro_perfecto','Subjuntivo futuro perfecto (raro)',6],
        ['imperativo_afirmativo','Imperativo afirmativo',3], ['imperativo_negativo','Imperativo negativo',3],
        ['infinitivo_simple','Infinitivo simple',1], ['infinitivo_compuesto','Infinitivo compuesto',1],
        ['gerundio_simple','Gerundio simple',1], ['gerundio_compuesto','Gerundio compuesto',1],
        ['participio','Participio',1]
    ]),
    DE:conjugationInventory([
        ['indikativ_praesens','Indikativ Präsens',6], ['indikativ_praeteritum','Indikativ Präteritum',6],
        ['indikativ_perfekt','Indikativ Perfekt',6], ['indikativ_plusquamperfekt','Indikativ Plusquamperfekt',6],
        ['indikativ_futur_1','Indikativ Futur I',6], ['indikativ_futur_2','Indikativ Futur II',6],
        ['konjunktiv_1_praesens','Konjunktiv I Präsens',6], ['konjunktiv_1_perfekt','Konjunktiv I Perfekt',6],
        ['konjunktiv_1_futur','Konjunktiv I Futur I und II',6], ['konjunktiv_2_praeteritum','Konjunktiv II Präteritum',6],
        ['konjunktiv_2_plusquamperfekt','Konjunktiv II Plusquamperfekt',6], ['wuerde_form','Konjunktiv II würde-Form',6],
        ['imperativ','Imperativ',3], ['infinitive','Infinitiv I und II',2], ['partizipien','Partizip I und II',2]
    ]),
    IT:conjugationInventory([
        ['indicativo_presente','Indicativo presente',6], ['indicativo_imperfetto','Indicativo imperfetto',6],
        ['indicativo_passato_remoto','Indicativo passato remoto',6], ['indicativo_futuro_semplice','Indicativo futuro semplice',6],
        ['indicativo_passato_prossimo','Indicativo passato prossimo',6], ['indicativo_trapassato_prossimo','Indicativo trapassato prossimo',6],
        ['indicativo_trapassato_remoto','Indicativo trapassato remoto',6], ['indicativo_futuro_anteriore','Indicativo futuro anteriore',6],
        ['congiuntivo_presente','Congiuntivo presente',6], ['congiuntivo_imperfetto','Congiuntivo imperfetto',6],
        ['congiuntivo_passato','Congiuntivo passato',6], ['congiuntivo_trapassato','Congiuntivo trapassato',6],
        ['condizionale_presente','Condizionale presente',6], ['condizionale_passato','Condizionale passato',6],
        ['imperativo','Imperativo',3], ['infinito_presente','Infinito presente',1], ['infinito_passato','Infinito passato',1],
        ['participio_presente','Participio presente',1], ['participio_passato','Participio passato',1],
        ['gerundio_presente','Gerundio presente',1], ['gerundio_passato','Gerundio passato',1]
    ]),
    PT:conjugationInventory([
        ['indicativo_presente','Indicativo presente',6], ['indicativo_preterito_imperfeito','Indicativo pretérito imperfeito',6],
        ['indicativo_preterito_perfeito','Indicativo pretérito perfeito',6], ['indicativo_mais_que_perfeito','Indicativo pretérito mais-que-perfeito',6],
        ['indicativo_futuro_presente','Indicativo futuro do presente',6], ['condicional_futuro_preterito','Futuro do pretérito / condicional',6],
        ['indicativo_perfeito_composto','Indicativo pretérito perfeito composto',6], ['indicativo_mais_que_perfeito_composto','Indicativo mais-que-perfeito composto',6],
        ['indicativo_futuro_composto','Indicativo futuro composto',6], ['condicional_composto','Condicional composto',6],
        ['subjuntivo_presente','Subjuntivo presente',6], ['subjuntivo_imperfeito','Subjuntivo pretérito imperfeito',6],
        ['subjuntivo_futuro','Subjuntivo futuro',6], ['subjuntivo_perfeito','Subjuntivo pretérito perfeito',6],
        ['subjuntivo_mais_que_perfeito','Subjuntivo mais-que-perfeito',6], ['subjuntivo_futuro_composto','Subjuntivo futuro composto',6],
        ['imperativo_afirmativo','Imperativo afirmativo',3], ['imperativo_negativo','Imperativo negativo',3],
        ['infinitivo_impessoal','Infinitivo impessoal simples e composto',2], ['infinitivo_pessoal','Infinitivo pessoal simples',6],
        ['infinitivo_pessoal_composto','Infinitivo pessoal composto',6], ['gerundio','Gerúndio simples e composto',2],
        ['participio','Particípio',1]
    ]),
    ZH:conjugationInventory([
        ['invariant_base','不变的动词原形 / invariant base form',1], ['perfective_le','完成体 了',1],
        ['experiential_guo','经历体 过',1], ['progressive_zai','进行体 在／正在',1],
        ['durative_zhe','持续体 着',1], ['future_constructions','将来表达 会／将／要',1],
        ['negation_aspect','否定与体 貌（不／没）',2]
    ]),
    JA:conjugationInventory([
        ['plain_nonpast','普通形・非過去',1], ['plain_past','普通形・過去',1],
        ['plain_negative','普通形・否定',1], ['plain_negative_past','普通形・否定過去',1],
        ['polite_nonpast','丁寧形・非過去',1], ['polite_past','丁寧形・過去',1],
        ['te_form','て形',1], ['progressive_resultative','進行・結果状態（ている）',1],
        ['potential','可能形',1], ['passive','受身形',1], ['causative','使役形',1],
        ['causative_passive','使役受身形',1], ['volitional','意向形',1],
        ['imperative_prohibitive','命令形・禁止形',2], ['conditionals','条件形（ば・たら・と・なら）',4],
        ['desiderative','希望形（たい）',1]
    ]),
    KO:conjugationInventory([
        ['dictionary_form','기본형',1], ['informal_polite_present','해요체 현재',1],
        ['informal_polite_past','해요체 과거',1], ['informal_polite_future','해요체 미래/추측',1],
        ['formal_polite_present','하십시오체 현재',1], ['formal_polite_past','하십시오체 과거',1],
        ['formal_polite_future','하십시오체 미래/추측',1], ['progressive','진행상',1],
        ['perfect_resultative','완료/결과상',1], ['imperative','명령형',1],
        ['propositive','청유형',1], ['conditional','조건형',1], ['connective_forms','연결 어미',2],
        ['honorific','높임형',1], ['passive_causative','피동형·사동형',2]
    ]),
    RU:conjugationInventory([
        ['infinitive_aspect','Инфинитив и видовая пара',1], ['present_imperfective','Настоящее время несовершенного вида',6],
        ['past','Прошедшее время',4], ['future_imperfective','Сложное будущее несовершенного вида',6],
        ['future_perfective','Простое будущее совершенного вида',6], ['imperative','Повелительное наклонение',2],
        ['conditional','Условное наклонение',4], ['active_participles','Действительные причастия',1],
        ['passive_participles','Страдательные причастия',1], ['adverbial_participles','Деепричастия',1]
    ]),
    AR:conjugationInventory([
        ['perfect_active','الماضي المعلوم',6], ['perfect_passive','الماضي المجهول',6],
        ['imperfect_indicative','المضارع المرفوع',6], ['imperfect_subjunctive','المضارع المنصوب',6],
        ['imperfect_jussive','المضارع المجزوم',6], ['imperfect_passive','المضارع المجهول',6],
        ['future','المستقبل',6], ['imperative','الأمر',3], ['prohibitive','النهي',3],
        ['non_finite','المصدر واسم الفاعل واسم المفعول',3]
    ]),
    SW:conjugationInventory([
        ['infinitive','Kitenzi jina',1], ['present','Wakati wa sasa -na-',6],
        ['habitual','Hali ya mazoea hu-',1], ['present_perfect','Wakati timilifu -me-',6],
        ['past','Wakati uliopita -li-',6], ['past_perfect','Wakati uliopita timilifu',3],
        ['future','Wakati ujao -ta-',6], ['conditional','Masharti -nge-',6],
        ['past_conditional','Masharti yasiyotimia -ngali-',6], ['subjunctive','Hali tegemezi',3],
        ['imperative','Amri',2], ['negative_present','Sasa ya kukanusha',6],
        ['negative_past','Uliopita wa kukanusha',6], ['negative_future','Ujao wa kukanusha',6],
        ['relative_forms','Miundo ya urejeshi/uhusiano',2]
    ])
});

export function conjugationInventoryFor(languageCode) {
    return CONJUGATION_INVENTORIES[cleanCode(languageCode)] || [];
}

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
        formality:{ type:'string', enum:['', ...REGISTER_VALUES] },
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
                    categoryKey:{ type:'string' }, label:{ type:'string' },
                    forms:textArray(32), note:{ type:'string' }
                },
                required:['categoryKey', 'label', 'forms', 'note']
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
        'partOfSpeech', 'formality', 'mainTranslation', 'pronunciationGuide', 'etymology', 'isVerb',
        'conjugationGroups', 'definitions', 'synonyms', 'similarPhrases', 'meanings', 'collocations',
        'usageWarnings', 'grammarNotes', 'regionalVariants', 'wordFamily', 'minimalPairs', 'contexts'
    ]
});

export const VALIDATION_RESPONSE_SCHEMA = Object.freeze({
    type:'object', additionalProperties:false,
    properties:CORE_RESPONSE_SCHEMA.properties.sourceLanguageValidation.properties,
    required:CORE_RESPONSE_SCHEMA.properties.sourceLanguageValidation.required
});

// The preview contract is intentionally small enough for Gemini's constrained
// structured-output mode. It contains only what Qelumi needs for a useful first
// paint while the complete dictionary response is generated independently.
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
        formality:{ type:'string', enum:['', ...REGISTER_VALUES] },
        mainTranslation:textArray(4),
        pronunciationGuide:{ type:'string' },
        previewMeaning:{
            type:'object', additionalProperties:false,
            properties:{
                partOfSpeech:{ type:'string' },
                register:{ type:'string', enum:['', ...REGISTER_VALUES] },
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

function requestedConjugationInventory(languageCode, categoryKeys = null) {
    const inventory = conjugationInventoryFor(languageCode);
    if (!Array.isArray(categoryKeys) || !categoryKeys.length) return inventory;
    const requested = new Set(categoryKeys);
    return inventory.filter(item => requested.has(item.categoryKey));
}

export function conjugationResponseSchema(languageCode, categoryKeys = null) {
    const inventory = requestedConjugationInventory(languageCode, categoryKeys);
    return {
        type:'object', additionalProperties:false,
        properties:{
            conjugationGroups:{
                type:'array', minItems:inventory.length, maxItems:inventory.length,
                items:{
                    type:'object', additionalProperties:false,
                    properties:{
                        categoryKey:{ type:'string', enum:inventory.map(item => item.categoryKey) },
                        label:{ type:'string' }, forms:textArray(32), note:{ type:'string' }
                    },
                    required:['categoryKey', 'label', 'forms', 'note']
                }
            }
        },
        required:['conjugationGroups']
    };
}

const hasText = value => typeof value === 'string' && value.trim().length > 0;
const cleanText = value => typeof value === 'string' ? value.trim() : '';
const cleanTextArray = (value, limit = 20) => Array.isArray(value)
    ? [...new Set(value.map(cleanText).filter(Boolean))].slice(0, limit) : [];
// Conjugation paradigms may legitimately repeat the same surface form for
// different grammatical persons. Preserve those rows instead of applying the
// lexical-list de-duplication used by synonyms and translations.
const cleanConjugationForms = (value, limit = 32) => Array.isArray(value)
    ? value.map(cleanText).filter(Boolean).slice(0, limit) : [];
const GRAMMATICAL_LABEL_MARKERS = Object.freeze([
    'noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction',
    'interjection', 'determiner', 'article', 'numeral', 'particle', 'auxiliary',
    'proper noun', 'phrasal verb', 'nom', 'verbe', 'adjectif', 'adverbe', 'pronom',
    'préposition', 'conjonction', 'déterminant', 'sustantivo', 'verbo', 'adjetivo',
    'adverbio', 'pronombre', 'preposición', 'conjunción', 'substantiv', 'nomen',
    'zeitwort', 'adjektiv', 'adverb', 'nome', 'verbo', 'aggettivo', 'substantivo'
]);
const escapeRegularExpression = value => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

export function normalizeMeaningLabel(value, partOfSpeech = '') {
    const original = cleanText(value).replace(/_+/gu, ' ').replace(/\s+/gu, ' ');
    if (!original) return '';
    const markers = [...new Set([
        ...GRAMMATICAL_LABEL_MARKERS,
        ...String(partOfSpeech || '').split(/[·,/&]+/u).map(cleanText).filter(Boolean)
    ].map(marker => marker.toLocaleLowerCase('en')))]
        .sort((left, right) => right.length - left.length);
    const isGrammaticalDescription = valueToCheck => {
        const normalized = cleanText(valueToCheck).toLocaleLowerCase('en');
        return markers.some(marker => normalized === marker
            || normalized.startsWith(`${marker} `)
            || normalized.endsWith(` ${marker}`));
    };

    let label = original.replace(/\s*[\[(]([^)\]]+)[)\]]\s*$/u, (match, inner) =>
        isGrammaticalDescription(inner) ? '' : match).trim();
    for (const marker of markers) {
        const escaped = escapeRegularExpression(marker);
        label = label
            .replace(new RegExp(`^${escaped}(?:\\s*[:–—|/-]\\s*|\\s+)`, 'iu'), '')
            .replace(new RegExp(`(?:\\s*[:–—|/-]\\s*|\\s+)${escaped}$`, 'iu'), '')
            .trim();
    }
    if (!label) return original;
    return label.charAt(0).toLocaleUpperCase() + label.slice(1);
}
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
        categoryKey:cleanText(group?.categoryKey),
        label:cleanText(group?.label || group?.tense),
        forms:cleanConjugationForms(group?.forms, 32),
        note:cleanText(group?.note)
    })).filter(group => {
        const key = group.categoryKey || group.label.toLocaleLowerCase('en');
        if (!key || !group.forms.length || seen.has(key)) return false;
        seen.add(key); return true;
    }).slice(0, 32);
}

export function mergeConjugationGroups(existingGroups, incomingGroups, sourceLanguage) {
    const normalizedExisting = normalizeConjugations({ isVerb:true, conjugationGroups:existingGroups });
    const normalizedIncoming = normalizeConjugations({ isVerb:true, conjugationGroups:incomingGroups });
    const bestByKey = new Map();
    const quality = group => (group?.forms?.length || 0) * 100
        + (hasText(group?.label) ? 10 : 0)
        + (hasText(group?.note) ? 1 : 0);
    [...normalizedExisting, ...normalizedIncoming].forEach(group => {
        const key = group.categoryKey || group.label.toLocaleLowerCase('en');
        const current = bestByKey.get(key);
        if (!current || quality(group) >= quality(current)) bestByKey.set(key, group);
    });
    const orderedKeys = conjugationInventoryFor(sourceLanguage).map(item => item.categoryKey);
    const ordered = orderedKeys.map(key => bestByKey.get(key)).filter(Boolean);
    const extras = [...bestByKey.entries()]
        .filter(([key]) => !orderedKeys.includes(key))
        .map(([, group]) => group);
    return [...ordered, ...extras].slice(0, 32);
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
        partOfSpeech:'', formality:'', mainTranslation:[], pronunciationGuide:'',
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
    // This established technical borrowing is a regression anchor for Qelumi's
    // language-membership policy. Keep preview and full-detail decisions aligned.
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
        partOfSpeech:cleanText(result.partOfSpeech),
        formality,
        mainTranslation:cleanTextArray(result.mainTranslation, 4),
        pronunciationGuide:cleanText(result.pronunciationGuide),
        previewMeaning:{
            partOfSpeech:cleanText(meaning.partOfSpeech),
            register:normalizeRegister(meaning.register, ''),
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
    let validation = applyKnownLanguageMembership(
        normalizedValidation(result.sourceLanguageValidation, requested),
        context
    );
    const normalizedQuery = normalizeDictionaryQuery(context.query);

    result.sourceLanguageValidation = validation;
    // A known valid-language observation proves that the input exists somewhere, even when it is a source mismatch.
    result.wordExists = validation.validLanguages.length > 0 || validation.existsInRequestedLanguage
        ? true : result.wordExists === true;

    if (!validation.existsInRequestedLanguage || result.wordExists === false) {
        return stripLinguisticContent(result, context);
    }

    const formality = normalizeRegister(result.formality);
    const conjugationGroups = normalizeConjugations(result);
    const normalized = {
        detectedSourceLang:cleanCode(result.detectedSourceLang) || requested,
        sourceLanguageValidation:validation,
        wordExists:true,
        suggestedCorrection:cleanText(result.suggestedCorrection),
        extractedText:cleanText(result.extractedText),
        languageMismatch:false,
        partOfSpeech:cleanText(result.partOfSpeech),
        formality,
        mainTranslation:cleanTextArray(result.mainTranslation, 8),
        pronunciationGuide:cleanText(result.pronunciationGuide),
        etymology:{ sourceLang:cleanText(result.etymology?.sourceLang), targetLang:cleanText(result.etymology?.targetLang) },
        isVerb:result.isVerb === true,
        conjugationGroups,
        conjugations:conjugationObject(conjugationGroups),
        definitions:normalizeBilingual(result.definitions),
        synonyms:normalizeBilingual(result.synonyms),
        similarPhrases:normalizeBilingual(result.similarPhrases || result.relatedPhrases),
        meanings:(Array.isArray(result.meanings) ? result.meanings : []).map(meaning => ({
            partOfSpeech:cleanText(meaning?.partOfSpeech),
            label:normalizeMeaningLabel(meaning?.label, meaning?.partOfSpeech),
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

export function conjugationCoverageIssues(result, sourceLanguage) {
    if (result?.isVerb !== true) return [];
    const inventory = conjugationInventoryFor(sourceLanguage);
    if (!inventory.length) return result.conjugationGroups?.length ? [] : ['missing language-specific conjugations'];
    const byKey = new Map((result.conjugationGroups || [])
        .filter(group => hasText(group?.categoryKey))
        .map(group => [group.categoryKey, group]));
    const missing = inventory.filter(item => !byKey.has(item.categoryKey)).map(item => item.categoryKey);
    const undersized = inventory.filter(item => {
        const group = byKey.get(item.categoryKey);
        return group && (!hasText(group.label) || !Array.isArray(group.forms) || group.forms.length < item.minForms);
    }).map(item => item.categoryKey);
    const issues = [];
    if (missing.length) issues.push(`incomplete conjugation coverage: missing ${missing.join(', ')}`);
    if (undersized.length) issues.push(`incomplete conjugation paradigms: ${undersized.join(', ')}`);
    return issues;
}

export function conjugationKeysNeedingRepair(result, sourceLanguage) {
    if (result?.isVerb !== true) return [];
    const inventory = conjugationInventoryFor(sourceLanguage);
    if (!inventory.length) return [];
    const byKey = new Map((result.conjugationGroups || [])
        .filter(group => hasText(group?.categoryKey))
        .map(group => [group.categoryKey, group]));
    return inventory.filter(item => {
        const group = byKey.get(item.categoryKey);
        return !group || !hasText(group.label) || !Array.isArray(group.forms)
            || group.forms.length < item.minForms;
    }).map(item => item.categoryKey);
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
    if (!REGISTER_VALUES.includes(result.formality)) issues.push('missing entry register');
    if (!definitionsOnly && !result.mainTranslation?.some(hasText)) issues.push('missing main translation');
    if (!hasText(result.etymology?.sourceLang)) issues.push('missing source etymology');
    if (!definitionsOnly && !hasText(result.etymology?.targetLang)) issues.push('missing target etymology');
    if (!bilingualHasContent(result.definitions, definitionsOnly)) issues.push('missing definitions');
    // Some valid entries—especially proper names, coined characters and highly
    // specialised terms—have no genuine synonyms or collocations. Empty arrays
    // are valid; missing or malformed bilingual containers are not.
    if (!bilingualHasContent(result.synonyms, definitionsOnly, true)) issues.push('invalid synonyms section');
    if (!bilingualHasContent(result.similarPhrases, definitionsOnly, true)
        || !bilingualHasContent(result.collocations, definitionsOnly, true)) {
        issues.push('invalid related-phrases section');
    }
    if (!Array.isArray(result.meanings) || !result.meanings.length
        || result.meanings.some(meaning => !hasText(meaning.label) || !hasText(meaning.partOfSpeech)
            || !hasText(meaning.sourceDefinition) || !REGISTER_VALUES.includes(meaning.register)
            || (!definitionsOnly && (!hasText(meaning.targetDefinition) || !meaning.translations?.some(hasText))))) {
        issues.push('missing or incomplete meanings');
    }
    if (!bilingualHasContent(result.usageWarnings, definitionsOnly, true)) issues.push('invalid usage-warnings section');
    if (!bilingualHasContent(result.grammarNotes, definitionsOnly, true)) issues.push('invalid grammar-notes section');
    if (!Array.isArray(result.regionalVariants) || !Array.isArray(result.wordFamily) || !Array.isArray(result.minimalPairs)) {
        issues.push('missing optional-section containers');
    }
    issues.push(...conjugationCoverageIssues(result, context.fromLang));
    if (!Array.isArray(result.contexts) || !result.contexts.length || result.contexts.some(contextItem => !hasText(contextItem.contextName))) {
        issues.push('missing contexts');
    }
    return issues;
}

export function hasLinguisticContent(result) {
    if (!result) return false;
    return hasText(result.partOfSpeech) || hasText(result.pronunciationGuide) || hasText(result.formality)
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

function conjugationInventoryPrompt(languageCode, categoryKeys = null) {
    return requestedConjugationInventory(languageCode, categoryKeys)
        .map(item => `${item.categoryKey} — ${item.referenceLabel} — at least ${item.minForms} labelled entr${item.minForms === 1 ? 'y' : 'ies'}`)
        .join('\n');
}

export function buildPreviewRequest(context, { repairSource = null } = {}) {
    const fromName = LANGUAGES[cleanCode(context.fromLang)];
    const toName = LANGUAGES[cleanCode(context.toLang)];
    const definitionsOnly = context.definitionsOnly === true;
    const repairInstruction = repairSource
        ? `\nRepair these preview-gate issues: ${repairSource.issues.join('; ')}. Do not repeat them.\nDraft preview JSON:\n${JSON.stringify(repairSource.result)}`
        : '';
    const system = `You are Qelumi's fast multilingual dictionary preview engine. Analyse the exact input, never a corrected substitute. Return only the small preview requested by the schema; do not generate etymology, conjugations, synonym lists, related phrases, regional variants, word families, contexts or examples.

First decide whether the exact input is genuinely established in requested source ${fromName} (${context.fromLang}). A grammatical sentence, established loanword, established expression, established specialised term, and well-established fictional or cultural proper name qualify. A proper-name coincidence alone must not displace an ordinary word or expression in another supported language, while an established name such as Marsupilami qualifies with requestedUsageLevel=proper-name. Language origin is not language membership. Shared established words such as apocalypse and saboteur qualify in both English and French. "backend" is established specialised French as well as English. The offensive English clipping "tard" does not qualify as the ordinary English entry; French "tard" does. "Dragueur" and "Je ne suis pas un si beau-parleur" requested as English belong to French.

Validation fields must be internally consistent. validLanguages is supporting evidence and need not be exhaustive. If validLanguages is nonempty, wordExists must be true. Set wordExists=false only for genuine gibberish. If existsInRequestedLanguage=false, leave partOfSpeech, formality, mainTranslation, pronunciationGuide and every previewMeaning field empty. Do not translate a source-language mismatch.

For an accepted entry, return:
- every established part of speech represented by the entry in partOfSpeech, not merely the first one;
- a concise pronunciation guide suitable for the source language;
- ${definitionsOnly ? 'no translation, because this is definitions-only mode' : `one to four most useful ${toName} translations`};
- exactly one concise, accurate source-language definition for the most common intended sense;
- ${definitionsOnly ? 'an empty target definition' : `a faithful ${toName} version of that same definition`};
- the exact part of speech and register of that meaning. For a polysemous entry such as English "approach", the general partOfSpeech must acknowledge both noun and verb uses even though previewMeaning describes only the selected most-common sense.

Write sourceDefinition in ${fromName}. ${definitionsOnly ? 'Keep mainTranslation empty and targetDefinition empty.' : `Write mainTranslation and targetDefinition in ${toName}.`} Use supported language codes only: ${Object.keys(LANGUAGES).join(', ')}. Return strict JSON matching the schema.${repairInstruction}`;
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
    const repairInstruction = repairSource
        ? `\nRepair the supplied draft. Correct these production-gate issues: ${repairSource.issues.join('; ')}. Do not repeat the defects.\nDraft JSON:\n${JSON.stringify(repairSource.result)}` : '';
    const system = `You are Qelumi's conservative multilingual dictionary engine. Analyse the exact input, never a corrected substitute.

First decide only what production needs: whether the exact input is genuinely established in requested source ${fromName} (${context.fromLang}); the most likely alternative language if it is not; confidence; and whether the input is genuinely ambiguous or mixed-language. validLanguages is supporting evidence only and need not be exhaustive. A grammatical sentence, established loanword, established expression, established specialised term, and well-established fictional or cultural proper name qualify. A proper name alone must not displace an ordinary word in another language, but an established name such as Marsupilami may be accepted with requestedUsageLevel=proper-name. Language origin is not language membership. Shared established words such as apocalypse and saboteur qualify in both English and French. "backend" is also an established French technical borrowing and must be accepted as specialised French when FR is requested, with borrowingNote explaining its English origin. The offensive English clipping "tard" does not qualify as the ordinary English entry; French "tard" does.

Validation fields must be internally consistent. If validLanguages is nonempty, wordExists must be true. Set wordExists=false only for genuine gibberish that is not valid in any supported language. If existsInRequestedLanguage=false, return every linguistic field empty: no translation, definition, etymology, pronunciation, meaning, context, conjugation, phrase, synonym, family, or minimal pair. The server will enforce this rule again.

For an accepted entry, provide a compact but complete core dictionary result. partOfSpeech must list every established grammatical class represented by the returned meanings, not merely the first one. Put an exact partOfSpeech and register on every distinct meaning because one written entry may have noun, verb, adjective or other senses and may mix neutral, informal, slang, technical or other registers. Split materially different grammatical uses into separate meanings. For example, English "approach" must include its verb senses and its noun senses rather than being classified only as a verb. Every meaning.label must be a short, natural, human-readable semantic or usage title in ${fromName}; never put its grammatical classification in the label because partOfSpeech already carries it. Do not use snake_case, prefixes such as "noun_" or "verb_", suffixes such as "_noun", or parenthetical labels such as "(verb)". Use consistent titles such as "Movement toward something", "Method or strategy", "Physical structure", "Connection or linking", "General state", and "Technical/computing". formality is only a backward-compatible general label. Word families are optional: return [] when there is no clear genuine family, and never invent an item just to fill the section. Synonyms, similar phrases and collocations must always retain their bilingual containers, but their arrays may be empty when no genuine item exists. Never invent a synonym or phrase merely to satisfy a section.

ETYMOLOGY IS ABOUT THE SOURCE ENTRY, NEVER ITS TRANSLATION. Both etymology.sourceLang and etymology.targetLang must describe the origin and historical development of the exact source entry "${context.query}" in ${fromName}; neither field may switch to the origin of a destination-language equivalent. Write sourceLang entirely in ${fromName}. ${definitionsOnly ? 'Leave targetLang empty.' : `Write targetLang entirely in ${toName} as a faithful translation of the same etymological facts.`} When reliable information exists, give two to four concise but informative sentences covering the relevant roots or formation, original sense, route into the language, and later development or expression history. For an expression, explain the expression as a whole rather than etymologising an unrelated translated phrase. If evidence is uncertain or genuinely unavailable, state that explicitly and do not invent a story.

If the entry has any established verb sense, set isVerb=true even when it is also a noun or another part of speech. For a verb, give each conjugation group a stable snake_case categoryKey, write label in ${fromName}, and provide as comprehensive a source-language paradigm as this compact core response permits. Include person or pronoun labels where the language distinguishes persons. If the searched form is inflected, conjugate its underlying lemma and identify that lemma in note. Qelumi separately audits this compact result against the complete ${fromName} inventory and requests any missing tense, mood, aspect or non-finite form before saving. If the entry has no verb sense, return [].

Contexts contain names and meaning indexes only, with empty examples arrays; examples are requested separately. Do not generate quiz distractors.

${definitionsOnly ? `Source and destination are both ${fromName}. This is definitions-only mode. Keep mainTranslation and all target-language fields empty; never duplicate source content.` : `Translate from ${fromName} to ${toName}. Source fields must be in ${fromName}; target fields must be in ${toName}.`}

Use supported language codes only: ${Object.keys(LANGUAGES).join(', ')}. Return strict JSON matching the schema.${repairInstruction}`;
    return {
        contents:[{ role:'user', parts:[{ text:`Exact input: ${context.query}\nRequested source: ${fromName} (${context.fromLang})\nDestination: ${toName} (${context.toLang})` }] }],
        systemInstruction:{ parts:[{ text:system }] },
        generationConfig:{
            responseMimeType:'application/json', responseJsonSchema:CORE_RESPONSE_SCHEMA,
            maxOutputTokens:12288
        }
    };
}

export function buildConjugationRequest(context, coreResult, { repairIssues = [], categoryKeys = null } = {}) {
    const fromName = LANGUAGES[cleanCode(context.fromLang)];
    const inventory = requestedConjugationInventory(context.fromLang, categoryKeys);
    const system = `You are Qelumi's dedicated ${fromName} verb-conjugation engine. Return a complete, accurate paradigm for the exact source entry, using its underlying lemma when necessary.

Return exactly one conjugationGroups item for every requested category below—no omissions, duplicates or additional category keys. Copy categoryKey exactly. Write every label, form and note in ${fromName}. Include explicit person or pronoun labels wherever ${fromName} distinguishes persons, even when the surface verb form repeats. Compound tenses must contain the complete auxiliary-plus-main-verb form. For English non_finite_forms, include the infinitive/base form, the -ing form with its gerund/present-participle functions, and the past participle; shared surface forms may be described in one labelled entry. For languages without tense inflection, provide the listed natural aspect, mood, politeness or construction forms and explain them accurately. Mark literary, historical, rare, regional or construction-based categories in note; do not silently remove them.

Requested categories:
${conjugationInventoryPrompt(context.fromLang, inventory.map(item => item.categoryKey))}

${repairIssues.length ? `The previous paradigm failed these checks: ${repairIssues.join('; ')}. Correct every listed defect.` : ''}`;
    return {
        contents:[{ role:'user', parts:[{ text:`Exact source entry: ${context.query}\nSource language: ${fromName} (${context.fromLang})\nPart of speech: ${coreResult?.partOfSpeech || 'verb'}\nCurrent incomplete groups: ${JSON.stringify(coreResult?.conjugationGroups || [])}` }] }],
        systemInstruction:{ parts:[{ text:system }] },
        generationConfig:{
            responseMimeType:'application/json',
            responseJsonSchema:conjugationResponseSchema(context.fromLang, inventory.map(item => item.categoryKey)),
            maxOutputTokens:12288
        }
    };
}

export function buildValidationRequest(context, primaryResult, issues = []) {
    const fromName = LANGUAGES[cleanCode(context.fromLang)];
    const system = `You are Qelumi's senior multilingual lexical validator. Resolve only source-language membership for the exact input. validLanguages is supporting evidence, not an exhaustive inventory. Decide whether it is genuinely established in requested ${fromName}, its most likely alternative language, confidence, and whether it is genuinely ambiguous or mixed-language. Established loanwords, specialised terms, and well-established fictional or cultural proper names qualify; use proper-name for the usage level where appropriate. A proper name alone must not displace an ordinary word in another language. "backend" is established specialised French. Shared words such as apocalypse and saboteur qualify in English and French. The English offensive clipping "tard" does not qualify as the ordinary English entry. Return strict JSON only.`;
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
        contents:[{ role:'user', parts:[{ text:`Entry: ${context.query}\nContext: ${contextItem.contextName}\nPart of speech: ${meaning.partOfSpeech || coreResult.partOfSpeech}\nMeaning: ${meaning.sourceDefinition || contextItem.contextName}\nRegister: ${meaning.register || coreResult.formality}` }] }],
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
    // Qelumi's core dictionary contract currently has 70 properties; proactively
    // use JSON mode plus server validation instead of paying for a known 400.
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
    const previewFlights = new Map();
    const coreFlights = new Map();
    const exampleFlights = new Map();
    const distractorFlights = new Map();
    const successfulCompatibilityModes = new Map();
    const dictionaryRef = context => db.doc(`artifacts/${process.env.APP_ID || 'linguist-app-v7'}/public/data/global_dictionary/${dictionaryDocumentId(context.query, context.fromLang, context.toLang)}`);

    async function callModel({ model, thinkingLevel, body, timeoutMs, operation, uid = 'system' }) {
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
            recordUsage(uid, operation, { model, thinkingLevel, latencyMs, schemaFallbackUsed, compatibilityMode:selectedMode, compatibilityRetries, ...tokens }).catch(() => {});
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

    const isConjugationIssue = issue => String(issue || '').startsWith('incomplete conjugation')
        || issue === 'missing language-specific conjugations';
    const withoutConjugationIssues = issues => (issues || []).filter(issue => !isConjugationIssue(issue));

    async function completeConjugationCoverage(context, result, uid) {
        let issues = conjugationCoverageIssues(result, context.fromLang);
        if (result?.isVerb !== true || !issues.length) {
            return { result, primary:null, fallback:null, fallbackReason:'', remainingIssues:[] };
        }

        let primary; let fallback; let completed = result; let primaryFailure = '';
        try {
            const categoryKeys = conjugationKeysNeedingRepair(completed, context.fromLang);
            primary = await modelJSON({
                model:PRIMARY_MODEL, thinkingLevel:PRIMARY_THINKING,
                body:buildConjugationRequest(context, completed, { repairIssues:issues, categoryKeys }),
                timeoutMs:primaryTimeoutMs, operation:'translation_conjugation_primary', uid
            });
            const groups = normalizeConjugations({ isVerb:true, conjugationGroups:primary.result?.conjugationGroups });
            const mergedGroups = mergeConjugationGroups(
                completed.conjugationGroups, groups, context.fromLang
            );
            completed = { ...completed, conjugationGroups:mergedGroups, conjugations:conjugationObject(mergedGroups) };
            issues = conjugationCoverageIssues(completed, context.fromLang);
        } catch (error) {
            primaryFailure = error.code || error.message || 'conjugation_primary_failed';
        }

        if (issues.length || primaryFailure) {
            const repairIssues = [...issues, ...(primaryFailure ? [`primary request: ${primaryFailure}`] : [])];
            const categoryKeys = conjugationKeysNeedingRepair(completed, context.fromLang);
            fallback = await modelJSON({
                model:FALLBACK_MODEL, thinkingLevel:FALLBACK_THINKING,
                body:buildConjugationRequest(context, completed, { repairIssues, categoryKeys }),
                timeoutMs:fallbackTimeoutMs, operation:'translation_conjugation_fallback', uid
            });
            const groups = normalizeConjugations({ isVerb:true, conjugationGroups:fallback.result?.conjugationGroups });
            const mergedGroups = mergeConjugationGroups(
                completed.conjugationGroups, groups, context.fromLang
            );
            completed = { ...completed, conjugationGroups:mergedGroups, conjugations:conjugationObject(mergedGroups) };
            issues = conjugationCoverageIssues(completed, context.fromLang);
        }

        return {
            result:completed, primary, fallback,
            fallbackReason:fallback ? `conjugation_completion:${[...issues, primaryFailure].filter(Boolean).join('|')}` : '',
            remainingIssues:issues
        };
    }

    function parseStored(snapshot, context) {
        if (!snapshot?.exists) return null;
        const stored = snapshot.data();
        if (stored.fullJSON == null && stored.translation == null) {
            return { stored, result:null, updatedAt:0 };
        }
        try {
            const raw = typeof stored.fullJSON === 'string' ? JSON.parse(stored.fullJSON) : stored.translation;
            const result = normalizeTranslationResult(raw, context);
            return { stored, result, updatedAt:timestampMillis(stored.updatedAt || stored.refreshedAt) };
        } catch (_) { return { stored, result:null, updatedAt:0 }; }
    }

    function parseStoredPreview(snapshot, context) {
        if (!snapshot?.exists) return null;
        const stored = snapshot.data();
        if (stored.previewJSON == null) return null;
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
        await ref.set({
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
        }, { merge:true });
        return preview;
    }

    async function saveCachedResult(context, result, metadata = {}) {
        const ref = dictionaryRef(context);
        const previousSnapshot = await ref.get();
        const previous = parseStored(previousSnapshot, context)?.result;
        const merged = metadata.preserveExamples === false ? result : mergeContextExamples(clone(result), previous);
        const now = Date.now();
        const contextsComplete = contextsAreComplete(merged, context);
        const accepted = merged?.sourceLanguageValidation?.existsInRequestedLanguage === true && merged.wordExists === true;
        const preview = previewFromCore(merged, context);
        const qualityIssues = coreQualityIssues(merged, context);
        const conjugationIssues = qualityIssues.filter(isConjugationIssue);
        await ref.set({
            queryLower:normalizeDictionaryQuery(context.query), originalQuery:context.query,
            fromLang:context.fromLang, toLang:context.toLang,
            schemaVersion:DICTIONARY_SCHEMA_VERSION, modelVersion:DICTIONARY_SCHEMA_VERSION,
            coreComplete:qualityIssues.length === 0,
            conjugationComplete:conjugationIssues.length === 0,
            conjugationIssues,
            contextsComplete, complete:contextsComplete,
            completenessScore:contextsComplete
                ? (conjugationIssues.length ? 95 : 100)
                : accepted ? (conjugationIssues.length ? 65 : 70) : 100,
            status:accepted
                ? (qualityIssues.length ? 'needs_repair' : contextsComplete ? 'verified' : 'core_ready')
                : 'validated_negative',
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
        }, { merge:true });
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
                timeoutMs:primaryTimeoutMs,
                operation:'translation_preview_primary',
                uid
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
                timeoutMs:fallbackTimeoutMs,
                operation:'translation_preview_fallback',
                uid
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
        result = await savePreview(context, result, {
            model:primary?.model || fallback?.model || '',
            fallbackModel:fallback?.model || '',
            fallbackUsed:!!fallback,
            fallbackReason
        });
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
        const snapshot = await ref.get();
        const cacheLookupMs = Math.round(performance.now() - started);
        const now = Date.now();
        const cachedCore = parseStored(snapshot, context);
        if (cachedCore?.result) {
            const age = cachedCore.updatedAt ? now - cachedCore.updatedAt : Infinity;
            const accepted = cachedCore.result?.sourceLanguageValidation?.existsInRequestedLanguage === true
                && cachedCore.result.wordExists === true;
            const negativeExpiry = Number(cachedCore.stored?.expiresAt || 0);
            const derived = previewFromCore(cachedCore.result, context);
            const cachedCoreCurrent = Number(cachedCore.stored?.schemaVersion || 0) >= DICTIONARY_SCHEMA_VERSION
                && withoutConjugationIssues(coreQualityIssues(cachedCore.result, context)).length === 0;
            if (cachedCoreCurrent && age <= staleTtlMs && (accepted || negativeExpiry > now)
                && previewQualityIssues(derived, context).length === 0) {
                recordUsage(uid, 'translation_preview_cache_hit', {
                    cacheStatus:'full_dictionary',
                    cacheLookupMs,
                    latencyMs:cacheLookupMs
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
                cacheStatus:'preview',
                cacheLookupMs,
                latencyMs:cacheLookupMs
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
        const contradictionsBefore = [];
        try {
            primary = await modelJSON({
                model:PRIMARY_MODEL, thinkingLevel:PRIMARY_THINKING,
                body:buildCoreRequest(context), timeoutMs:primaryTimeoutMs,
                operation:'translation_core_primary', uid
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
                            operation:'translation_validation_fallback', uid
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

        if (!result || withoutConjugationIssues(issues).length || primaryError) {
            const blockingIssues = withoutConjugationIssues(issues);
            fallbackReason = fallbackReason || (blockingIssues.length ? `core_quality:${blockingIssues.join('|')}` : 'primary_parse_or_schema_failure');
            fallback = await modelJSON({
                model:FALLBACK_MODEL, thinkingLevel:FALLBACK_THINKING,
                body:buildCoreRequest(context, result ? { result, issues:blockingIssues } : undefined), timeoutMs:fallbackTimeoutMs,
                operation:'translation_core_fallback', uid
            });
            result = normalizeTranslationResult(fallback.result, context);
            issues = coreQualityIssues(result, context);
        }

        let conjugationPrimary; let conjugationFallback; let remainingConjugationIssues = [];
        if (result?.sourceLanguageValidation?.existsInRequestedLanguage === true && result.wordExists === true && result.isVerb === true) {
            const completion = await completeConjugationCoverage(context, result, uid);
            result = completion.result;
            conjugationPrimary = completion.primary;
            conjugationFallback = completion.fallback;
            remainingConjugationIssues = completion.remainingIssues || [];
            if (completion.fallbackReason) {
                fallbackReason = [fallbackReason, completion.fallbackReason].filter(Boolean).join(';');
            }
            issues = coreQualityIssues(result, context);
        }

        const blockingIssues = withoutConjugationIssues(issues);
        if (blockingIssues.length) {
            const error = new Error(`The linguistic response was incomplete: ${blockingIssues.join(', ')}.`);
            error.status = 502; error.code = 'MODEL_SCHEMA_INCOMPLETE'; throw error;
        }
        if (prior) result = mergeContextExamples(result, prior);
        result = await saveCachedResult(context, result, {
            model:primary?.model || fallback?.model || conjugationPrimary?.model || conjugationFallback?.model,
            fallbackModel:fallback?.model || conjugationFallback?.model || '',
            fallbackUsed:!!fallback || !!conjugationFallback, fallbackReason
        });
        const modelCalls = [primary, fallback, conjugationPrimary, conjugationFallback].filter(Boolean);
        return {
            result,
            meta:{
                source:prior ? 'dictionary_repair' : 'generated', cacheStatus:'miss',
                schemaVersion:DICTIONARY_SCHEMA_VERSION,
                primaryModel:PRIMARY_MODEL, primaryThinking:PRIMARY_THINKING,
                fallbackModel:FALLBACK_MODEL, fallbackThinking:FALLBACK_THINKING,
                fallbackUsed:!!fallback || !!conjugationFallback, fallbackReason,
                conjugationComplete:remainingConjugationIssues.length === 0,
                conjugationIssues:remainingConjugationIssues,
                contextsReady:contextsAreComplete(result, context),
                latencyMs:Math.round(performance.now() - totalStart),
                modelCalls:modelCalls.map(call => ({
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
        const snapshot = await ref.get();
        const cacheLookupMs = Math.round(performance.now() - started);
        const cached = parseStored(snapshot, context);
        const cachedIssues = cached?.result ? coreQualityIssues(cached.result, context) : ['cache miss'];
        const cachedBlockingIssues = withoutConjugationIssues(cachedIssues);
        const age = cached?.updatedAt ? Date.now() - cached.updatedAt : Infinity;
        const cachedSchemaVersion = Number(cached?.stored?.schemaVersion || 0);
        const needsSchemaRefresh = cachedSchemaVersion < DICTIONARY_SCHEMA_VERSION;
        const negativeExpiry = Number(cached?.stored?.expiresAt || 0);
        // A provider may occasionally leave one conjugation subgroup shorter
        // than the ideal inventory. That must never hide the otherwise complete
        // dictionary result or force repeated full model calls.
        const cacheUsable = cached?.result && cachedBlockingIssues.length === 0
            && (cached.result.sourceLanguageValidation?.existsInRequestedLanguage !== false || negativeExpiry > Date.now());

        if (!forceRefresh && cacheUsable && age <= freshTtlMs && !needsSchemaRefresh) {
            if (touch) {
                ref.update({ useCount:FieldValue.increment(1), lastUsedAt:Date.now() }).catch(() => {});
                recordUsage(uid, 'translation_cache_hit', { cacheStatus:'fresh', cacheLookupMs, latencyMs:cacheLookupMs }).catch(() => {});
            }
            return { result:cached.result, meta:{ source:'global_dictionary', cacheStatus:'fresh', schemaVersion:cachedSchemaVersion, contextsReady:contextsAreComplete(cached.result, context), staleRefreshStarted:false, cacheLookupMs, latencyMs:cacheLookupMs, fallbackUsed:false, modelCalls:[] } };
        }

        if (!forceRefresh && cacheUsable && age <= staleTtlMs) {
            const flightKey = dictionaryIdentity(context.query, context.fromLang, context.toLang);
            singleFlight(coreFlights, flightKey, () => generateCore(context, 'stale-refresh', cached.result))
                .catch(error => console.warn('Stale dictionary refresh failed.', error.message));
            if (touch) {
                ref.update({ useCount:FieldValue.increment(1), lastUsedAt:Date.now() }).catch(() => {});
                recordUsage(uid, 'translation_cache_hit', { cacheStatus:needsSchemaRefresh ? 'schema_upgrade' : 'stale', cacheLookupMs, latencyMs:cacheLookupMs }).catch(() => {});
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
                operation:'translation_examples_primary', uid
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
                operation:'translation_examples_fallback', uid
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
                    operation:'game_distractors_primary', uid
                });
            } catch (_) {
                response = await modelJSON({
                    model:FALLBACK_MODEL, thinkingLevel:FALLBACK_THINKING,
                    body:buildDistractorRequest(context), timeoutMs:fallbackTimeoutMs,
                    operation:'game_distractors_fallback', uid
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
        completeConjugations:(context, result, uid = 'system') => completeConjugationCoverage(context, result, uid),
        models:{ primary:PRIMARY_MODEL, primaryThinking:PRIMARY_THINKING, fallback:FALLBACK_MODEL, fallbackThinking:FALLBACK_THINKING },
        cache:{ freshTtlMs, staleTtlMs, mismatchTtlMs },
        previewSchemaVersion:PREVIEW_SCHEMA_VERSION
    };
}
