const fs = require('fs');

// Read as buffer to see raw bytes
const buffer = fs.readFileSync('C:\\Users\\User\\Desktop\\projeto brics\\frontend\\index.html');
console.log('First 200 bytes:', buffer.slice(0, 200));

// Try to decode properly - the file seems to have UTF-8 bytes but they were saved as if they were Windows-1252
// Let's try reading as latin1 and then re-encoding
const latin1Content = buffer.toString('latin1');
console.log('\\nFirst 500 chars as latin1:', latin1Content.slice(0, 500));

// Now try to fix by converting the latin1 interpretation back to proper UTF-8
const fixed = latin1Content
  .replace(/Ã¢â‚¬â€œ/g, '—')   // em dash
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
  .replace(/Ã‚Â€Âœ/g, '“')
  .replace(/Ã‚Â€Â/g, '”')
  .replace(/Ã‚Â€Â”/g, '—')
  .replace(/ÃƒÂª/g, 'ê')
  .replace(/Ã…Â¸/g, '°')
  .replace(/Ã‚Âº/g, 'º')
  .replace(/Ã¢â‚¬Å¡/g, 'Š')
  .replace(/Ã¢â‚¬Â¢/g, '•')
  .replace(/ÃƒÂ¨/g, 'è')
  .replace(/ÃƒÂ¹/g, 'ù')
  .replace(/ÃƒÂ¬/g, 'ì')
  .replace(/ÃƒÂ²/g, 'ò')
  .replace(/ÃƒÂ¬/g, 'ì');

fs.writeFileSync('C:\\Users\\User\\Desktop\\projeto brics\\frontend\\index.html', fixed, 'utf8');
console.log('\\nFixed encoding');