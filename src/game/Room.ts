import Deck from "./Deck";
import Player from "./Player";
import { Card } from "./Card";
import { GameState } from "./GameState";

export default class Room {
  id: string;

  // =====================================================
  // PLAYERS
  // =====================================================

  players: Player[] = [];

  // =====================================================
  // BETTING
  // =====================================================

  currentBet = 0;

  lastRaise = 2;

  round = 0;

  // =====================================================
  // DECK
  // =====================================================

  deck: Deck = new Deck();

  // =====================================================
  // COMMUNITY CARDS
  // =====================================================

  communityCards: Card[] = [];

  // =====================================================
  // POT
  // =====================================================

  pot = 0;

  // =====================================================
  // WINNER
  // =====================================================

  winner?: Player | null;

  winnerHand: string | null = null;

  winnerCards: Card[] = [];

  // =====================================================
  // MAX PLAYERS
  // =====================================================

  maxPlayers = 5;

  // =====================================================
  // DEALER
  // =====================================================

  dealerIndex = 0;

  // =====================================================
  // CURRENT PLAYER
  // =====================================================

  currentPlayerIndex = 0;

  // =====================================================
  // BLINDS
  // =====================================================

  smallBlindAmount: number;

  bigBlindAmount: number;

  // =====================================================
  // GAME STATE
  // =====================================================

  state: GameState = GameState.WAITING;

  // =====================================================
  // CONSTRUCTOR
  // =====================================================

  constructor(id: string, smallBlindAmount = 1, bigBlindAmount = 2) {
    this.id = id;

    this.smallBlindAmount = smallBlindAmount;

    this.bigBlindAmount = bigBlindAmount;
  }

  // =====================================================
  // ADD PLAYER
  // =====================================================

  addPlayer(player: Player) {
    if (this.players.length >= this.maxPlayers) {
      throw new Error("Room is full.");
    }

    this.players.push(player);

    // بازیکن جدید قابل بازی است
    (player as any).outOfChips = false;
  }

  // =====================================================
  // REMOVE PLAYER
  // =====================================================

  removePlayer(playerId: string) {
    this.players = this.players.filter((player) => player.id !== playerId);

    // جلوگیری از index اشتباه
    if (this.players.length === 0) {
      this.currentPlayerIndex = 0;
      this.dealerIndex = 0;

      return;
    }

    if (this.currentPlayerIndex >= this.players.length) {
      this.currentPlayerIndex = 0;
    }

    if (this.dealerIndex >= this.players.length) {
      this.dealerIndex = 0;
    }
  }

  // =====================================================
  // CAN START GAME
  // =====================================================

  canStartGame() {
    const playablePlayers = this.players.filter((player) => player.chips > 0);

    return playablePlayers.length >= 2;
  }

  // =====================================================
  // GET PLAYABLE PLAYERS
  // =====================================================

  getPlayablePlayers() {
    return this.players.filter((player) => player.chips > 0);
  }

  // =====================================================
  // ASSIGN POSITIONS
  // =====================================================

  private assignPositions() {
    // اول همه reset شوند
    this.players.forEach((player) => {
      player.dealer = false;

      player.smallBlind = false;

      player.bigBlind = false;
    });

    // فقط بازیکنان دارای چیپ
    const playablePlayers = this.getPlayablePlayers();

    if (playablePlayers.length < 2) {
      throw new Error("Not enough playable players.");
    }

    // ===================================================
    // FIND DEALER AMONG PLAYABLE PLAYERS
    // ===================================================

    let dealer = this.players[this.dealerIndex];

    // اگر dealer چیپ ندارد، نفر بعدی دارای چیپ
    if (!dealer || dealer.chips <= 0) {
      const dealerIndex = this.findNextPlayablePlayer(this.dealerIndex);

      if (dealerIndex === -1) {
        throw new Error("No playable dealer found.");
      }

      this.dealerIndex = dealerIndex;

      dealer = this.players[this.dealerIndex];
    }

    dealer.dealer = true;

    // ===================================================
    // HEADS UP
    // ===================================================

    if (playablePlayers.length === 2) {
      // Dealer = Small Blind

      dealer.smallBlind = true;

      const bbIndex = this.findNextPlayablePlayer(this.dealerIndex);

      if (bbIndex === -1) {
        throw new Error("Big blind player not found.");
      }

      this.players[bbIndex].bigBlind = true;

      return;
    }

    // ===================================================
    // 3+ PLAYERS
    // ===================================================

    const sbIndex = this.findNextPlayablePlayer(this.dealerIndex);

    if (sbIndex === -1) {
      throw new Error("Small blind player not found.");
    }

    this.players[sbIndex].smallBlind = true;

    const bbIndex = this.findNextPlayablePlayer(sbIndex);

    if (bbIndex === -1) {
      throw new Error("Big blind player not found.");
    }

    this.players[bbIndex].bigBlind = true;
  }

