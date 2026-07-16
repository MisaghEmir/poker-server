import { Server, Socket } from "socket.io";
import Room from "../game/Room";
import Player from "../game/Player";
import PokerEngine from "../game/PokerEngine";
import { PlayerAction } from "../game/PlayerAction";

const rooms = new Map<
  string,
  {
    room: Room;
    engine: PokerEngine;
  }
>();

export function pokerGameSocket(io: Server) {
  io.on("connection", (socket: Socket) => {
    console.log("connected:", socket.id);

    // ورود به میز
    socket.on("join-game", ({ roomId, userId, username }) => {
      let game = rooms.get(roomId);

      if (!game) {
        const room = new Room(roomId);

        const engine = new PokerEngine(room);

        game = {
          room,
          engine,
        };

        rooms.set(roomId, game);
      }

      const player = new Player(userId, username);

      game.room.addPlayer(player);

      socket.join(roomId);

      io.to(roomId).emit("room-update", {
        players: game.room.players.map((p) => ({
          id: p.id,
          username: p.username,
          chips: p.chips,
        })),
      });
    });

    // شروع بازی
    socket.on("start-game", ({ roomId }) => {
      const game = rooms.get(roomId);

      if (!game) return;

      game.room.startGame();

      io.to(roomId).emit("game-start", {
        state: game.room.state,
        pot: game.room.pot,

        players: game.room.players.map((p) => ({
          id: p.id,
          username: p.username,
          hand: p.hand,
          chips: p.chips,
          dealer: p.dealer,
          smallBlind: p.smallBlind,
          bigBlind: p.bigBlind,
        })),

        turn: game.engine.getCurrentPlayer().id,
      });
    });

    // حرکت بازیکن
    socket.on("action", ({ roomId, userId, action, amount }) => {
      const game = rooms.get(roomId);

      if (!game) return;

      const player = game.room.players.find((p) => p.id === userId);

      if (!player) return;

      const current = game.engine.getCurrentPlayer();

      if (current.id !== userId) {
        socket.emit("error-message", "Not your turn");

        return;
      }

      game.engine.playerAction(player, action, amount);

      io.to(roomId).emit("game-update", {
        pot: game.room.pot,

        players: game.room.players.map((p) => ({
          id: p.id,
          username: p.username,
          chips: p.chips,
          bet: p.currentBet,
          folded: p.folded,
          lastAction: p.lastAction,
        })),

        communityCards: game.room.communityCards,

        turn: game.engine.getCurrentPlayer().id,
      });
    });

    socket.on("disconnect", () => {
      console.log("left:", socket.id);
    });
  });
}
