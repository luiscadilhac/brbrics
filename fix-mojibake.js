const fs = require('fs');

// Read file as UTF-8 string (this gives us the mojibake)
const mojibake = fs.readFileSync('C:\\Users\\User\\Desktop\\projeto brics\\frontend\\index.html', 'utf8');

// Fix known mojibake sequences by replacing them with correct characters
const fixed = mojibake
  // Em dash (—) double-encoded: â€" -> —
  .replace(/Ã¢â‚¬â€œ/g, '—')
  .replace(/Ã¢â‚¬Â/g, '—')
  // Common Portuguese characters
  .replace(/ÃƒÂª/g, 'ê')
  .replace(/ÃƒÂ§/g, 'ç')
  .replace(/ÃƒÂ¡/g, 'á')
  .replace(/ÃƒÂ³/g, 'ó')
  .replace(/ÃƒÂ©/g, 'é')
  .replace(/ÃƒÂ­/g, 'í')
  .replace(/ÃƒÂµ/g, 'õ')
  .replace(/ÃƒÂ£/g, 'ã')
  .replace(/ÃƒÂ´/g, 'ô')
  .replace(/ÃƒÂº/g, 'ú')
  .replace(/ÃƒÂ¢/g, 'â')
  .replace(/ÃƒÂ¨/g, 'è')
  .replace(/ÃƒÂ¹/g, 'ù')
  .replace(/ÃƒÂ¬/g, 'ì')
  .replace(/ÃƒÂ²/g, 'ò')
  // Quotes
  .replace(/Ã‚Â€Âœ/g, '“')
  .replace(/Ã‚Â€Â/g, '”')
  .replace(/Ã‚Â€Â˜/g, '‘')
  .replace(/Ã‚Â€Â™/g, '’')
  // Degree and ordinal
  .replace(/Ã…Â¸/g, '°')
  .replace(/Ã‚Âº/g, 'º')
  .replace(/Ã‚Âª/g, 'ª')
  // Other common
  .replace(/ÃƒÅ /g, 'À')
  .replace(/ÃƒÂ€/g, 'À')
  .replace(/ÃƒÂ‰/g, 'É')
  .replace(/ÃƒÂ/g, 'Í')
  .replace(/ÃƒÂ“/g, 'Ó')
  .replace(/ÃƒÂš/g, 'Ú')
  .replace(/ÃƒÂ˜/g, 'Ø')
  .replace(/ÃƒÂ‡/g, 'Ç')
  .replace(/ÃƒÂ˜/g, 'Ø');

fs.writeFileSync('C:\\Users\\User\\Desktop\\projeto brics\\frontend\\index.html', fixed, 'utf8');
console.log('Fixed mojibake sequences');

// Verify
const verify = fs.readFileSync('C:\\Users\\User\\Desktop\\projeto brics\\frontend\\index.html', 'utf8');
const titleMatch = verify.match(/<title>(.*?)<\/title>/);
if (titleMatch) {
  console.log('Title:', titleMatch[1]);
}

const descMatch = verify.match(/<meta name="description" content="([^"]*)"/);
if (descMatch) {
  console.log('Description:', descMatch[1].substring(0, 150));
}

// Check nav items
const navMatches = verify.matchAll(/<a[^>]*>([^<]+)<\/a>/g);
for (const match of navMatches) {
  if (match[1].match(/[Ãâ€]/)) {
    console.log('Nav item with issues:', match[1]);
  }
}