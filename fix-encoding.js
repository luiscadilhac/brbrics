const fs = require('fs');

const content = fs.readFileSync('C:\\Users\\User\\Desktop\\projeto brics\\frontend\\index.html', 'utf8');

const fixed = content
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
  .replace(/Ã‚Âº/g, 'º');

fs.writeFileSync('C:\\Users\\User\\Desktop\\projeto brics\\frontend\\index.html', fixed, 'utf8');
console.log('Fixed encoding');