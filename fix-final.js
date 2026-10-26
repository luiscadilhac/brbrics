const fs = require('fs');

// Read original file as UTF-8 (gives us the mojibake with actual Unicode chars)
const mojibake = fs.readFileSync('C:\\Users\\User\\Desktop\\projeto brics\\frontend\\index.html', 'utf8');

// Fix all known mojibake sequences using actual Unicode codepoints
const fixed = mojibake
  // Em dash (—) = UTF-8 E2 80 94 -> misread as â€" (U+00E2 U+20AC U+201D)
  .replace(/\u00E2\u20AC\u201D/g, '—')  // â€"
  .replace(/\u00E2\u20AC\u201C/g, '—')  // â€œ (left quote variant)
  // Left/right double quotes
  .replace(/\u00E2\u20AC\u201E/g, '“')  // â€ž
  .replace(/\u00E2\u20AC/g, '—')        // fallback for em dash
  // Portuguese characters: UTF-8 C3 XX -> misread as Ã + (XX as Windows-1252)
  .replace(/\u00C3\u00AA/g, 'ê')   // ê = C3 AA -> Ãª
  .replace(/\u00C3\u00A7/g, 'ç')   // ç = C3 A7 -> Ã§
  .replace(/\u00C3\u00A1/g, 'á')   // á = C3 A1 -> Ã¡
  .replace(/\u00C3\u00B3/g, 'ó')   // ó = C3 B3 -> Ã³
  .replace(/\u00C3\u00A9/g, 'é')   // é = C3 A9 -> Ã©
  .replace(/\u00C3\u00AD/g, 'í')   // í = C3 AD -> Ã­ (soft hyphen)
  .replace(/\u00C3\u00B5/g, 'õ')   // õ = C3 B5 -> Ãµ
  .replace(/\u00C3\u00A3/g, 'ã')   // ã = C3 A3 -> Ã£
  .replace(/\u00C3\u00B4/g, 'ô')   // ô = C3 B4 -> Ã´
  .replace(/\u00C3\u00BA/g, 'ú')   // ú = C3 BA -> Ãº
  .replace(/\u00C3\u00A2/g, 'â')   // â = C3 A2 -> Ã¢
  .replace(/\u00C3\u00A8/g, 'è')   // è = C3 A8 -> Ã¨
  .replace(/\u00C3\u00B9/g, 'ù')   // ù = C3 B9 -> Ã¹
  .replace(/\u00C3\u00AC/g, 'ì')   // ì = C3 AC -> Ã¬
  .replace(/\u00C3\u00B2/g, 'ò')   // ò = C3 B2 -> Ã²
  .replace(/\u00C3\u0080/g, 'À')   // À = C3 80 -> Ã€
  .replace(/\u00C3\u0089/g, 'É')   // É = C3 89 -> Ã‰
  .replace(/\u00C3\u008D/g, 'Í')   // Í = C3 8D -> Ã
  .replace(/\u00C3\u0093/g, 'Ó')   // Ó = C3 93 -> Ã“
  .replace(/\u00C3\u009A/g, 'Ú')   // Ú = C3 9A -> Ãš
  .replace(/\u00C3\u0087/g, 'Ç')   // Ç = C3 87 -> Ã‡
  .replace(/\u00C3\u0098/g, 'Ø')   // Ø = C3 98 -> Ã˜
  // Special cases found in this file
  .replace(/\u00C3\u201C/g, 'Ó')   // Ó = C3 93 -> misread as Ã“ (U+00C3 U+201C)
  .replace(/\u00C3\u0161/g, 'Ú')   // Ú = C3 9A -> misread as Ãš (U+00C3 U+0161)
  // Degree and ordinals
  .replace(/\u00BA/g, 'º')         // º = BA
  .replace(/\u00AA/g, 'ª')         // ª = AA
  .replace(/\u00B0/g, '°')         // ° = B0
  // Bullet and special
  .replace(/\u2022/g, '•')         // • = 2022
  .replace(/\u0160/g, 'Š');        // Š = 0160

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

// Check all text content for remaining mojibake (Ã followed by non-ASCII, or â€ patterns)
const allText = verify.match(/>[^<]+</g) || [];
let hasIssues = false;
for (const text of allText) {
  // Match actual mojibake: Ã followed by Latin-1 supplement chars, or â€ sequences
  if (text.match(/\u00C3[\u0080-\u00FF]/) || text.match(/\u00E2\u20AC/)) {
    console.log('Still has issues:', text.substring(0, 80));
    hasIssues = true;
  }
}
if (!hasIssues) {
  console.log('All text looks good!');
}