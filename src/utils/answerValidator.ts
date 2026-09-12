/**
 * Smart Context-Aware Answer Validator for Bestie
 * 
 * Enforces authentic, meaningful answers while rejecting low-effort,
 * random, evasive, or gibberish responses.
 */

export interface ValidationResult {
  isValid: boolean;
  message?: string;
  reason?: 'empty' | 'too_short' | 'gibberish' | 'evasive' | 'emoji_only' | 'punctuation_only' | 'context_mismatch';
}

// Friendly validation messages aligned with Bestie's persona
export const FRIENDLY_MESSAGES = {
  empty: "👀 Give me a real answer bestie!",
  too_short: "A little more detail, bestie! What specifically? 👀",
  evasive_idk: "Come onnn, you know this one 👀",
  evasive_no: "A simple 'no' is too vague bestie! Tell me a bit more 👀",
  evasive_general: "👀 Give me a real answer bestie!",
  gibberish: "😭 That doesn't look like an answer. Try again!",
  emoji_only: "😭 Emojis are cute, but give me some real words too bestie! 💌",
  punctuation_only: "😭 That doesn't look like an answer. Try again!",
  repeated_chars: "Come onnn, stop smashing the keys bestie! ⌨️😂",
  person_context_mismatch: "Wait, that doesn't answer this question! Give me a real answer bestie 👀",
  default_reject: "😭 That doesn't look like an answer. Try again!"
};

// Known evasive, lazy, or placeholder words/phrases (lower-cased)
const LAZY_EXACT_TOKENS = new Set([
  'no', 'nope', 'nah', 'na', 'nop', 'none', 'nothing', 'nil', 'zero', 'n/a', 'na', 'unknown', 'blank',
  'idk', 'i dk', 'ikd', 'i dont know', "i don't know", 'dont know', "don't know", 'dont knw', 'dnt know',
  'dunno', 'no idea', 'have no idea', 'i have no idea', 'no clue', 'zero clue',
  'dont have', "don't have", 'i dont have', "i don't have",
  'asdf', 'asdfg', 'asdfgh', 'asdfghjk', 'asdfghjkl',
  'qwerty', 'qwertyuiop', 'zxcv', 'zxcvb', 'zxcvbn', 'zxcvbnm',
  'xyz', 'abc', '123', '1234', '12345', '123456',
  'test', 'testing', 'answer', 'pass', 'skip', 'whatever', 'idc', 'i dont care', "i don't care"
]);

// Helper: Detect if question is asking for a person/who/crush/bestie
export function isPersonOrWhoQuestion(questionText: string): boolean {
  if (!questionText) return false;
  const q = questionText.toLowerCase();
  return (
    q.includes('who') ||
    q.includes('crush') ||
    q.includes('bestie') ||
    q.includes('dating') ||
    q.includes('partner') ||
    q.includes('in love') ||
    q.includes('friend')
  );
}

// Helper: Check if string is purely emojis
export function isOnlyEmojis(str: string): boolean {
  const clean = str.trim();
  if (!clean) return false;
  // Unicode regex for Extended Pictographic characters
  const emojiRegex = /^[\p{Extended_Pictographic}\s\uFE0F\u200D]+$/u;
  return emojiRegex.test(clean);
}

// Helper: Check if string is purely punctuation/symbols
export function isOnlyPunctuationOrSymbols(str: string): boolean {
  const clean = str.trim();
  if (!clean) return false;
  // Match any string where all characters are punctuation, symbols, whitespace, or numbers without letters
  return /^[\p{P}\p{S}\s]+$/u.test(clean);
}

