export function replaceSelectionWithTextInPage(translatedText: string) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  // Preserve surrounding tags by only replacing text nodes
  // Remove existing selection content
  range.deleteContents();
  // Insert translated text as a single text node
  const newTextNode = document.createTextNode(translatedText);
  range.insertNode(newTextNode);
  // Move cursor to the end of inserted content
  sel.collapseToEnd();
}
