import { Server, Socket } from "socket.io";
import Room from "../game/Room";
import PokerEngine from "../game/PokerEngine";
import PokerBot from "../game/bots/PokerBot";
import Player from "../game/Player";
import { PlayerAction } from "../game/PlayerAction";
import { GameState } from "../game/GameState";

const turnTimers = new Map<string, NodeJS.Timeout>();

const botTimers = new Map<string, NodeJS.Timeout>();

const socketUsers = new Map<string, string>();

const games = new Map<
  string,
  {
    room: Room;
    engine: PokerEngine;
  }
>();

export function pokerGameSocket(io: Server) {
  io.on("connection", (socket: Socket) => {
    console.log("socket:", socket.id);

    socket.on("join-game-bot", ({ roomId, userId, username }) => {
      let game = games.get(roomId);

      if (!game) {
        const room = new Room(roomId);

        const bots = [
          new PokerBot("bot1", "Ali", "tight"),
          new PokerBot("bot2", "Sara", "aggressive"),
          new PokerBot("bot3", "Reza", "balanced"),
          new PokerBot("bot4", "Mina", "loose"),
        ];

        bots.forEach((bot) => {
          room.addPlayer(bot);
        });

        const engine = new PokerEngine(room);

        engine.onUpdate = () => {
          emitGameUpdate(io, roomId, room);

          setTimeout(() => {
            checkBotTurn(io, roomId, { room, engine });
          }, 100);
        };

        game = {
          room,
          engine,
        };

        games.set(roomId, game);
      }

      const existPlayer = game.room.players.find((p) => p.id === userId);

      if (!existPlayer) {
        const player = new Player(userId, username);

        game.room.addPlayer(player);
      }

      socketUsers.set(socket.id, userId);

      socket.join(roomId);

      socket.emit("join-success", {
        roomId,

        players: game.room.players.map((p) => ({
          id: p.id,
          username: p.username,
          chips: p.chips,
          isBot: (p as any).isBot ?? false,
        })),
      });
    });

    socket.on("start-game-bot", ({ roomId, userId }) => {
      const game = games.get(roomId);

      if (!game) return;

      game.room.startGame();

      console.log("GAME START:", roomId);
      //
      socket.emit("game-start", serialize(game.room, userId));

      socket.to(roomId).emit("game-start", serialize(game.room));

      checkBotTurn(io, roomId, game);
    });

    socket.on("action", ({ roomId, userId, action, amount }) => {
      const game = games.get(roomId);

      if (!game) return;

      const player = game.room.players.find((p) => p.id === userId);

      if (!player) return;

      if (game.engine.getCurrentPlayer().id !== userId) return;

      const timer = turnTimers.get(roomId);

      if (timer) {
        clearTimeout(timer);

        turnTimers.delete(roomId);
      }

      game.engine.playerAction(player, action, amount);

      socket.emit("game-update", serialize(game.room, userId));

      socket.to(roomId).emit("game-update", serialize(game.room));

      setTimeout(() => {
        checkBotTurn(io, roomId, game);
      }, 700);
    });

    socket.on("leave-game-bot", ({ roomId }) => {
      removePlayer(socket, io);
    });
    socket.on("disconnect", () => {
      console.log("DISCONNECT:", socket.id);

      removePlayer(socket, io);
    });
  });
}

