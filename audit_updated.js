/**
 * audit.js
 * Πλήρης έλεγχος υγείας της βάσης ερωτήσεων για το Box to Box Cup.
 * Συνδυάζει: σύνολα ανά κατηγορία/δυσκολία, στόχο "no-repeat games",
 * και ακεραιότητα δεδομένων (κενές απαντήσεις, TOP5 με λάθος αριθμό
 * απαντήσεων, ΠΟΙΟΣ ΛΕΙΠΕΙ χωρίς ακριβώς 3 κενά).
 *
 * Χρήση: node audit.js /path/to/box_to_box_cup_v2.html
 */
const fs = require('fs');
const vm = require('vm');

const filePath = process.argv[2];
if(!filePath){
  console.error('Χρήση: node audit.js /path/to/box_to_box_cup_v2.html');
  process.exit(1);
}

const html = fs.readFileSync(filePath, 'utf8');
const start = html.indexOf('const CATEGORIES');
const end = html.indexOf('const setupScreen');
const script = html.slice(start, end);
const sandbox = { document: { getElementById: () => ({}) }, console };
const ctx = vm.createContext(sandbox);
vm.runInContext(script, ctx);
const CATEGORIES = vm.runInContext('CATEGORIES', ctx);

const NO_TIER_CATS = ["TOP 5", "GUESS THE SCORE", "ΠΟΙΟΣ ΛΕΙΠΕΙ"]; // δεν έχουν ουσιαστική διάκριση δυσκολίας
// Ο παλιός κανόνας "30 μοναδικά παιχνίδια/tier" καταργήθηκε (Αύγουστος 2026).
// Νέος στόχος: ~1500 ερωτήσεις συνολικά, ισοκατανεμημένες ανά κατηγορία/δυσκολία.
const GRAND_TARGET = 1500;
const NUM_CATEGORIES = 8;
const TARGET_PER_CATEGORY = GRAND_TARGET / NUM_CATEGORIES; // ~187.5
const TARGET_PER_TIER = Math.round(TARGET_PER_CATEGORY / 3); // ~63, χρησιμοποιείται μόνο ως ενδεικτικό κατώφλι προειδοποίησης

console.log('═'.repeat(64));
console.log('  ΕΛΕΓΧΟΣ ΥΓΕΙΑΣ ΒΑΣΗΣ — Box to Box Cup');
console.log('═'.repeat(64));

/* ---------- 1. Σύνολα ανά κατηγορία/δυσκολία ---------- */
console.log('\n📊 ΣΥΝΟΛΑ ΑΝΑ ΚΑΤΗΓΟΡΙΑ/ΔΥΣΚΟΛΙΑ\n');
let grandTotal = 0;
let minTier = Infinity, minInfo = null;
const rows = [];

CATEGORIES.forEach(c => {
  const total = c.easy.length + c.medium.length + c.hard.length;
  grandTotal += total;
  const noTier = NO_TIER_CATS.includes(c.key);
  rows.push({key: c.key, easy: c.easy.length, medium: c.medium.length, hard: c.hard.length, total, noTier});
  ['easy','medium','hard'].forEach(t => {
    if(c[t].length < minTier){ minTier = c[t].length; minInfo = c.key + '/' + t; }
  });
});

rows.sort((a,b) => a.total - b.total);
rows.forEach(r => {
  const flag = r.noTier ? ' (χωρίς ουσιαστική διάκριση δυσκολίας)' : '';
  const belowTarget = ['easy','medium','hard'].filter(t => r[t] < TARGET_PER_TIER);
  const warn = belowTarget.length ? `  ⚠️  κάτω από ${TARGET_PER_TIER}: ${belowTarget.join(', ')}` : '  ✅';
  console.log(`  ${r.key.padEnd(18)} easy=${String(r.easy).padStart(3)} medium=${String(r.medium).padStart(3)} hard=${String(r.hard).padStart(3)}  TOTAL=${String(r.total).padStart(3)}${flag}${warn}`);
});

console.log(`\n  ΣΥΝΟΛΟ ΒΑΣΗΣ: ${grandTotal} ερωτήσεις (στόχος: ${GRAND_TARGET})`);
console.log(`  Πρόοδος προς τον στόχο: ${(grandTotal/GRAND_TARGET*100).toFixed(1)}%`);
console.log(`  Στενό σημείο: ${minInfo} = ${minTier} ερωτήσεις (ενδεικτικός στόχος ~${TARGET_PER_TIER}/tier για ισοκατανομή)`);

