export function normalizeHistoryTerm(value) {
    return String(value || '').normalize('NFKC')
        .replace(/[’‘`]/gu, "'")
        .replace(/[‐‑‒–—]/gu, '-')
        .replace(/\s+/gu, ' ')
        .trim().toLocaleLowerCase('en');
}

const positiveWordNumber = value => {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : null;
};

export function normalizeCompactedWordNumbers(values = []) {
    return [...new Set((Array.isArray(values) ? values : [])
        .map(positiveWordNumber)
        .filter(Boolean))].sort((left, right) => left - right);
}

export function displayWordNumber(value, compactedWordNumbers = []) {
    const rawNumber = positiveWordNumber(value);
    if (!rawNumber) return null;
    const offset = normalizeCompactedWordNumbers(compactedWordNumbers)
        .filter(deletedNumber => deletedNumber < rawNumber).length;
    return Math.max(1, rawNumber - offset);
}

const sameLanguagePair = (left, right) => {
    const leftFrom = String(left?.fromLang || '').toUpperCase();
    const leftTo = String(left?.toLang || '').toUpperCase();
    const rightFrom = String(right?.fromLang || '').toUpperCase();
    const rightTo = String(right?.toLang || '').toUpperCase();
    return (!leftFrom || !rightFrom || leftFrom === rightFrom)
        && (!leftTo || !rightTo || leftTo === rightTo);
};

export function savedExampleBelongsToHistory(example, historyEntry) {
    if (!example || !historyEntry) return false;
    if (String(example.historyId || '') && String(example.historyId) === String(historyEntry.id)) return true;
    const exampleTerm = normalizeHistoryTerm(example.queryWord || example.query);
    const historyTerm = normalizeHistoryTerm(historyEntry.query);
    if (!exampleTerm || !historyTerm || exampleTerm !== historyTerm || !sameLanguagePair(example, historyEntry)) return false;
    const exampleNumber = positiveWordNumber(example.wordNumber);
    const historyNumber = positiveWordNumber(historyEntry.wordNumber);
    return !exampleNumber || !historyNumber || exampleNumber === historyNumber;
}

export function planHistoryDeletion({
    historyId, historyEntries = [], savedExamples = [], deleteExamples = false,
    compactedWordNumbers = []
}) {
    const target = historyEntries.find(entry => String(entry?.id || '') === String(historyId || ''));
    if (!target) return null;
    if (!deleteExamples) {
        return {
            target,
            deletedExampleIds:[],
            historyNumberUpdates:[],
            savedExampleNumberUpdates:[],
            compactedWordNumber:null,
            compactedWordNumbers:normalizeCompactedWordNumbers(compactedWordNumbers)
        };
    }

    const deletedNumber = positiveWordNumber(target.wordNumber);
    const deletedExamples = savedExamples.filter(example => savedExampleBelongsToHistory(example, target));
    const deletedExampleIds = new Set(deletedExamples.map(example => String(example.id)));
    // Persisting a rewrite for every later History and Review document made one
    // deletion O(total vocabulary) and could exhaust Firestore write quotas. Keep
    // stored wordNumber values stable and record the removed raw number once;
    // clients derive the same contiguous display number from this compact ledger.
    const nextCompactions = deletedNumber
        ? normalizeCompactedWordNumbers([...compactedWordNumbers, deletedNumber])
        : normalizeCompactedWordNumbers(compactedWordNumbers);

    return {
        target,
        deletedExampleIds:[...deletedExampleIds],
        historyNumberUpdates:[],
        savedExampleNumberUpdates:[],
        compactedWordNumber:deletedNumber,
        compactedWordNumbers:nextCompactions
    };
}
