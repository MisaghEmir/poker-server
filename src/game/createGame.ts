import Room from "./Room";
import PokerEngine from "./PokerEngine";
import PokerBot from "./bots/PokerBot";

export function createGame(roomId: string) {
  const room = new Room(roomId);

  const bots = [
    new PokerBot("bot1", "Ali Bot", "tight"),

    new PokerBot("bot2", "Sara Bot", "aggressive"),

    new PokerBot("bot3", "Reza Bot", "balanced"),

    new PokerBot("bot4", "Mina Bot", "loose"),
  ];

  bots.forEach((bot) => {
    room.addPlayer(bot);
  });

  const engine = new PokerEngine(room);

  return {
    room,
    engine,
  };
}
