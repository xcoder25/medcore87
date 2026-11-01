const fs = require('fs');

const file = 'c:/Users/Dell/OneDrive/Desktop/medcore/apps/os/src/app/api/staff/create/route.ts';
let content = fs.readFileSync(file, 'utf8');

const target = `      } else {
        throw err;
      }
    }

    const issuedAt = new Date().toISOString();`;

const replacement = `      } else {
        throw err;
      }
    }

    // 1b. Ensure secondary Badge ID auth account (badge.<bId>@domain) for instant badge+PIN login
    const cleanBadge = bId.replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const badgeMail = \`badge.\${cleanBadge}@naija-bites-1s3y1.firebaseapp.com\`.toLowerCase();
    const pinSecret = String(pin || password || '123456');
    const badgePass = pinSecret.length >= 6 ? pinSecret : \`\${pinSecret}000000\`.slice(0, 6);
    if (authEmail !== badgeMail) {
      try {
        const bRec = await adminAuth.getUserByEmail(badgeMail);
        await adminAuth.updateUser(bRec.uid, { password: badgePass, displayName: name });
      } catch (bErr: unknown) {
        if (String((bErr as any)?.code || '').includes('user-not-found')) {
          try {
            await adminAuth.createUser({
              email: badgeMail,
              password: badgePass,
              displayName: name,
            });
          } catch (createErr) {
            console.warn('[api/staff/create] Badge secondary auth account note:', createErr);
          }
        }
      }
    }

    const issuedAt = new Date().toISOString();`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Updated staff create route successfully');
} else {
  console.error('Target not found in staff create route');
}

