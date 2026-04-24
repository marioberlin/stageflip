// packages/export-html5-zip/src/click-tag.ts
// clickTag injection for IAB / GDN HTML5 banners. The clickTag variable
// must be declared at window scope in the first <script> of the page;
// ad networks substitute the exit URL at serve time by either rewriting
// the default value or wrapping the response.
//
// References:
// - IAB New Standard Ad Unit Portfolio (2017)
// - https://support.google.com/admanager/answer/1722807 (DoubleClick HTML5 clickTag)
// - https://support.google.com/dcm/answer/6088201 (DCM HTML5 creative guidelines)

/**
 * Default clickTag macro used when the caller has no concrete URL. Ad
 * networks rewrite this placeholder at serve time:
 *
 *   `%%CLICK_URL_UNESC%%` — tracking prefix that must precede the exit URL
 *   `%%DEST_URL%%`        — the landing-page URL itself
 */
export const DEFAULT_CLICK_TAG_PLACEHOLDER = '%%CLICK_URL_UNESC%%%%DEST_URL%%';

const CLICK_TAG_MARKER = '<!-- stageflip-click-tag -->';

/**
 * Escape a clickTag value for safe embedding inside a JS string literal.
 * Rejects values that would break out of the string context.
 */
export function escapeClickTagForScript(clickTag: string): string {
  if (clickTag.length === 0) {
    throw new Error('clickTag must not be empty');
  }
  if (clickTag.includes('</script')) {
    throw new Error('clickTag must not contain a </script sequence');
  }
  return clickTag
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r');
}

/**
 * Build the `<script>` tag that declares the clickTag variable. IAB
 * convention: emit `var clickTag = "..."` (legacy script scope) AND
 * attach to `window` for modern module-style loaders. Wrapped in our
 * marker comment so `injectClickTagScript` is idempotent.
 */
export function clickTagScript(clickTag: string): string {
  const escaped = escapeClickTagForScript(clickTag);
  return `${CLICK_TAG_MARKER}\n<script>\nvar clickTag = "${escaped}";\nwindow.clickTag = clickTag;\n</script>`;
}

/**
 * Insert the clickTag script into an HTML document's `<head>`. If the
 * document already has our `stageflip-click-tag` marker, the existing
 * script block is replaced in-place (idempotent).
 *
 * Throws if the document has no `<head>` tag — IAB-compliant banners
 * must include one.
 */
export function injectClickTagScript(html: string, clickTag: string): string {
  const script = clickTagScript(clickTag);
  const markerOpenIdx = html.indexOf(CLICK_TAG_MARKER);
  if (markerOpenIdx !== -1) {
    // Replace from the marker through the end of the following </script>.
    const scriptEnd = html.indexOf('</script>', markerOpenIdx);
    if (scriptEnd === -1) {
      throw new Error('stageflip-click-tag marker present but no closing </script> found');
    }
    const replaceEnd = scriptEnd + '</script>'.length;
    return html.slice(0, markerOpenIdx) + script + html.slice(replaceEnd);
  }
  const headOpenIdx = html.search(/<head\b[^>]*>/i);
  if (headOpenIdx === -1) {
    throw new Error('HTML has no <head> tag — cannot inject clickTag script');
  }
  const headOpenMatch = html.slice(headOpenIdx).match(/^<head\b[^>]*>/i);
  if (headOpenMatch === null) {
    throw new Error('HTML has no <head> tag — cannot inject clickTag script');
  }
  const insertAt = headOpenIdx + headOpenMatch[0].length;
  return `${html.slice(0, insertAt)}\n${script}\n${html.slice(insertAt)}`;
}
