/**
 * duplicate-check.js
 * Μόνιμο εργαλείο ελέγχου διπλότυπων για το Box to Box Cup.
 * Τρέξε το μετά από κάθε νέο batch για να πιάνεις διπλότυπα αμέσως, όχι μήνες μετά.
 *
 * Χρήση: node duplicate-check.js /path/to/box_to_box_cup_v2.html
 */
const fs = require('fs');
const vm = require('vm');

const filePath = process.argv[2];
if(!filePath){
  console.error('Χρήση: node duplicate-check.js /path/to/box_to_box_cup_v2.html');
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

let totalDuplicates = 0;
let totalQuestions = 0;

console.log('='.repeat(60));
console.log('ΕΛΕΓΧΟΣ ΔΙΠΛΟΤΥΠΩΝ — Box to Box Cup');
console.log('='.repeat(60));

CATEGORIES.forEach(cat => {
  const all = cat.easy.concat(cat.medium, cat.hard);
  totalQuestions += all.length;

  // Έλεγχος 1: ίδια απάντηση (q.a) πάνω από μία φορά — πιο συχνό είδος διπλότυπου
  // (π.χ. δύο "καριέρα προπονητή" εγγραφές για το ίδιο άτομο)
  const byAnswer = {};
  all.forEach((q, idx) => {
    const key = (q.a || '').trim();
    if(!key) return;
    if(!byAnswer[key]) byAnswer[key] = [];
    byAnswer[key].push({idx, q});
  });

  let catDupes = 0;
  Object.keys(byAnswer).forEach(answer => {
    if(byAnswer[answer].length > 1){
      catDupes += byAnswer[answer].length - 1;
      console.log(`\n⚠️  [${cat.key}] Πιθανό διπλότυπο για: "${answer}"`);
      byAnswer[answer].forEach(({idx, q}) => {
        const preview = (q.q || '').slice(0, 70).replace(/\n/g, ' ');
        const gaps = q.career ? `career:${q.career.length}` : (q.gaps !== undefined ? `gaps:${q.gaps}` : '');
        console.log(`     -> "${preview}..." ${gaps}`);
      });
    }
  });

  // Έλεγχος 2: πανομοιότυπο κείμενο ερώτησης (q.q) — σπανιότερο, αλλά ελέγχουμε
  const byQuestion = {};
  all.forEach((q, idx) => {
    const key = (q.q || '').trim();
    if(!key) return;
    if(!byQuestion[key]) byQuestion[key] = [];
    byQuestion[key].push(idx);
  });
  Object.keys(byQuestion).forEach(qtext => {
    if(byQuestion[qtext].length > 1){
      catDupes += byQuestion[qtext].length - 1;
      console.log(`\n⚠️  [${cat.key}] Πανομοιότυπο κείμενο ερώτησης (${byQuestion[qtext].length}x): "${qtext.slice(0,60)}..."`);
    }
  });

  totalDuplicates += catDupes;
});

console.log('\n' + '='.repeat(60));
console.log(`Σύνολο ερωτήσεων ελέγχθηκαν: ${totalQuestions}`);
console.log(`Πιθανά διπλότυπα βρέθηκαν: ${totalDuplicates}`);
console.log(totalDuplicates === 0 ? '✅ Καμία διπλότυπη εγγραφή!' : '⚠️  Χρειάζεται έλεγχος — δες παραπάνω.');
console.log('='.repeat(60));
