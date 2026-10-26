const fs = require('fs');
const str = fs.readFileSync('C:\\Users\\User\\Desktop\\projeto brics\\frontend\\index.html', 'utf8');

// Search for Órgão
const orgaoIdx = str.indexOf('Órgão');
console.log('Órgão:', orgaoIdx);
if (orgaoIdx >= 0) console.log('Context:', str.slice(orgaoIdx-10, orgaoIdx+20));

// Search for Orgao variations
const variations = ['Órgão', 'Órgão/UF', 'Orgao', 'ORGAO'];
variations.forEach(v => {
  const idx = str.indexOf(v);
  if (idx >= 0) console.log('Found:', v, 'at', idx);
});

// Check JSON-LD content
const jsonldIdx = str.indexOf('"@context"');
if (jsonldIdx >= 0) {
  console.log('JSON-LD at:', jsonldIdx);
  console.log('JSON-LD sample:', str.slice(jsonldIdx, jsonldIdx+200));
}