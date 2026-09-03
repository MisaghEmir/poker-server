import Player from "../Player";
import HandEvaluator from "../HandEvaluator";
import PokerEngine from "../PokerEngine";
import { PlayerAction } from "../PlayerAction";

type BotStyle = "tight" | "aggressive" | "balanced" | "loose";

export default class PokerBot extends Player {
  style: BotStyle;
  isBot = true;

  constructor(id: string, username: string, style: BotStyle = "balanced") {
    super(id, username);

    this.style = style;

    // مقدار اولیه چیپ
    this.chips = 10000;
  }

  /**
   * قدرت دست
   */
  getStrength(engine: PokerEngine) {
    const result = HandEvaluator.evaluate(
      this.hand,
      engine.room.communityCards,
    );

    return result.score;
  }

  /**
   * آیا حریف ALL-IN کرده؟
   */
  isOpponentAllIn(engine: PokerEngine) {
    return engine.room.players.some(
      (player) => player.id !== this.id && !player.folded && player.allIn,
    );
  }

  /**
   * مقدار شرط فعلی حریف
   */
  getHighestBet(engine: PokerEngine) {
    const activePlayers = engine.room.players.filter(
      (player) => !player.folded && player.id !== this.id,
    );

    if (activePlayers.length === 0) {
      return 0;
    }

    return Math.max(...activePlayers.map((player) => player.currentBet));
  }

  /**
   * محاسبه مقدار CALL
   */
  getCallAmount(engine: PokerEngine) {
    const highestBet = this.getHighestBet(engine);

    return Math.max(0, highestBet - this.currentBet);
  }

