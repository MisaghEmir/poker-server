import Player from "./game/Player";
import Room from "./game/Room";

const room = new Room("room-1");

room.addPlayer(new Player("1", "Emir"));
room.addPlayer(new Player("2", "Ali"));
room.addPlayer(new Player("3", "Sara"));

room.startGame();

console.log("Players:");

room.players.forEach((player) => {
  console.log(player.username, player.hand);
});

room.dealFlop();

console.log("Flop:", room.communityCards);

room.dealTurn();

console.log("Turn:", room.communityCards);

room.dealRiver();

console.log("River:", room.communityCards);

room.players.forEach((player) => {
  console.log({
    name: player.username,
    dealer: player.dealer,
    smallBlind: player.smallBlind,
    bigBlind: player.bigBlind,
    cards: player.hand,
  });
});

console.log("Pot:", room.pot);

room.players.forEach((player) => {
  console.log(
    player.username,
    "Chips:",
    player.chips,
    "Bet:",
    player.currentBet
  );
});

import PokerEngine from "./game/PokerEngine";

const engine = new PokerEngine(room);

console.log(engine.getCurrentPlayer().username);

engine.call(engine.getCurrentPlayer());

console.log(engine.getCurrentPlayer().username);

engine.raise(engine.getCurrentPlayer(), 5);

console.log(engine.getCurrentPlayer().username);

engine.fold(engine.getCurrentPlayer());

console.log(engine.getCurrentPlayer().username);