const fs = require('fs');
const str = fs.readFileSync('C:\\Users\\User\\Desktop\\projeto brics\\frontend\\index.html', 'utf8');

console.log('Orgao correct:', str.indexOf('\u00D3rg\u00E3o'));
console.log('Orgao mojibake1:', str.indexOf('\u00C3\u201Crg\u00C3\u00A3o'));
console.log('Orgao mojibake2:', str.indexOf('\u00C3\u0093rg\u00C3\u00A3o'));

console.log('Camara correct:', str.indexOf('C\u00E2mara'));
console.log('Camara mojibake:', str.indexOf('C\u00C3\u00A2mara'));

console.log('Series correct:', str.indexOf('S\u00E9ries'));
console.log('Series mojibake:', str.indexOf('S\u00C3\u00A9ries'));

console.log('Ultimas correct:', str.indexOf('\u00DAtimas'));
console.log('Ultimas mojibake:', str.indexOf('\u00C3\u0161ltimas'));

// Show context around these
const idx1 = str.indexOf('\u00C3\u0161ltimas');
if (idx1 >= 0) console.log('Ultimas context:', str.slice(idx1-5, idx1+20));

const idx2 = str.indexOf('\u00C3\u0093rg\u00C3\u00A3o');
if (idx2 >= 0) console.log('Orgao context:', str.slice(idx2-5, idx2+20));