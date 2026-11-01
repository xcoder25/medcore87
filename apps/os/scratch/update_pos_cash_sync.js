const fs = require('fs');

const file = 'c:/Users/Dell/OneDrive/Desktop/medcore/apps/os/src/components/cashier/PosPaymentDesk.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /(const deskMethod = method === 'cash' \|\| method === 'pos' \|\| method === 'hmo' \|\| method === 'waiver';\s*if \(deskMethod\) \{\s*const patientName = fullName\(patient\);\s*const hospNo = patient\.hospitalNumber;\s*const purposeLabel = lines\.map\(\(l\) => l\.label\)\.join\(', '\) \|\| purpose;)/;

const addition = `
      // Instant synchronous receipt recording for AkwaRemit state registry & physical cash till
      try {
        printPaymentReceipt({
          reference: pay.reference,
          patientName,
          hospitalNumber: hospNo,
          amount: amt,
          method: String(method).toUpperCase(),
          purpose: purposeLabel,
          facilityName,
          facilityId,
          patientId: patient.id,
          cashier,
          cashierBadge: session?.badgeId,
          paymentId: pay.id,
          visitId: open?.id,
          print: false,
        });
      } catch (recErr) {
        console.warn('[pos] instant receipt sync note', recErr);
      }`;

if (regex.test(content)) {
  content = content.replace(regex, `$1${addition}`);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Successfully updated PosPaymentDesk.tsx with instant receipt sync');
} else {
  console.error('Regex did not match in PosPaymentDesk.tsx');
}