  // =====================================================
  // FIND NEXT PLAYABLE PLAYER
  // =====================================================

  findNextPlayablePlayer(fromIndex: number) {
    if (this.players.length === 0) {
      return -1;
    }

    for (let i = 1; i <= this.players.length; i++) {
      const index = (fromIndex + i) % this.players.length;

      const player = this.players[index];

      if (player && player.chips > 0) {
        return index;
      }
    }

    return -1;
  }

  // =====================================================
  // COLLECT BLINDS
  // =====================================================

  private collectBlinds() {
    const sb = this.players.find((p) => p.smallBlind && p.chips > 0);

    const bb = this.players.find((p) => p.bigBlind && p.chips > 0);

    if (!sb || !bb) {
      throw new Error("Blind players not found.");
    }

    const sbAmount = Math.min(this.smallBlindAmount, sb.chips);

    const bbAmount = Math.min(this.bigBlindAmount, bb.chips);

    sb.bet(sbAmount);

    bb.bet(bbAmount);

    this.pot = sbAmount + bbAmount;

    this.currentBet = Math.max(sb.currentBet, bb.currentBet);
  }

  // =====================================================
  // START GAME
  // =====================================================

  startGame() {
    // =====================================================
    // فقط بازیکن‌های دارای چیپ
    // =====================================================

    const playablePlayers = this.players.filter((player) => player.chips > 0);

    if (playablePlayers.length < 2) {
      console.log(
        "❌ CANNOT START GAME - PLAYABLE PLAYERS:",
        playablePlayers.length,
      );

      this.state = GameState.WAITING;

      return;
    }

    // =====================================================
    // بازیکن‌های بدون چیپ
    // =====================================================

    this.players.forEach((player) => {
      if (player.chips <= 0) {
        player.folded = true;
      } else {
        player.folded = false;
      }
    });

    // =====================================================
    // فقط بازیکن‌های قابل بازی
    // =====================================================

    const activePlayers = this.players.filter((player) => player.chips > 0);

    console.log(
      "🎮 START GAME PLAYERS:",
      activePlayers.map((p) => ({
        username: p.username,
        chips: p.chips,
      })),
    );

    // =====================================================
    // DECK
    // =====================================================

    this.deck.reset();

    this.deck.shuffle();

    this.communityCards = [];

    this.pot = 0;

    this.currentBet = 0;

    this.state = GameState.PRE_FLOP;

    // =====================================================
    // RESET PLAYERS
    // =====================================================

    this.players.forEach((player) => {
      player.clearHand();

      player.currentBet = 0;

      player.lastAction = null;

      (player as any).actedThisRound = false;

      // بازیکن بدون چیپ بازی نمی‌کند
      if (player.chips <= 0) {
        player.folded = true;
      } else {
        player.folded = false;
      }
    });

    // =====================================================
    // DEALER
    // =====================================================

    // اگر Dealer چیپ ندارد، برو بازیکن بعدی
    let dealerAttempts = 0;

    while (
      this.players[this.dealerIndex]?.chips <= 0 &&
      dealerAttempts < this.players.length
    ) {
      this.dealerIndex = (this.dealerIndex + 1) % this.players.length;

      dealerAttempts++;
    }

    // =====================================================
    // ASSIGN POSITIONS
    // =====================================================

    this.assignPositions();

    // =====================================================
    // BLINDS
    // =====================================================

    this.collectBlinds();

    // =====================================================
    // DEAL CARDS
    // =====================================================

    for (let i = 0; i < 2; i++) {
      activePlayers.forEach((player) => {
        player.receiveCard(this.deck.draw());
      });
    }

    // =====================================================
    // FIRST PLAYER
    // =====================================================

    if (activePlayers.length === 2) {
      // Heads-up
      const bigBlindIndex = this.players.findIndex((player) => player.bigBlind);

      this.currentPlayerIndex = this.players.findIndex(
        (player) =>
          player.id !== this.players[bigBlindIndex]?.id && player.chips >= 0,
      );
    } else {
      // حالت عادی
      this.currentPlayerIndex = (this.dealerIndex + 3) % this.players.length;

      // اگر بازیکن انتخاب‌شده چیپ ندارد، برو بعدی
      let attempts = 0;

      while (
        this.players[this.currentPlayerIndex]?.chips <= 0 &&
        attempts < this.players.length
      ) {
        this.currentPlayerIndex =
          (this.currentPlayerIndex + 1) % this.players.length;

        attempts++;
      }
    }

    console.log("🎯 CURRENT PLAYER:", this.getCurrentPlayer()?.username);
  }

