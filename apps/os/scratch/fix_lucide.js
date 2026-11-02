const fs = require('fs');
const p = 'c:\\Users\\Dell\\OneDrive\\Desktop\\medcore\\apps\\os\\src\\components\\auth\\AuthScreen.tsx';
let c = fs.readFileSync(p, 'utf8');
c = c.replace(/import\s*\{\s*Building2[\s\S]*?\}\s*from\s*'lucide-react';/,
`import {
  Building2, Lock, User, Eye, EyeOff, ArrowRight, CheckCircle2, AlertCircle, ShieldCheck,
  KeyRound, Mail, RefreshCw, X, ShieldAlert, Check, ChevronLeft
} from 'lucide-react';`);
fs.writeFileSync(p, c, 'utf8');
console.log('✅ Updated lucide-react import in AuthScreen.tsx');

