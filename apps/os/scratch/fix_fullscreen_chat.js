const fs = require('fs');
const filePath = 'apps/os/src/styles/os.css';
let css = fs.readFileSync(filePath, 'utf8');

const target = `.m87-chat-shell.is-fullscreen {
  flex: 1;
  border-radius: 16px;
}`;

const replacement = `.m87-chat-shell.is-fullscreen {
  flex: 1;
  border-radius: 16px;
  height: calc(100vh - 120px);
  max-height: calc(100vh - 120px);
  min-height: 480px;
  overflow: hidden;
}`;

if (css.includes(target)) {
  css = css.replace(target, replacement);
  fs.writeFileSync(filePath, css, 'utf8');
  console.log('✅ Updated .m87-chat-shell.is-fullscreen with fixed viewport-bounded height');
} else {
  console.error('Target not found in os.css');
}

