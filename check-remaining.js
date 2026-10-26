const fs = require('fs');
const str = fs.readFileSync('C:\\Users\\User\\Desktop\\projeto brics\\frontend\\index.html', 'utf8');

const checks = ['Séries', 'Órgão', 'Câmara', 'Últimas', '—'];
checks.forEach(s => {
  const idx = str.indexOf(s);
  if (idx >= 0) {
    console.log('Found:', s, 'at', idx, 'chars:', [...str.slice(idx, idx+s.length)].map(c => c + '=' + c.charCodeAt(0).toString(16)));
  } else {
    console.log('Not found:', s);
  }
});

// Also check for the mojibake versions
const mojibakeChecks = ['SÃ©ries', 'Ã“rgÃ£o', 'CÃ¢mara', 'Ãšltimas'];
mojibakeChecks.forEach(s => {
  const idx = str.indexOf(s);
  if (idx >= 0) {
    console.log('Mojibake found:', s, 'at', idx, 'chars:', [...str.slice(idx, idx+s.length)].map(c => c + '=' + c.charCodeAt(0).toString(16)));
  }
});