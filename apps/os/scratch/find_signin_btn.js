const fs = require('fs');
const content = fs.readFileSync('apps/os/src/components/auth/AuthScreen.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('Sign In') || l.includes('Signing') || (l.includes('type="submit"') && i > 1200)) {
    console.log(`L${i+1}: ${l.trim()}`);
  }
});