async function checkBotTurn(
  io: Server,
  roomId: string,
  game: {
    room: Room;
    engine: PokerEngine;
  },
) {
  if (game.room.state === GameState.SHOWDOWN) {
    // console.log("HAND FINISHED");
    return;
  }
  //
  const player = game.engine.getCurrentPlayer();

  if (!player) return;

  // console.log("TURN:", player.username);

  if (!(player instanceof PokerBot)) {
    // console.log("HUMAN TURN");

    io.to(roomId).emit("turn-start", {
      playerId: player.id,
      seconds: 10,
    });

    // const timer = setTimeout(() => {
    //   if (game.engine.getCurrentPlayer().id !== player.id) return;

    //   console.log("AUTO FOLD:", player.username);

    //   game.engine.playerAction(player, PlayerAction.FOLD);

    //   emitGameUpdate(io, roomId, game.room);

    //   checkBotTurn(io, roomId, game);
    // }, 10000);

    // turnTimers.set(roomId, timer);

    return;
  }

  const oldTimer = botTimers.get(roomId);

  if (oldTimer) {
    clearTimeout(oldTimer);
  }

  let thinkTime = 3000;

  switch (player.style) {
    case "tight":
      thinkTime = 5000 + Math.random() * 5000;
      break;

    case "aggressive":
      thinkTime = 2000 + Math.random() * 3000;
      break;

    case "balanced":
      thinkTime = 4000 + Math.random() * 5000;
      break;

    case "loose":
      thinkTime = 5000 + Math.random() * 7000;
      break;
  }

  const currentPlayerId = player.id;

  const timer = setTimeout(async () => {
    if (game.engine.getCurrentPlayer().id !== currentPlayerId) {
      console.log("OLD TIMER STOP:", player.username);
      return;
    }

    if (game.room.state === GameState.SHOWDOWN) {
      console.log("CHECKBOT SHOWDOWN");
      return;
    }

    const move = await player.think(game.engine);

    // console.log("BOT MOVE:", player.username, move);

    game.engine.playerAction(player, move.action, move.amount);

    emitGameUpdate(io, roomId, game.room);

    // 700ms صبر برای انیمیشن
    await new Promise((resolve) => setTimeout(resolve, 700));

    checkBotTurn(io, roomId, game);
  }, thinkTime);

  botTimers.set(roomId, timer);
}

function emitGameUpdate(io: Server, roomId: string, room: Room) {
  room.players.forEach((player) => {
    const socketId = [...socketUsers.entries()].find(
      ([_, userId]) => userId === player.id,
    )?.[0];

    if (socketId) {
      io.to(socketId).emit("game-update", serialize(room, player.id));
    }
  });
}

function serialize(room: Room, userId?: string) {
  return {
    pot: room.pot,

    communityCards: room.communityCards,

    turn: room.getCurrentPlayer()?.id,

    state: room.state,

    winner: room.winner
      ? {
          id: room.winner.id,
          username: room.winner.username,
          hand: room.winnerHand,
        }
      : null,

    players: room.players.map((p) => ({
      id: p.id,

      username: p.username,

      chips: p.chips,

      bet: p.currentBet,

      folded: p.folded,

      currentBet: p.currentBet,
      lastAction: p.lastAction,

      dealer: p.dealer,

      smallBlind: p.smallBlind,

      bigBlind: p.bigBlind,

      isBot: (p as any).isBot ?? false,

      hand: room.state === GameState.SHOWDOWN || p.id === userId ? p.hand : [],
    })),
  };
}

function removePlayer(socket: Socket, io: Server) {
  const userId = socketUsers.get(socket.id);

  if (!userId) return;

  socketUsers.delete(socket.id);

  for (const [roomId, game] of games.entries()) {
    const index = game.room.players.findIndex((p) => p.id === userId);

    if (index === -1) continue;

    // اگر نوبت خودش بود فولد شود
    if (game.engine.getCurrentPlayer()?.id === userId) {
      game.engine.playerAction(game.room.players[index], PlayerAction.FOLD);
    }

    // حذف بازیکن
    game.room.removePlayer(userId);

    // آیا بازیکن واقعی مانده؟
    const humanPlayers = game.room.players.filter((p) => !(p as any).isBot);

    if (humanPlayers.length === 0) {
      console.log("STOP GAME:", roomId);

      // توقف تایمر راند
      if (game.engine.roundTimer) {
        clearTimeout(game.engine.roundTimer);
        game.engine.roundTimer = undefined;
      }

      // توقف تایمر بات
      const botTimer = botTimers.get(roomId);
      if (botTimer) {
        clearTimeout(botTimer);
        botTimers.delete(roomId);
      }

      // توقف تایمر نوبت
      const turnTimer = turnTimers.get(roomId);
      if (turnTimer) {
        clearTimeout(turnTimer);
        turnTimers.delete(roomId);
      }

      // حذف بازی از حافظه
      games.delete(roomId);

      return;
    }

    // آپدیت برای بازیکنان باقی‌مانده
    emitGameUpdate(io, roomId, game.room);

    // ادامه بازی
    checkBotTurn(io, roomId, game);

    return;
  }
}
