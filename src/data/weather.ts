export interface WeatherEffect {
  type: "catch_rate" | "rarity_boost" | "coin_multiplier" | "xp_multiplier";
  value: number;
}

export interface WeatherState {
  id: string;
  name: string;
  emoji: string;
  description: string;
  effects: WeatherEffect[];
}

export const weatherStates: WeatherState[] = [
  {
    id: "sunny",
    name: "Sunny",
    emoji: "☀️",
    description: "Clear skies — fish are biting freely.",
    effects: [{ type: "catch_rate", value: 1.2 }],
  },
  {
    id: "rainy",
    name: "Rainy",
    emoji: "🌧️",
    description: "The rain brings rare fish closer to the surface.",
    effects: [
      { type: "catch_rate", value: 0.9 },
      { type: "rarity_boost", value: 1.3 },
      { type: "xp_multiplier", value: 1.2 },
    ],
  },
  {
    id: "foggy",
    name: "Foggy",
    emoji: "🌫️",
    description: "Hard to see, but the mist hides something special...",
    effects: [
      { type: "catch_rate", value: 0.7 },
      { type: "rarity_boost", value: 1.5 },
      { type: "coin_multiplier", value: 0.8 },
    ],
  },
  {
    id: "stormy",
    name: "Stormy",
    emoji: "⛈️",
    description: "Dangerous waters — only the bravest reel in legends.",
    effects: [
      { type: "catch_rate", value: 0.5 },
      { type: "rarity_boost", value: 2.0 },
      { type: "coin_multiplier", value: 1.5 },
      { type: "xp_multiplier", value: 1.5 },
    ],
  },
];
