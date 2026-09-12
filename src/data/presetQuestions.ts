export interface PresetQuestion {
  id: string;
  text: string;
  category: 'core' | 'deep' | 'fun' | 'chaos';
}

export const DEFAULT_INITIAL_QUESTIONS: string[] = [
  'What’s your favourite car? 🚗',
  'What’s your biggest dream? 🌎',
  'Who is your bestie? 🫂',
  'Who is your crush? 👀',
  'What makes you happiest? 🥹',
  'What is your biggest fear? 🫣',
  'What would you do with ₹1 crore? 💰',
  'Write one message for me. 💌',
  'What’s our funniest memory together? 😂',
  'What’s my comfort food or midnight craving? 🍜',
  'What was your first impression of me? ✨',
  'If we could go on a spontaneous trip tomorrow, where are we heading? ✈️',
];

export const PRESET_CATEGORIES: {
  category: PresetQuestion['category'];
  label: string;
  icon: string;
  questions: string[];
}[] = [
  {
    category: 'core',
    label: 'Bestie Classics 💜',
    icon: '🫂',
    questions: [
      'Who is your bestie? 🫂',
      'Who is your crush? 👀',
      'Write one message for me. 💌',
      'What makes you happiest? 🥹',
      'What’s your favourite car? 🚗',
      'What’s your biggest dream? 🌎',
      'What is your biggest fear? 🫣',
      'What would you do with ₹1 crore? 💰',
    ],
  },
  {
    category: 'fun',
    label: 'Late-Night Vibes 🌙',
    icon: '✨',
    questions: [
      'What’s our funniest memory together? 😂',
      'What’s my comfort food or midnight craving? 🍜',
      'What was your first impression of me? ✨',
      'If we could go on a spontaneous trip tomorrow, where are we heading? ✈️',
      'What song reminds you of me? 🎶',
      'What’s one thing we could talk about for hours? 💭',
      'What is my go-to outfit or aesthetic? 👗',
      'Which movie or TV character reminds you of me? 🍿',
    ],
  },
  {
    category: 'deep',
    label: 'Deep & Emotional 🥹',
    icon: '💌',
    questions: [
      'What is one thing you appreciate about our friendship? 🤍',
      'When was the last time I made you genuinely smile? ☺️',
      'What advice do you think I need to hear right now? 🌿',
      'What is a secret talent or quality of mine you admire? 💫',
      'If I was having a terrible day, how would you cheer me up? ☕',
      'Where do you see both of us in 5 years? 🔮',
    ],
  },
  {
    category: 'chaos',
    label: 'Chaos & Roasts 😈',
    icon: '🔥',
    questions: [
      'If we got arrested together, what would it be for? 🚔',
      'What’s one habit of mine that drives you crazy? 🙃',
      'If we were stranded on a deserted island, who would survive longer? 🏝️',
      'What’s the most questionable life choice you’ve seen me make? 💀',
      'Rate my music taste from 1 to 10 (be brutally honest) 🎧',
      'Who takes longer to reply to texts between us? 📱',
    ],
  },
];
