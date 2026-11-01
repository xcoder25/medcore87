const fs = require('fs');

const file = 'c:/Users/Dell/OneDrive/Desktop/medcore/apps/os/src/components/reception/PaystackBrandedCheckout.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /(const tick = \(\) => setClock\(formatCountdown\(expiresAt\)\);[\s\S]*?clearInterval\(id\);\s*\}, \[phase, expiresAt\]\);)/;

const addition = `

  // Realtime Paystack Payment Listener — automated zero-click verification polling every 2.5s
  useEffect(() => {
    if (phase !== 'waiting' || !reference) return;
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        const v = await verifyPaystackPayment(reference);
        if (v.verified && !cancelled) {
          setPhase('success');
          setBusy(false);
          onPaid({
            reference,
            paystackRef: v.reference || reference,
            amountNgn: v.amountNgn || (input ? input.amountNgn : 0),
            channel: v.channel || (mode === 'card_terminal' ? 'card' : 'bank_transfer'),
          });
        }
      } catch {
        /* continue background listening */
      }
    };

    const pollId = setInterval(poll, 2500);
    return () => {
      cancelled = true;
      clearInterval(pollId);
    };
  }, [phase, reference, input, mode, onPaid]);`;

content = content.replace(regex, `$1${addition}`);
fs.writeFileSync(file, content, 'utf8');
console.log('Successfully updated PaystackBrandedCheckout.tsx with realtime polling');
