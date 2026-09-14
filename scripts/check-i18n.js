/* Usage: node scripts/check-i18n.js [--baseline /path/to/previous/i18n] */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../utils/i18n');
const locales = ['en', 'ja', 'ko'];
const { UI_COPY } = require(path.join(root, 'ui'));
const { CARD_COPY, FINGER_QUESTION_COPY } = require(path.join(root, 'cards'));

function flatten(value, prefix = '', result = {}) {
    for (const [key, item] of Object.entries(value)) {
        const next = prefix ? `${prefix}.${key}` : key;
        if (item && typeof item === 'object') flatten(item, next, result);
        else result[next] = item;
    }
    return result;
}
function placeholders(text) {
    return (text.match(/\{[a-zA-Z_]\w*\}/g) || []).sort();
}
function compareShape(reference, actual, label) {
    assert.deepEqual(Object.keys(actual).sort(), Object.keys(reference).sort(), `${label}: keys`);
    for (const key of Object.keys(reference)) {
        assert.equal(typeof actual[key], typeof reference[key], `${label}.${key}: type`);
        if (typeof actual[key] !== 'string') continue;
        assert.deepEqual(placeholders(actual[key]), placeholders(reference[key]), `${label}.${key}: placeholders`);
        assert.ok(!/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD]/.test(actual[key]), `${label}.${key}: invalid character`);
    }
}
function files(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const target = path.join(dir, entry.name);
        return entry.isDirectory() ? files(target) : [target];
    });
}
for (const file of files(root).filter(file => file.endsWith('.js'))) {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
}
for (const locale of locales) {
    compareShape(flatten(UI_COPY['zh-Hans']), flatten(UI_COPY[locale]), `UI.${locale}`);
    compareShape(flatten(CARD_COPY['zh-Hant-TW']), flatten(CARD_COPY[locale]), `cards.${locale}`);
    compareShape(flatten(FINGER_QUESTION_COPY['zh-Hant-TW']), flatten(FINGER_QUESTION_COPY[locale]), `finger.${locale}`);
}
const baselineIndex = process.argv.indexOf('--baseline');
if (baselineIndex !== -1) {
    assert.ok(process.argv[baselineIndex + 1], '--baseline requires a directory');
    const baseline = path.resolve(process.argv[baselineIndex + 1]);
    for (const [file, exports] of [['ui', ['UI_COPY']], ['cards', ['CARD_COPY', 'FINGER_QUESTION_COPY']]]) {
        const before = require(path.join(baseline, file));
        const after = require(path.join(root, file));
        for (const exported of exports) {
            for (const locale of ['zh-Hans', 'zh-Hant-TW']) {
                assert.deepEqual(after[exported][locale], before[exported][locale], `${exported}.${locale}: Chinese changed`);
            }
            const old = flatten(before[exported]), current = flatten(after[exported]);
            compareShape(old, current, exported);
            for (const key of Object.keys(old)) {
                if (typeof old[key] !== 'string') continue;
                assert.ok(current[key].trim() || !old[key].trim(), `${exported}.${key}: translation removed`);
                assert.ok((current[key].match(/\n/g) || []).length <= (old[key].match(/\n/g) || []).length,
                    `${exported}.${key}: added newline; check the display contract`);
            }
        }
    }
}
console.log(`i18n OK: ${locales.length} locales, ${Object.keys(flatten(UI_COPY.en)).length} UI entries per locale; card/question keys, placeholders and syntax checked.`);
if (baselineIndex !== -1) console.log('Baseline OK: Chinese unchanged; no added newlines or changed placeholders.');
