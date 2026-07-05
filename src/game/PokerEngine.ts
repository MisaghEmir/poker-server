import Room from "./Room";
import Player from "./Player";
import { GameState } from "./GameState";
import { PlayerAction } from "./PlayerAction";

export default class PokerEngine {
  room: Room;

  constructor(room: Room) {
    this.room = room;
  }

  getCurrentPlayer(): Player {
    return this.room.players[this.room.currentPlayerIndex];
  }

  nextTurn() {
    const totalPlayers = this.room.players.length;

    do {
      this.room.currentPlayerIndex =
        (this.room.currentPlayerIndex + 1) % totalPlayers;
    } while (this.room.players[this.room.currentPlayerIndex].folded);
  }

  fold(player: Player) {
    player.fold();

    console.log(`${player.username} Fold`);

    this.nextTurn();
  }

  check(player: Player) {
    console.log(`${player.username} Check`);

    this.nextTurn();
  }

  call(player: Player) {
    const highestBet = Math.max(...this.room.players.map((p) => p.currentBet));

    const amount = highestBet - player.currentBet;

    if (amount > 0) {
      player.bet(amount);
      this.room.pot += amount;
    }

    console.log(`${player.username} Call ${amount}`);

    this.nextTurn();
  }

  raise(player: Player, amount: number) {
    const highestBet = Math.max(...this.room.players.map((p) => p.currentBet));

    const total = highestBet - player.currentBet + amount;

    player.bet(total);

    this.room.pot += total;

    console.log(`${player.username} Raise ${amount}`);

    this.nextTurn();
  }
  nextRound() {
    switch (this.room.state) {
      case GameState.PRE_FLOP:
        this.room.dealFlop();
        this.room.state = GameState.FLOP;
        break;

      case GameState.FLOP:
        this.room.dealTurn();
        this.room.state = GameState.TURN;
        break;

      case GameState.TURN:
        this.room.dealRiver();
        this.room.state = GameState.RIVER;
        break;

      case GameState.RIVER:
        this.room.state = GameState.SHOWDOWN;
        break;
    }
  }
  playerAction(player: Player, action: PlayerAction, amount = 0) {
    switch (action) {
      case PlayerAction.FOLD:
        player.fold();

        break;

      case PlayerAction.CHECK:
        break;

      case PlayerAction.CALL:
        this.call(player);

        break;

      case PlayerAction.RAISE:
        this.raise(player, amount);

        break;

      case PlayerAction.ALL_IN:
        player.bet(player.chips);

        this.room.pot += player.currentBet;

        break;
    }

    player.lastAction = action;

    this.nextTurn();
  }
  private isBettingRoundFinished(): boolean {
    const activePlayers = this.room.players.filter((p) => !p.folded);

    return activePlayers.every(
      (player) => player.currentBet === this.room.currentBet || player.allIn,
    );
  }
}
