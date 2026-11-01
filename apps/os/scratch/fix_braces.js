const fs = require('fs');

const file = 'c:/Users/Dell/OneDrive/Desktop/medcore/apps/os/src/components/auth/AuthScreen.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace the double brace
content = content.replace(
  'return;\r\n        }}\r\n      }',
  'return;\r\n        }\r\n      }'
);
content = content.replace(
  'return;\n        }}\n      }',
  'return;\n        }\n      }'
);

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed double brace in AuthScreen.tsx');

