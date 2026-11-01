const fs = require('fs');

const file = 'c:/Users/Dell/OneDrive/Desktop/medcore/apps/os/src/components/auth/AuthScreen.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /\} catch \(authMiss: unknown\) \{\s*badgeAuthMiss = authMiss;[\s\S]*?return;\s*\}\s*\}/;

const replacement = `} catch (authMiss: unknown) {
          const { classifyAuthError } = await import('../../lib/firebase');
          setError(
            authMiss
              ? classifyAuthError(authMiss, { accountKnown: false, mode: 'badge' })
              : 'Incorrect Staff ID or PIN. Account not found at this facility.'
          );
          setLoading(false);
          return;
        }}`;

if (regex.test(content)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Cleaned up badgeAuthMiss successfully');
} else {
  console.error('Regex did not match');
}
