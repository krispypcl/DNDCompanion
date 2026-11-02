/**
 * Copy text to the clipboard and say whether it worked.
 *
 * `navigator.clipboard` exists only in a secure context and only when the
 * browser allows it, and a phone's in-app browser often does not. The older
 * route — select a hidden field and ask the document to copy — works in those,
 * so it is the fallback rather than a failure.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Refused (permissions, an unfocused document). Try the other way.
  }
  if (typeof document === 'undefined') return false;
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;';
  document.body.appendChild(field);
  try {
    field.select();
    field.setSelectionRange(0, text.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    field.remove();
  }
}
