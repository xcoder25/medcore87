/**
 * Universal required-field red validation helpers for forms and step wizards.
 */

export const INVALID_CLASS = 'mc-field-invalid';
export const ERROR_MSG_CLASS = 'mc-field-error-msg';

/** Checks whether a form control is required (native required, aria-required, or data-required). */
export function isControlRequired(el: Element): boolean {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) {
    return false;
  }
  if (el.disabled || el.type === 'hidden') return false;
  return (
    el.hasAttribute('required') ||
    el.getAttribute('aria-required') === 'true' ||
    el.getAttribute('data-required') === 'true'
  );
}

/** Evaluates whether an individual HTML form field has an invalid or missing value. */
export function isControlMissingOrInvalid(
  el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
): boolean {
  if (!isControlRequired(el)) return false;
  if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
    return !el.checked;
  }
  const val = String(el.value ?? '').trim();
  if (!val) return true;
  if (typeof el.checkValidity === 'function' && !el.checkValidity()) return true;
  return false;
}

/** Clears red highlight and injected error hint for a field once the user interacts with it. */
export function clearFieldInvalidMark(el: Element) {
  el.classList.remove(INVALID_CLASS);
  el.removeAttribute('aria-invalid');
  const next = el.nextElementSibling;
  if (next && next.classList.contains(ERROR_MSG_CLASS)) {
    next.remove();
  }
}

/**
 * Highlights all empty or invalid required controls inside `container` with `.mc-field-invalid`
 * and inserts an accessible inline message when not already present.
 * Returns the array of invalid controls (first element can be focused/scrolled into view).
 */
export function markInvalidFields(container: HTMLElement | null): HTMLElement[] {
  if (!container || typeof document === 'undefined') return [];
  const controls = Array.from(
    container.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      'input, select, textarea'
    )
  );
  const invalid: HTMLElement[] = [];

  for (const el of controls) {
    // Skip elements inside hidden sections
    if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') continue;
    if (!isControlRequired(el)) {
      clearFieldInvalidMark(el);
      continue;
    }
    if (isControlMissingOrInvalid(el)) {
      el.classList.add(INVALID_CLASS);
      el.setAttribute('aria-invalid', 'true');
      const existingNext = el.nextElementSibling;
      if (!existingNext || !existingNext.classList.contains(ERROR_MSG_CLASS)) {
        const msg = document.createElement('div');
        msg.className = ERROR_MSG_CLASS;
        msg.textContent = el.validationMessage || 'This field is required';
        el.insertAdjacentElement('afterend', msg);
      }
      invalid.push(el);
    } else {
      clearFieldInvalidMark(el);
    }
  }

  return invalid;
}

export interface FieldValidationRule {
  key: string;
  value: unknown;
  required?: boolean;
  label: string;
  customError?: (val: string) => string | null;
}

/** Pure synchronous field map validator usable in React forms and Node tests. */
export function validateFieldsMap(rules: FieldValidationRule[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const rule of rules) {
    const str = String(rule.value ?? '').trim();
    if (rule.required !== false && !str) {
      errors[rule.key] = `${rule.label} is required.`;
      continue;
    }
    if (rule.customError) {
      const err = rule.customError(str);
      if (err) errors[rule.key] = err;
    }
  }
  return errors;
}
