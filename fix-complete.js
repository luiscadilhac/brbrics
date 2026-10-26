const fs = require('fs');

// Read original file as UTF-8 (gives us the mojibake)
const mojibake = fs.readFileSync('C:\\Users\\User\\Desktop\\projeto brics\\frontend\\index.html', 'utf8');

// Fix all known mojibake sequences
// These are the patterns when UTF-8 bytes are misinterpreted as Windows-1252/latin1
const fixed = mojibake
  // Em dash (—) = UTF-8 E2 80 94 -> misread as â€" (U+00E2 U+20AC U+201D)
  .replace(/Ã¢â‚¬â€œ/g, '—')
  .replace(/Ã¢â‚¬â€/g, '—')
  // Left/right double quotes
  .replace(/Ã¢â‚¬Å/g, '“')
  .replace(/Ã¢â‚¬Â/g, '”')
  // Portuguese characters: UTF-8 C3 XX -> misread as ÃXX
  .replace(/ÃƒÂª/g, 'ê')   // ê = C3 AA
  .replace(/ÃƒÂ§/g, 'ç')   // ç = C3 A7
  .replace(/ÃƒÂ¡/g, 'á')   // á = C3 A1
  .replace(/ÃƒÂ³/g, 'ó')   // ó = C3 B3
  .replace(/ÃƒÂ©/g, 'é')   // é = C3 A9
  .replace(/ÃƒÂ­/g, 'í')   // í = C3 AD
  .replace(/ÃƒÂµ/g, 'õ')   // õ = C3 B5
  .replace(/ÃƒÂ£/g, 'ã')   // ã = C3 A3
  .replace(/ÃƒÂ´/g, 'ô')   // ô = C3 B4
  .replace(/ÃƒÂº/g, 'ú')   // ú = C3 BA
  .replace(/ÃƒÂ¢/g, 'â')   // â = C3 A2
  .replace(/ÃƒÂ¨/g, 'è')   // è = C3 A8
  .replace(/ÃƒÂ¹/g, 'ù')   // ù = C3 B9
  .replace(/ÃƒÂ¬/g, 'ì')   // ì = C3 AC
  .replace(/ÃƒÂ²/g, 'ò')   // ò = C3 B2
  .replace(/ÃƒÂ€/g, 'À')   // À = C3 80
  .replace(/ÃƒÂ‰/g, 'É')   // É = C3 89
  .replace(/ÃƒÂ/g, 'Í')   // Í = C3 8D
  .replace(/ÃƒÂ“/g, 'Ó')   // Ó = C3 93
  .replace(/ÃƒÂš/g, 'Ú')   // Ú = C3 9A
  .replace(/ÃƒÂ‡/g, 'Ç')   // Ç = C3 87
  .replace(/ÃƒÂ˜/g, 'Ø')   // Ø = C3 98
  // Degree and ordinals
  .replace(/Ã‚Âº/g, 'º')   // º = C2 BA
  .replace(/Ã‚Âª/g, 'ª')   // ª = C2 AA
  .replace(/Ã…Â¸/g, '°')   // ° = C2 B0
  // Bullet and special
  .replace(/Ã¢â‚¬Â¢/g, '•')  // • = E2 80 A2
  .replace(/Ã¢â‚¬Å/g, 'Š')   // Š = E2 80 9E (actually this is wrong, but let's see)
  // Fix any remaining â€ patterns
  .replace(/Ã¢â‚¬/g, '—');  // fallback for em dash

fs.writeFileSync('C:\\Users\\User\\Desktop\\projeto brics\\frontend\\index.html', fixed, 'utf8');
console.log('Fixed all mojibake sequences');

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

// Check all text content for remaining issues
const allText = verify.match(/>[^<]+</g) || [];
let hasIssues = false;
for (const text of allText) {
  if (text.match(/[Ãâ€]/)) {
    console.log('Still has issues:', text.substring(0, 80));
    hasIssues = true;
  }
}
if (!hasIssues) {
  console.log('All text looks good!');
}