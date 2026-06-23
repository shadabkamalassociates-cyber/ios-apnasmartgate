const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '../src/assets/apna-smart-gate-icon.png');
const out = path.join(__dirname, '../src/lib/razorpayLogo.ts');

const b64 = fs.readFileSync(src).toString('base64');
fs.writeFileSync(
  out,
  `/** App launcher icon as data URI for Razorpay checkout (generated — run: node scripts/gen-razorpay-logo.js) */\nexport const RAZORPAY_LOGO_DATA_URI = 'data:image/png;base64,${b64}';\n`,
);
console.log('Wrote', out, 'size', fs.statSync(src).size);