// Helper: Detect keyboard row smashes and repetitive sequences
export function isKeyboardSmashOrGibberish(str: string): boolean {
  const lower = str.toLowerCase().replace(/[^a-z]/g, '');
  if (lower.length === 0) return false;

  // Extremely short strings with no vowels: e.g. "xyz", "abc", "asdf"
  const commonKeyboardSmashRows = [
    'asdf', 'sdfg', 'dfgh', 'fghj', 'ghjk', 'hjkl',
    'qwerty', 'werty', 'ertyu', 'rtyui', 'tyuio', 'yuiop',
    'zxcv', 'xcvb', 'cvbn', 'vbnm',
    'qazw', 'wsxe', 'edcr', 'rfvt', 'tgby', 'yhnm'
  ];
  for (const row of commonKeyboardSmashRows) {
    if (lower.includes(row) && lower.length <= row.length + 3) {
      return true;
    }
  }

  // Check for repeated character sequences like "aaaaaa", "zzzzzz", "gjgjgj"
  if (/(.)\1{3,}/.test(lower)) {
    // If the repeated characters make up more than 60% of the string
    const match = lower.match(/(.)\1{3,}/);
    if (match && match[0].length >= lower.length * 0.6) {
      return true;
    }
  }

  // Check for 2-char repeating smash: e.g. "gjgjgjgj", "fjfjfj", "asdasd"
  if (/^([a-z]{2})\1{2,}$/.test(lower)) {
    // Allow "hahaha" or "hehehe" or "lololo" only if there are other words
    if (!lower.startsWith('ha') && !lower.startsWith('he')) {
      return true;
    }
  }

  // Check for consonant cluster without vowels in long single words:
  // e.g. "gjgfjfdgnjfjg" has 13 chars and 0 vowels!
  const words = str.toLowerCase().split(/\s+/).map(w => w.replace(/[^a-z]/g, ''));
  for (const w of words) {
    if (w.length >= 5) {
      const vowels = w.match(/[aeiouy]/g);
      const vowelCount = vowels ? vowels.length : 0;
      // If 5+ letters and 0 vowels -> definite gibberish
      if (vowelCount === 0) {
        // Exception: standard acronyms like "bmw" are 3 chars, already handled
        return true;
      }
      // If 7+ letters and 5+ consecutive consonants
      if (/[bcdfghjklmnpqrstvwxz]{5,}/.test(w)) {
        // Check if it's not a common legitimate word
        return true;
      }
    }
  }

  return false;
}

/**
 * Main context-aware answer validator
 * 
 * @param questionText The prompt/question being answered
 * @param answerText The user's response to validate
 */
