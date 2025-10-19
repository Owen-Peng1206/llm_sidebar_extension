export function chunkText(text: string, maxTokens = 4000): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let current: string[] = [];
  let tokenCount = 0;

  for (const w of words) {
    const newCount = tokenCount + w.length + 1;
    if (newCount > maxTokens && current.length) {
      chunks.push(current.join(' '));
      current = [];
      tokenCount = 0;
    }
    current.push(w);
    tokenCount = newCount;
  }
  if (current.length) chunks.push(current.join(' '));
  return chunks;
}