/* ---------- 2. Στόχος 1500 ισοκατανεμημένα (πρώην "30/tier") ---------- */
console.log('\n🎯 ΣΤΟΧΟΣ 1500 ΕΡΩΤΗΣΕΩΝ ΙΣΟΚΑΤΑΝΕΜΗΜΕΝΑ\n');
const allOk = rows.every(r => r.easy >= TARGET_PER_TIER && r.medium >= TARGET_PER_TIER && r.hard >= TARGET_PER_TIER);
if(grandTotal >= GRAND_TARGET && allOk){
  console.log(`  ✅ Φτάσαμε/ξεπεράσαμε τον στόχο των ${GRAND_TARGET} ερωτήσεων με καλή κατανομή!`);
} else if(allOk){
  console.log(`  ✅ Όλες οι κατηγορίες έχουν καλή κατανομή (≥~${TARGET_PER_TIER}/tier), αλλά χρειάζονται ακόμα ${GRAND_TARGET - grandTotal} ερωτήσεις για τον στόχο των ${GRAND_TARGET}.`);
} else {
  console.log(`  ⚠️  Δεν έχουν όλα τα tiers φτάσει το ενδεικτικό ~${TARGET_PER_TIER} ακόμα — δες τις προειδοποιήσεις παραπάνω. Χρειάζονται ακόμα ${Math.max(0, GRAND_TARGET - grandTotal)} ερωτήσεις για τον στόχο των ${GRAND_TARGET}.`);
}

/* ---------- 3. Ακεραιότητα δεδομένων ---------- */
console.log('\n🔍 ΑΚΕΡΑΙΟΤΗΤΑ ΔΕΔΟΜΕΝΩΝ\n');
let issues = 0;

CATEGORIES.forEach(cat => {
  const all = cat.easy.concat(cat.medium, cat.hard);
  all.forEach((q, idx) => {
    // Κενή ή ελλιπής απάντηση
    if(!q.a || !q.a.trim()){
      console.log(`  ⚠️  [${cat.key}] Κενή απάντηση: "${(q.q||'').slice(0,60)}"`);
      issues++;
    }
    // ΠΟΙΟΣ ΛΕΙΠΕΙ: πρέπει να έχει ακριβώς gaps=3
    if(cat.key === "ΠΟΙΟΣ ΛΕΙΠΕΙ" && q.gaps !== undefined && q.gaps !== 3){
      console.log(`  ⚠️  [ΠΟΙΟΣ ΛΕΙΠΕΙ] gaps=${q.gaps} (θα έπρεπε να είναι 3): "${(q.q||'').slice(0,50)}"`);
      issues++;
    }
    // TOP 5: η απάντηση πρέπει να μοιάζει με λίστα ονομάτων (χοντρικός έλεγχος: τουλάχιστον 2 κόμματα ή "και")
    if(cat.key === "TOP 5" && q.a){
      const commaCount = (q.a.match(/,/g) || []).length;
      if(commaCount < 2 && !q.a.includes(' και ') && !q.a.includes('ισόποσα')){
        console.log(`  ⚠️  [TOP 5] Πιθανό λιγότερο από 5 ονόματα: "${q.a.slice(0,60)}"`);
        issues++;
      }
    }
    // MANAGER ID / PLAYER ID: πρέπει να έχουν career array με τουλάχιστον 1 σταθμό
    if((cat.key === "MANAGER ID" || cat.key === "PLAYER ID") && (!q.career || q.career.length === 0)){
      console.log(`  ⚠️  [${cat.key}] Λείπει career array: "${q.a}"`);
      issues++;
    }
  });
});

if(issues === 0) console.log('  ✅ Καμία ασυνέπεια βρέθηκε.');
else console.log(`\n  Σύνολο θεμάτων: ${issues}`);

console.log('\n' + '═'.repeat(64));
console.log(issues === 0 && allOk ? '✅ Η βάση είναι σε άριστη κατάσταση!' : '⚠️  Δες τις προειδοποιήσεις παραπάνω.');
console.log('═'.repeat(64));