export function validateAnswer(questionText: string, answerText: string): ValidationResult {
  const raw = answerText || '';
  const trimmed = raw.trim();

  // 1. Whitespace-only or empty
  if (trimmed.length === 0) {
    return {
      isValid: false,
      message: FRIENDLY_MESSAGES.empty,
      reason: 'empty',
    };
  }

  // 2. Only emojis
  if (isOnlyEmojis(trimmed)) {
    return {
      isValid: false,
      message: FRIENDLY_MESSAGES.emoji_only,
      reason: 'emoji_only',
    };
  }

  // 3. Only punctuation / symbols (e.g. "???", "...", "---", "!?!")
  if (isOnlyPunctuationOrSymbols(trimmed)) {
    return {
      isValid: false,
      message: FRIENDLY_MESSAGES.punctuation_only,
      reason: 'punctuation_only',
    };
  }

  // Clean and normalize text for semantic checks (strip leading/trailing emojis & punctuation)
  const normalized = trimmed
    .toLowerCase()
    .replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu, '')
    .trim();

  // 4. Repeated meaningless characters (e.g. "aaaaa", ".....", "11111")
  if (/^(.)\1{2,}$/.test(normalized) && normalized.length >= 3) {
    return {
      isValid: false,
      message: FRIENDLY_MESSAGES.repeated_chars,
      reason: 'gibberish',
    };
  }

  // 5. Check for random keyboard smashing like "gjgfjfdgnjfjg"
  if (isKeyboardSmashOrGibberish(trimmed)) {
    return {
      isValid: false,
      message: FRIENDLY_MESSAGES.gibberish,
      reason: 'gibberish',
    };
  }

  // 6. Context-Aware Evaluation for Person / Who / Crush questions
  const isPersonQ = isPersonOrWhoQuestion(questionText);

  // Valid legitimate answers specifically for "Who is your crush?" / "Who is your bestie?"
  const validPersonAbsencePhrases = [
    'no one',
    'nobody',
    'nobody right now',
    'no one right now',
    'no one yet',
    'nobody yet',
    'single',
    'currently single',
    'i am single',
    "i'm single",
    'none right now',
  ];

  // If the answer is "no one" or "nobody" (or starts with it)
  const isPersonAbsenceAnswer = validPersonAbsencePhrases.some(
    p => normalized === p || normalized.startsWith(p + ' ') || normalized.startsWith(p + ',')
  );

  if (isPersonAbsenceAnswer) {
    if (isPersonQ) {
      // ✅ ACCEPTED for Who/Crush questions ("No one", "Nobody", "Nobody right now")
      return { isValid: true };
    } else {
      // ❌ REJECTED for non-person questions (e.g. "Nobody" for "What is your favourite car?")
      return {
        isValid: false,
        message: FRIENDLY_MESSAGES.person_context_mismatch,
        reason: 'context_mismatch',
      };
    }
  }

  // 7. Explanatory sentences starting with "I don't have..." or "I haven't..."
  // Examples:
  // ✅ "I don't have a crush right now" -> ACCEPT
  // ✅ "I don't have a favourite car" -> ACCEPT
  // ✅ "I don't have one yet" -> ACCEPT
  // ✅ "I haven't decided yet" -> ACCEPT
  // ✅ "To build my own startup" -> ACCEPT
  // But standalone "don't have" or "dont have" without any object -> REJECT
  const isFullExplanatoryPhrase =
    normalized.startsWith("i don't have ") ||
    normalized.startsWith('i dont have ') ||
    normalized.startsWith("i haven't ") ||
    normalized.startsWith('i havent ') ||
    normalized.startsWith('still exploring') ||
    normalized.startsWith('still deciding') ||
    normalized.startsWith('not sure yet');

  if (isFullExplanatoryPhrase) {
    // Check that there is substance after "i don't have" (at least 2 words or 8 chars total)
    if (normalized.length >= 12) {
      return { isValid: true };
    }
  }

  // 8. Evasive standalone lazy tokens
  // e.g. "no", "idk", "asdf", "xyz", "unknown", "nothing"
  if (LAZY_EXACT_TOKENS.has(normalized)) {
    if (normalized === 'idk' || normalized === 'i dk' || normalized.includes('dont know') || normalized.includes("don't know")) {
      return {
        isValid: false,
        message: FRIENDLY_MESSAGES.evasive_idk,
        reason: 'evasive',
      };
    }
    if (normalized === 'no' || normalized === 'nope' || normalized === 'nah') {
      return {
        isValid: false,
        message: FRIENDLY_MESSAGES.evasive_no,
        reason: 'evasive',
      };
    }
    return {
      isValid: false,
      message: FRIENDLY_MESSAGES.evasive_general,
      reason: 'evasive',
    };
  }

  // 9. Single-letter or two-letter tokens (e.g. "a", "x", "no", "yo") unless it's a known acronym
  const knownShortAnswers = new Set(['me', 'us', 'ai', 'bmw', 'gt', 'm4', 'm3', 'm5', 'amg', 'f1', '911', 'rs']);
  if (normalized.length <= 2 && !knownShortAnswers.has(normalized)) {
    return {
      isValid: false,
      message: FRIENDLY_MESSAGES.too_short,
      reason: 'too_short',
    };
  }

  // 10. Check if answer contains at least one meaningful word
  // A meaningful word has letters or numbers and is not pure gibberish
  const wordTokens = trimmed.split(/\s+/).filter(w => w.length > 0);
  if (wordTokens.length === 0) {
    return {
      isValid: false,
      message: FRIENDLY_MESSAGES.empty,
      reason: 'empty',
    };
  }

  // All checks passed! Answer is meaningful, context-aware, and accepted.
  return { isValid: true };
}
