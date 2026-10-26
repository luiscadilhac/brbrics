const fs = require('fs');

// Read file as buffer
const buffer = fs.readFileSync('C:\\Users\\User\\Desktop\\projeto brics\\frontend\\index.html');

// Convert buffer to string using UTF-8 (this gives us the mojibake)
const mojibake = buffer.toString('utf8');

// Now encode the mojibake string as latin1 - this gives us the ORIGINAL UTF-8 bytes
// because each character in the mojibake string corresponds to one byte of the original UTF-8
const originalUtf8Bytes = Buffer.from(mojibake, 'latin1');

// Now decode those bytes as UTF-8 to get the correct text
const fixed = originalUtf8Bytes.toString('utf8');

// Write back as UTF-8
fs.writeFileSync('C:\\Users\\User\\Desktop\\projeto brics\\frontend\\index.html', fixed, 'utf8');
console.log('Fixed double-encoded UTF-8');

// Verify
const verify = fs.readFileSync('C:\\Users\\User\\Desktop\\projeto brics\\frontend\\index.html', 'utf8');
const titleMatch = verify.match(/<title>(.*?)<\/title>/);
if (titleMatch) {
  console.log('Title:', titleMatch[1]);
}

// Check a few more strings
const descMatch = verify.match(/<meta name="description" content="([^"]*)"/);
if (descMatch) {
  console.log('Description:', descMatch[1].substring(0, 100));
}