  /**
   * تصمیم اصلی بات
   */
  async think(engine: PokerEngine): Promise<{
    action: PlayerAction;
    amount: number;
  }> {
    const strength = this.getStrength(engine);

    const callAmount = this.getCallAmount(engine);

    const highestBet = this.getHighestBet(engine);

    const opponentAllIn = this.isOpponentAllIn(engine);

    const pot = engine.room.pot;

    const chips = this.chips;

    console.log(`🤖 ${this.username}`, {
      style: this.style,
      strength,
      chips,
      callAmount,
      highestBet,
      pot,
      opponentAllIn,
    });

    /**
     * اگر چیپ نداریم
     */
    if (chips <= 0) {
      return {
        action: PlayerAction.FOLD,
        amount: 0,
      };
    }

    /**
     * ==========================================
     * ALL-IN حریف
     * ==========================================
     */

    if (opponentAllIn) {
      /**
       * دست خیلی قوی
       *
       * Straight Flush
       * Four
       * Full House
       * Flush
       */
      if (strength >= 600) {
        console.log(`🔥 ${this.username} CALL ALL-IN - STRONG HAND`);

        return {
          action: PlayerAction.CALL,
          amount: Math.min(callAmount, chips),
        };
      }

      /**
       * Straight / Three of a kind
       */
      if (strength >= 400) {
        /**
         * بات aggressive کمی بیشتر ریسک می‌کند
         */
        if (this.style === "aggressive" && Math.random() < 0.35) {
          return {
            action: PlayerAction.CALL,
            amount: Math.min(callAmount, chips),
          };
        }

        /**
         * balanced / tight
         */
        if (Math.random() < 0.55) {
          return {
            action: PlayerAction.CALL,
            amount: Math.min(callAmount, chips),
          };
        }

        return {
          action: PlayerAction.FOLD,
          amount: 0,
        };
      }

      /**
       * Pair / Two Pair
       *
       * مقابل ALL-IN ریسک بالاست
       */
      if (strength >= 200) {
        if (this.style === "loose" && Math.random() < 0.25) {
          return {
            action: PlayerAction.CALL,
            amount: Math.min(callAmount, chips),
          };
        }

        return {
          action: PlayerAction.FOLD,
          amount: 0,
        };
      }

      /**
       * دست ضعیف
       */
      return {
        action: PlayerAction.FOLD,
        amount: 0,
      };
    }

    /**
     * ==========================================
     * HAND خیلی قوی
     * ==========================================
     */

    if (strength >= 700) {
      console.log(`🔥 ${this.username} VERY STRONG HAND`);

      /**
       * اگر چیپ کافی داریم ALL-IN
       */
      if (chips <= Math.max(20, pot * 2)) {
        return {
          action: PlayerAction.ALL_IN,
          amount: chips,
        };
      }

      /**
       * aggressive
       */
      if (this.style === "aggressive" || Math.random() < 0.5) {
        const raiseAmount = Math.min(
          chips,
          Math.max(engine.room.bigBlindAmount * 3, highestBet * 2),
        );

        return {
          action: PlayerAction.RAISE,
          amount: raiseAmount,
        };
      }

      /**
       * برای trap کردن حریف
       */
      return {
        action: callAmount > 0 ? PlayerAction.CALL : PlayerAction.CHECK,
        amount: Math.min(callAmount, chips),
      };
    }

    /**
     * ==========================================
     * HAND خوب
     * ==========================================
     */

    if (strength >= 500) {
      /**
       * aggressive
       */
      if (this.style === "aggressive" || Math.random() < 0.65) {
        const raiseAmount = Math.min(
          chips,
          Math.max(
            engine.room.bigBlindAmount * 2,
            highestBet + engine.room.bigBlindAmount * 2,
          ),
        );

        return {
          action: PlayerAction.RAISE,
          amount: Math.max(0, raiseAmount),
        };
      }

      /**
       * CALL
       */
      if (callAmount > 0) {
        return {
          action: PlayerAction.CALL,
          amount: Math.min(callAmount, chips),
        };
      }

      return {
        action: PlayerAction.CHECK,
        amount: 0,
      };
    }

    /**
     * ==========================================
     * HAND متوسط
     * ==========================================
     */

    if (strength >= 300) {
      /**
       * aggressive
       */
      if (this.style === "aggressive" && Math.random() < 0.4) {
        const raiseAmount = Math.min(
          chips,
          Math.max(
            engine.room.bigBlindAmount * 2,
            highestBet + engine.room.bigBlindAmount,
          ),
        );

        return {
          action: PlayerAction.RAISE,
          amount: raiseAmount,
        };
      }

      /**
       * اگر CALL ارزان باشد
       */
      if (callAmount <= Math.max(engine.room.bigBlindAmount * 3, chips * 0.1)) {
        return {
          action: callAmount > 0 ? PlayerAction.CALL : PlayerAction.CHECK,
          amount: Math.min(callAmount, chips),
        };
      }

      /**
       * loose گاهی CALL می‌کند
       */
      if (this.style === "loose" && Math.random() < 0.35) {
        return {
          action: PlayerAction.CALL,
          amount: Math.min(callAmount, chips),
        };
      }

      return {
        action: PlayerAction.FOLD,
        amount: 0,
      };
    }

    /**
     * ==========================================
     * PAIR
     * ==========================================
     */

    if (strength >= 200) {
      /**
       * pair خوب + aggressive
       */
      if (this.style === "aggressive" && Math.random() < 0.35) {
        const raiseAmount = Math.min(
          chips,
          Math.max(
            engine.room.bigBlindAmount * 2,
            highestBet + engine.room.bigBlindAmount,
          ),
        );

        return {
          action: PlayerAction.RAISE,
          amount: raiseAmount,
        };
      }

      /**
       * CALL ارزان
       */
      if (callAmount <= engine.room.bigBlindAmount * 2) {
        return {
          action: callAmount > 0 ? PlayerAction.CALL : PlayerAction.CHECK,
          amount: Math.min(callAmount, chips),
        };
      }

      /**
       * loose
       */
      if (this.style === "loose" && Math.random() < 0.25) {
        return {
          action: PlayerAction.CALL,
          amount: Math.min(callAmount, chips),
        };
      }

      return {
        action: PlayerAction.FOLD,
        amount: 0,
      };
    }

    /**
     * ==========================================
     * BLUFF
     * ==========================================
     */

    let bluffChance = 0.05;

    switch (this.style) {
      case "tight":
        bluffChance = 0.03;
        break;

      case "balanced":
        bluffChance = 0.08;
        break;

      case "aggressive":
        bluffChance = 0.2;
        break;

      case "loose":
        bluffChance = 0.15;
        break;
    }

    /**
     * اگر شرط خیلی سنگین نیست،
     * گاهی BLUFF می‌کنیم
     */
    if (Math.random() < bluffChance && callAmount <= chips * 0.15) {
      console.log(`😈 ${this.username} BLUFF`);

      const bluffRaise = Math.min(
        chips,
        Math.max(
          engine.room.bigBlindAmount * 2,
          highestBet + engine.room.bigBlindAmount * 2,
        ),
      );

      return {
        action: PlayerAction.RAISE,
        amount: bluffRaise,
      };
    }

    /**
     * ==========================================
     * دست ضعیف
     * ==========================================
     */

    if (callAmount === 0) {
      return {
        action: PlayerAction.CHECK,
        amount: 0,
      };
    }

    /**
     * CALL خیلی ارزان
     */
    if (callAmount <= engine.room.bigBlindAmount) {
      return {
        action: PlayerAction.CALL,
        amount: Math.min(callAmount, chips),
      };
    }

    /**
     * FOLD
     */
    return {
      action: PlayerAction.FOLD,
      amount: 0,
    };
  }
}

// first

// import Player from "../Player";
// import PokerEngine from "../PokerEngine";
// import { PlayerAction } from "../PlayerAction";
// import HandEvaluator from "./HandEvaluator";

// export type BotStyle = "tight" | "aggressive" | "balanced" | "loose";

// export default class PokerBot extends Player {
//   style: string;
//   isBot = true;

//   constructor(id: string, username: string, style: string) {
//     super(id, username, Math.floor(Math.random() * 1000));

//     this.style = style;
//   }

//   getStrength(engine: any) {
//     return HandEvaluator.evaluate(this.hand, engine.room.communityCards);
//   }

//   async think(engine: any) {
//     const strength = this.getStrength(engine);

//     const bet = Math.max(...engine.room.players.map((p: any) => p.currentBet));

//     const call = bet - this.currentBet;

//     // دست ضعیف
//     if (strength < 200 && call > this.chips * 0.1) {
//       return {
//         action: PlayerAction.FOLD,
//         amount: 0,
//       };
//     }

//     // دست متوسط
//     if (strength < 500) {
//       return {
//         action: PlayerAction.CALL,
//         amount: 0,
//       };
//     }

//     // دست قوی
//     if (strength >= 500) {
//       return {
//         action: PlayerAction.RAISE,
//         amount: Math.min(this.chips, bet * 2),
//       };
//     }

//     return {
//       action: PlayerAction.CHECK,
//       amount: 0,
//     };
//   }
// }
//  ی ربات بازی پوکر هست میخوام خیلی حرفه ای تر بشه
