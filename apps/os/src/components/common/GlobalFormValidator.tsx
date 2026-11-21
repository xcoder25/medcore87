'use client';

import { useEffect } from 'react';
import { clearFieldInvalidMark, markInvalidFields } from '../../lib/formValidation';

function isSkipButton(btn: HTMLElement | null): boolean {
  if (!btn) return false;
  if (
    btn.hasAttribute('data-skip-btn') ||
    btn.hasAttribute('formnovalidate') ||
    btn.getAttribute('data-skip') === 'true'
  ) {
    return true;
  }
  const text = (btn.textContent || '').trim().toLowerCase();
  return text === 'skip' || text.startsWith('skip ');
}

function isAdvanceOrSubmitButton(btn: HTMLElement | null): boolean {
  if (!btn) return false;
  if (isSkipButton(btn)) return false;
  if (btn.getAttribute('type') === 'submit') return true;
  if (btn.hasAttribute('data-validate-step')) return true;
  const text = (btn.textContent || '').trim().toLowerCase();
  return /^(next|continue|complete\s+setup|submit|save\s+&|create\s+hospital|enroll|enrol)/.test(
    text
  );
}

/**
 * Mounted once at root layout. Intercepts form submissions and wizard Next/Save clicks
 * (strictly skipping any Skip button), disables single-tooltip blocking, highlights all
 * missing/invalid required controls simultaneously in red, and focuses the first one.
 */
export function GlobalFormValidator() {
  useEffect(() => {
    const onInputOrChange = (e: Event) => {
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement
      ) {
        clearFieldInvalidMark(target);
      }
    };

    const onInvalid = (e: Event) => {
      const target = e.target;
      if (target instanceof HTMLElement) {
        e.preventDefault();
        target.classList.add('mc-field-invalid');
        target.setAttribute('aria-invalid', 'true');
      }
    };

    const onSubmitCapture = (e: Event) => {
      const form = e.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (form.hasAttribute('data-skip-validation')) return;

      const submitter = (e as SubmitEvent).submitter as HTMLElement | null;
      if (isSkipButton(submitter)) return;

      const invalid = markInvalidFields(form);
      if (invalid.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        try {
          invalid[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
          invalid[0].focus();
        } catch {
          /* ignore */
        }
      }
    };

    const onClickCapture = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const btn = target?.closest('button');
      if (!btn) return;
      if (isSkipButton(btn)) return;
      if (!isAdvanceOrSubmitButton(btn)) return;

      const scope =
        btn.closest('form') ||
        (btn.closest('[data-validation-scope]') as HTMLElement | null);
      if (!scope) return;

      // Ensure native browser popup never blocks other fields from turning red
      if (scope instanceof HTMLFormElement && !scope.noValidate) {
        scope.noValidate = true;
      }

      const invalid = markInvalidFields(scope);
      if (invalid.length > 0 && btn.getAttribute('type') === 'submit') {
        e.preventDefault();
        try {
          invalid[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
          invalid[0].focus();
        } catch {
          /* ignore */
        }
      }
    };

    document.addEventListener('input', onInputOrChange, true);
    document.addEventListener('change', onInputOrChange, true);
    document.addEventListener('invalid', onInvalid, true);
    document.addEventListener('submit', onSubmitCapture, true);
    document.addEventListener('click', onClickCapture, true);

    return () => {
      document.removeEventListener('input', onInputOrChange, true);
      document.removeEventListener('change', onInputOrChange, true);
      document.removeEventListener('invalid', onInvalid, true);
      document.removeEventListener('submit', onSubmitCapture, true);
      document.removeEventListener('click', onClickCapture, true);
    };
  }, []);

  return null;
}

export default GlobalFormValidator;
