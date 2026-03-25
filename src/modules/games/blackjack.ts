/**
 * Blackjack Game Logic & State Management
 * Uses custom Discord card emojis for visual display.
 */

// ─── Card Emoji Mapping ─────────────────────────────────────────────────────

const CARD_BACK = "<:playingcardbackside:1483940847689928756>";

/** Card emojis keyed by "{suit}_{rank}" e.g. "hearts_A", "clubs_10" */
const CARD_EMOJIS: Record<string, string> = {
  // ♥ Hearts
  hearts_A:  "<:playingcardheartsace:1483941051973501050>",
  hearts_2:  "<:playingcardheartstwo:1483941053013950474>",
  hearts_3:  "<:playingcardheartsthree:1483941062983811246>",
  hearts_4:  "<:playingcardheartsfour:1483941042569875537>",
  hearts_5:  "<:playingcardheartsfive:1483941061867868352>",
  hearts_6:  "<:playingcardheartssix:1483941056604143616>",
  hearts_7:  "<:playingcardheartsseven:1483941044298055890>",
  hearts_8:  "<:playingcardheartseight:1483941033489203300>",
  hearts_9:  "<:playingcardheartsnine:1483941039810019500>",
  hearts_10: "<:playingcardheartsten:1483941060345462795>",
  hearts_J:  "<:playingcardheartsjack:1483941053013950474>",
  hearts_Q:  "<:playingcardheartsqueen:1483941036525879347>",
  hearts_K:  "<:playingcardheartsking:1483941059229778082>",
  // ♦ Diamonds
  diamonds_A:  "<:playingcarddiamondace:1483941026384318514>",
  diamonds_2:  "<:playingcarddiamondtwo:1483941047980658749>",
  diamonds_3:  "<:playingcarddiamondthree:1483941030309924905>",
  diamonds_4:  "<:playingcarddiamondfour:1483941031836782823>",
  diamonds_5:  "<:playingcarddiamondfive:1483941028581867612>",
  diamonds_6:  "<:playingcarddiamondsix:1483941054821695659>",
  diamonds_7:  "<:playingcarddiamondseven:1483941037935431800>",
  diamonds_8:  "<:playingcarddiamondeight:1483941065923887184>",
  diamonds_9:  "<:playingcarddiamondnine:1483941025402585169>",
  diamonds_10: "<:playingcarddiamondten:1483941058105708705>",
  diamonds_J:  "<:playingcarddiamondjack:1483941034743431188>",
  diamonds_Q:  "<:playingcarddiamondqueen:1483941064472526888>",
  diamonds_K:  "<:playingcarddiamondking:1483941067253350490>",
  // ♠ Spades
  spades_A:  "<:playingcardspadesace:1483940849782882526>",
  spades_2:  "<:playingcardspadest:1483940851888685106>",
  spades_3:  "<:playingcardspadesthree:1483940836944117760>",
  spades_4:  "<:playingcardspadesfour:1483940841574895668>",
  spades_5:  "<:playingcardspadesfive:1483940819269582980>",
  spades_6:  "<:playingcardspadessix:1483940840513470524>",
  spades_7:  "<:playingcardspadesseven:1483940844619960400>",
  spades_8:  "<:playingcardspadeseight:1483940853675462796>",
  spades_9:  "<:playingcardspadesnine:1483940843009081506>",
  spades_10: "<:playingcardspadesten:1483940831609098452>",
  spades_J:  "<:playingcardspadesjack:1483940846498877593>",
  spades_Q:  "<:playingcardspadesqueen:1483940838475174018>",
  spades_K:  "<:playingcardspadesking:1483940855072161923>",
  // ♣ Clubs
  clubs_A:  "<:playingcardclubsace:1483940807831715920>",
  clubs_2:  "<:playingcardclubstwo:1483940829595697162>",
  clubs_3:  "<:playingcardclubsthree:1483940818221011095>",
  clubs_4:  "<:playingcardclubsfour:1483940816434233466>",
  clubs_5:  "<:playingcardclubsfive:1483940820905234432>",
  clubs_6:  "<:playingcardclubssix:1483940826965868714>",
  clubs_7:  "<:playingcardclubsseven:1483940833232420914>",
  clubs_8:  "<:playingcardclubseight:1483940830887546961>",
  clubs_9:  "<:playingcardclubsnine:1483940806380486807>",
  clubs_10: "<:playingcardclubsten:1483940823606362263>",
  clubs_J:  "<:playingcardclubsjack:1483940822490681534>",
  clubs_Q:  "<:playingcardclubsqueen:1483940828153118801>",
  clubs_K:  "<:playingcardclubsking:1483940834679193600>",
};

// ─── Core Types & Data ───────────────────────────────────────────────────────

const suits = ["hearts", "diamonds", "spades", "clubs"] as const;
const ranks = [
  { rank: "A", value: 11, label: "Ace" },
  { rank: "2", value: 2, label: "2" },
  { rank: "3", value: 3, label: "3" },
  { rank: "4", value: 4, label: "4" },
  { rank: "5", value: 5, label: "5" },
  { rank: "6", value: 6, label: "6" },
  { rank: "7", value: 7, label: "7" },
  { rank: "8", value: 8, label: "8" },
  { rank: "9", value: 9, label: "9" },
  { rank: "10", value: 10, label: "10" },
  { rank: "J", value: 10, label: "Jack" },
  { rank: "Q", value: 10, label: "Queen" },
  { rank: "K", value: 10, label: "King" },
];

