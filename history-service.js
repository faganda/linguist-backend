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

export function planHistoryDeletion({historyId, historyEntries = [], savedExamples = [], deleteExamples = false}) {
    const target = historyEntries.find(entry => String(entry?.id || '') === String(historyId || ''));
    if (!target) return null;
    if (!deleteExamples) {
        return {
            target,
            deletedExampleIds:[],
            historyNumberUpdates:[],
            savedExampleNumberUpdates:[]
        };
    }

    const deletedNumber = positiveWordNumber(target.wordNumber);
    const deletedExamples = savedExamples.filter(example => savedExampleBelongsToHistory(example, target));
    const deletedExampleIds = new Set(deletedExamples.map(example => String(example.id)));
    const historyNumberUpdates = deletedNumber ? historyEntries
        .filter(entry => String(entry.id) !== String(target.id) && positiveWordNumber(entry.wordNumber) > deletedNumber)
        .map(entry => ({id:String(entry.id), wordNumber:positiveWordNumber(entry.wordNumber) - 1})) : [];
    const savedExampleNumberUpdates = deletedNumber ? savedExamples
        .filter(example => !deletedExampleIds.has(String(example.id)) && positiveWordNumber(example.wordNumber) > deletedNumber)
        .map(example => ({id:String(example.id), wordNumber:positiveWordNumber(example.wordNumber) - 1})) : [];

    return {
        target,
        deletedExampleIds:[...deletedExampleIds],
        historyNumberUpdates,
        savedExampleNumberUpdates
    };
}