  // =====================================================
  // FLOP
  // =====================================================

  dealFlop() {
    this.deck.draw();

    this.players.forEach((player) => {
      player.lastAction = null;

      (player as any).actedThisRound = false;
    });

    this.communityCards.push(this.deck.draw());

    this.communityCards.push(this.deck.draw());

    this.communityCards.push(this.deck.draw());
  }

  // =====================================================
  // TURN
  // =====================================================

  dealTurn() {
    this.deck.draw();

    this.players.forEach((player) => {
      player.lastAction = null;

      (player as any).actedThisRound = false;
    });

    this.communityCards.push(this.deck.draw());
  }

  // =====================================================
  // RIVER
  // =====================================================

  dealRiver() {
    this.deck.draw();

    this.players.forEach((player) => {
      player.lastAction = null;

      (player as any).actedThisRound = false;
    });

    this.communityCards.push(this.deck.draw());
  }

  // =====================================================
  // CURRENT PLAYER
  // =====================================================

  getCurrentPlayer() {
    if (
      this.currentPlayerIndex < 0 ||
      this.currentPlayerIndex >= this.players.length
    ) {
      return undefined;
    }

    return this.players[this.currentPlayerIndex];
  }

  // =====================================================
  // NEXT PLAYER
  // =====================================================

  nextPlayer() {
    const playablePlayers = this.players.filter(
      (p) => p.chips > 0 && !p.folded,
    );

    if (playablePlayers.length === 0) {
      return;
    }

    const nextIndex = this.findNextActivePlayer(this.currentPlayerIndex);

    if (nextIndex !== -1) {
      this.currentPlayerIndex = nextIndex;
    }
  }

  // =====================================================
  // FIND NEXT ACTIVE PLAYER
  // =====================================================

  findNextActivePlayer(fromIndex: number) {
    if (this.players.length === 0) {
      return -1;
    }

    for (let i = 1; i <= this.players.length; i++) {
      const index = (fromIndex + i) % this.players.length;

      const player = this.players[index];

      if (player && player.chips > 0 && !player.folded && !player.allIn) {
        return index;
      }
    }

    return -1;
  }

  // =====================================================
  // NEXT DEALER
  // =====================================================

  nextDealer() {
    if (this.players.length === 0) {
      this.dealerIndex = 0;

      return;
    }

    const nextDealer = this.findNextPlayablePlayer(this.dealerIndex);

    if (nextDealer !== -1) {
      this.dealerIndex = nextDealer;
    }
  }

  // =====================================================
  // FIRST PLAYER AFTER DEALER
  // =====================================================

  getFirstPlayerAfterDealer() {
    const index = this.findNextPlayablePlayer(this.dealerIndex);

    return index;
  }

  // =====================================================
  // TABLE STATUS
  // =====================================================

  printStatus() {
    console.log("========== TABLE ==========");

    console.log("Pot:", this.pot);

    console.log("Community:", this.communityCards);

    console.log("State:", this.state);

    console.log("---------------------------");

    this.players.forEach((player) => {
      console.log({
        username: player.username,

        chips: player.chips,

        currentBet: player.currentBet,

        dealer: player.dealer,

        smallBlind: player.smallBlind,

        bigBlind: player.bigBlind,

        folded: player.folded,

        allIn: player.allIn,

        outOfChips: (player as any).outOfChips,

        cards: player.hand,
      });
    });

    console.log("===========================");
  }
}
