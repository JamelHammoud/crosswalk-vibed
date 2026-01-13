export type EffectType =
  | "none"
  | "confetti"
  | "rainbow"
  | "stars"
  | "spooky"
  | "gross"
  | "uhoh";

export interface Effect {
  id: EffectType;
  label: string;
  emoji: string;
  emojis: string[];
}

export const EFFECTS: Effect[] = [
  {
    id: "none",
    label: "None",
    emoji: "✨",
    emojis: [],
  },
  {
    id: "confetti",
    label: "Confetti",
    emoji: "🎊",
    emojis: ["🎊", "🎉", "🎈", "🎁", "🪅", "✨"],
  },
  {
    id: "rainbow",
    label: "Rainbow",
    emoji: "🌈",
    emojis: ["🌈", "☀️", "⭐", "🦋", "🌸", "💫"],
  },
  {
    id: "stars",
    label: "Stars",
    emoji: "🌟",
    emojis: ["⭐", "🌟", "✨", "💫", "🌙", "⚡"],
  },
  {
    id: "spooky",
    label: "Spooky",
    emoji: "🎃",
    emojis: ["🎃", "👻", "🦇", "🕷️", "💀", "🕸️"],
  },
  {
    id: "gross",
    label: "Gross",
    emoji: "💩",
    emojis: ["💩", "🤢", "🤮", "🪰", "🦠", "🐛"],
  },
  {
    id: "uhoh",
    label: "Uh Oh",
    emoji: "😨",
    emojis: ["😨", "😱", "🚨", "⚠️", "😬", "💥"],
  },
];

export function getEffect(id: EffectType): Effect {
  return EFFECTS.find((e) => e.id === id) || EFFECTS[0];
}
