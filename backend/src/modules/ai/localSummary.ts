const ACTION_KEYWORDS = [
  'focus',
  'next',
  'goal',
  'action',
  'todo',
  'agreed',
  'decided',
  'plan',
  'deliver',
  'ship',
  'review',
  'schedule',
  'need',
  'must',
  'should',
  'deadline',
  'following',
  'prepare',
  'follow up',
  'assign',
  'important',
  'concluded',
  'stretch',
];

function cleanSentence(s: string): string {
  let cleaned = s.trim().replace(/^[-*•\d.)\]\s]+/, '').trim();
  if (!cleaned) return '';
  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  if (!/[.!?]$/.test(cleaned)) {
    cleaned += '.';
  }
  return cleaned;
}

export function generateLocalSummary(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return '';
  }

  // Split by paragraph breaks, newlines, and standard sentence terminators
  const rawSegments = normalized
    .split(/\n+|(?<=[.!?])\s+/)
    .map(cleanSentence)
    .filter((s) => s.length > 0);

  if (rawSegments.length === 0) {
    return cleanSentence(normalized);
  }

  if (rawSegments.length <= 2) {
    return rawSegments.join(' ');
  }

  // Pick the primary sentence (usually the lead/context sentence)
  const first = rawSegments[0];

  // Score remaining sentences for action items, next steps, or key conclusions
  let bestScore = -1;
  let bestSecondary = rawSegments[1];

  for (let i = 1; i < rawSegments.length; i++) {
    const candidate = rawSegments[i];
    let score = 0;
    const lower = candidate.toLowerCase();

    for (const kw of ACTION_KEYWORDS) {
      if (lower.includes(kw)) {
        score += 3;
      }
    }

    // Favor sentences of good readable length (between 30 and 140 chars)
    if (candidate.length >= 30 && candidate.length <= 140) {
      score += 2;
    }

    if (score > bestScore) {
      bestScore = score;
      bestSecondary = candidate;
    }
  }

  return `${first} ${bestSecondary}`.trim();
}