export interface Card {
  suit: string;
  rank: string;
  value: number;
  label: string;
}

export interface BlackjackGame {
  playerCards: Card[];
  dealerCards: Card[];
  amount: number;
  userId: string;
  timestamp: number;
  settled: boolean;
  doubled: boolean;
}

// In-memory game store (expires after 10 minutes)
const activeGames = new Map<string, BlackjackGame>();

const GAME_TIMEOUT = 10 * 60 * 1000; // 10 minutes

// ─── Card Helpers ────────────────────────────────────────────────────────────

export function generateCard(): Card {
  const suit = suits[Math.floor(Math.random() * suits.length)];
  const card = ranks[Math.floor(Math.random() * ranks.length)];
  return { suit, rank: card.rank, value: card.value, label: card.label };
}

/** Returns the custom emoji for a card. */
export function cardEmoji(card: Card): string {
  const key = `${card.suit}_${card.rank}`;
  return CARD_EMOJIS[key] ?? `\`${card.rank}${card.suit[0].toUpperCase()}\``;
}

/** Returns the hidden card back emoji. */
export function cardBackEmoji(): string {
  return CARD_BACK;
}

/** Renders a hand as a row of card emojis. */
export function handEmojis(cards: Card[]): string {
  return cards.map(cardEmoji).join(" ");
}

/** Renders a hand with one hidden card (for dealer's initial display). */
export function dealerHandEmojis(cards: Card[]): string {
  if (cards.length === 0) return "";
  return `${cardEmoji(cards[0])} ${CARD_BACK}`;
}

/** Legacy text display: "A♠ K♥" */
export function cardStr(card: Card): string {
  const suitSymbol = { hearts: "♥", diamonds: "♦", spades: "♠", clubs: "♣" }[card.suit] ?? card.suit;
  return `${card.rank}${suitSymbol}`;
}

export function handStr(cards: Card[]): string {
  return cards.map(cardStr).join(" ");
}

export function handValue(cards: Card[]): number {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    total += card.value;
    if (card.rank === "A") aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

// ─── Game Management ─────────────────────────────────────────────────────────

export function createGame(userId: string, amount: number): { game: BlackjackGame; gameId: string } {
  const game: BlackjackGame = {
    playerCards: [generateCard(), generateCard()],
    dealerCards: [generateCard(), generateCard()],
    amount,
    userId,
    timestamp: Date.now(),
    settled: false,
    doubled: false,
  };

  const gameId = `bj:${userId}:${Date.now()}`;
  activeGames.set(gameId, game);

  // Auto-cleanup after timeout
  setTimeout(() => {
    activeGames.delete(gameId);
  }, GAME_TIMEOUT);

  return { game, gameId };
}

export function getGame(gameId: string): BlackjackGame | null {
  const game = activeGames.get(gameId);
  if (!game) return null;

  // Cleanup if expired
  if (Date.now() - game.timestamp > GAME_TIMEOUT) {
    activeGames.delete(gameId);
    return null;
  }

  return game;
}

export function hitPlayer(gameId: string): Card | null {
  const game = getGame(gameId);
  if (!game || game.settled) return null;

  const newCard = generateCard();
  game.playerCards.push(newCard);
  return newCard;
}

export function doubleDown(gameId: string): Card | null {
  const game = getGame(gameId);
  if (!game || game.settled || game.doubled) return null;
  if (game.playerCards.length !== 2) return null; // Can only double on first action

  game.doubled = true;
  game.amount *= 2;
  const newCard = generateCard();
  game.playerCards.push(newCard);
  return newCard;
}

export function dealerLogic(game: BlackjackGame): void {
  // Dealer hits on 16 or less, stands on 17+
  while (handValue(game.dealerCards) < 17) {
    game.dealerCards.push(generateCard());
  }
}

export function settleGame(game: BlackjackGame): {
  result: "blackjack" | "win" | "lose" | "push" | "bust";
  payout: number;
} {
  if (game.settled) {
    return { result: "lose", payout: 0 };
  }

  game.settled = true;
  const playerValue = handValue(game.playerCards);

  // Check player bust
  if (playerValue > 21) {
    return { result: "bust", payout: 0 };
  }

  // Complete dealer's hand
  dealerLogic(game);
  const dealerValue = handValue(game.dealerCards);

  // Natural blackjack (2 cards, value 21)
  const playerBJ = game.playerCards.length === 2 && playerValue === 21;
  const dealerBJ = game.dealerCards.length === 2 && dealerValue === 21;

  if (playerBJ && dealerBJ) return { result: "push", payout: game.amount };
  if (playerBJ) return { result: "blackjack", payout: Math.floor(game.amount * 2.5) };

  // Dealer bust
  if (dealerValue > 21) {
    return { result: "win", payout: game.amount * 2 };
  }

  // Compare values
  if (playerValue > dealerValue) {
    return { result: "win", payout: game.amount * 2 };
  } else if (playerValue === dealerValue) {
    return { result: "push", payout: game.amount };
  } else {
    return { result: "lose", payout: 0 };
  }
}

export function deleteGame(gameId: string): void {
  activeGames.delete(gameId);
}

// ─── Stakes Config ───────────────────────────────────────────────────────────

export const LOW_STAKES = { min: 100, max: 5_000 };
export const HIGH_STAKES = { min: 5_000, max: 250_000 };
export const VIP_STAKES = { min: 500_000, max: 20_000_000 };

export { CARD_BACK };
