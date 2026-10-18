import { Server, Socket } from "socket.io";
import User from "../models/User";

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

    // =====================================================
    // JOIN BOT GAME
    // =====================================================

    socket.on(
      "join-game-bot",
      ({ roomId, userId, username, chip, smallBlind, bigBlind }) => {
        let game = games.get(roomId);

        console.log("🟢 SMALL BLIND:", smallBlind);
        console.log("🔵 BIG BLIND:", bigBlind);

        if (!game) {
          const room = new Room(roomId, smallBlind, bigBlind);

          function getRandomBotChips(
            smallBlind: number,
            bigBlind: number,
          ): number {
            const tableRanges: Record<string, { min: number; max: number }> = {
              "1/2": { min: 40, max: 200 },
              "2/4": { min: 80, max: 400 },
              "5/10": { min: 200, max: 1000 },
              "10/20": { min: 800, max: 4000 },
              "20/40": { min: 2000, max: 5000 },
            };

            const key = `${Number(smallBlind)}/${Number(bigBlind)}`;

            const range = tableRanges[key];

            if (!range) {
              throw new Error(`Unknown poker table stakes: ${key}`);
            }

            return (
              Math.floor(Math.random() * (range.max - range.min)) 
              
            );
          }

          const bots = [
            new PokerBot(
              "bot1",
              "Oliver",
              "tight",
              getRandomBotChips(smallBlind, bigBlind),
            ),
            new PokerBot(
              "bot2",
              "Emily",
              "aggressive",
              getRandomBotChips(smallBlind, bigBlind),
            ),
            new PokerBot(
              "bot3",
              "Dante",
              "balanced",
              getRandomBotChips(smallBlind, bigBlind),
            ),
            new PokerBot(
              "bot4",
              "Zoe",
              "loose",
              getRandomBotChips(smallBlind, bigBlind),
            ),
          ];

          console.log(
            "🤖 BOT CHIPS:",
            bots.map((bot) => ({
              username: bot.username,
              chips: bot.chips,
            })),
          );

          console.log(
            "🤖 BOT INITIAL CHIPS:",
            bots.map((bot) => ({
              username: bot.username,
              chips: bot.chips,
            })),
          );

          bots.forEach((bot) => {
            room.addPlayer(bot);
          });

          const engine = new PokerEngine(room);

          engine.onUpdate = () => {
            emitGameUpdate(io, roomId, room);

            setTimeout(() => {
              checkBotTurn(io, roomId, {
                room,
                engine,
              });
            }, 100);
          };

          game = {
            room,
            engine,
          };

          games.set(roomId, game);
        }

        // =================================================
        // EXISTING PLAYER
        // =================================================

        const existPlayer = game.room.players.find(
          (p) => String(p.id) === String(userId),
        );

        // =================================================
        // ADD NEW PLAYER
        // =================================================

        if (!existPlayer) {
          const player = new Player(userId, username, Number(chip));

          game.room.addPlayer(player);
        }

        // =================================================
        // SOCKET USER
        // =================================================

        socketUsers.set(socket.id, userId);

        socket.join(roomId);

        // =================================================
        // JOIN SUCCESS
        // =================================================

        socket.emit("join-success", {
          roomId,

          players: game.room.players.map((p) => ({
            id: p.id,
            username: p.username,
            chips: p.chips,
            isBot: (p as any).isBot ?? false,
          })),
        });
      },
    );

    // =====================================================
    // START GAME
    // =====================================================

    socket.on("start-game-bot", ({ roomId, userId }) => {
      const game = games.get(roomId);

      if (!game) return;

      game.room.startGame();

      console.log("GAME START:", roomId);

      socket.emit("game-start", serialize(game.room, userId));

      socket.to(roomId).emit("game-start", serialize(game.room));

      checkBotTurn(io, roomId, game);
    });

    // =====================================================
    // PLAYER ACTION
    // =====================================================

    socket.on("action", ({ roomId, userId, action, amount }) => {
      const game = games.get(roomId);

      if (!game) return;

      const player = game.room.players.find(
        (p) => String(p.id) === String(userId),
      );

      if (!player) return;

      if (game.engine.getCurrentPlayer()?.id !== userId) {
        return;
      }

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

    // =====================================================
    // ADD CHIPS
    // =====================================================

    socket.on("add-chips-bot", async ({ roomId, userId, amount }) => {
      try {
        console.log("\n💰 ================= ADD CHIPS =================");

        console.log("ROOM:", roomId);

        console.log("USER:", userId);

        console.log("AMOUNT:", amount);

        // =============================================
        // GAME
        // =============================================

        const game = games.get(roomId);

        if (!game) {
          socket.emit("add-chips-error", {
            message: "Game not found.",
          });

          return;
        }

        // =============================================
        // VALIDATE USER
        // =============================================

        if (!userId) {
          socket.emit("add-chips-error", {
            message: "User not found.",
          });

          return;
        }

        // =============================================
        // CHECK SOCKET USER
        // =============================================

        const socketUserId = socketUsers.get(socket.id);

        if (String(socketUserId) !== String(userId)) {
          socket.emit("add-chips-error", {
            message: "Unauthorized.",
          });

          return;
        }

        // =============================================
        // AMOUNT
        // =============================================

        const addAmount = Number(amount);

        if (
          !Number.isFinite(addAmount) ||
          !Number.isInteger(addAmount) ||
          addAmount <= 0
        ) {
          socket.emit("add-chips-error", {
            message: "Invalid chip amount.",
          });

          return;
        }

        // =============================================
        // FIND PLAYER
        // =============================================

        const player = game.room.players.find(
          (p) => String(p.id) === String(userId),
        );

        if (!player) {
          socket.emit("add-chips-error", {
            message: "Player is not in this table.",
          });

          return;
        }

        // =============================================
        // BOT CHECK
        // =============================================

        if (player instanceof PokerBot) {
          socket.emit("add-chips-error", {
            message: "Bots cannot add chips.",
          });

          return;
        }

        // =============================================
        // DEDUCT FROM USER ACCOUNT
        //
        // ATOMIC OPERATION
        // =============================================

        const updatedUser = await User.findOneAndUpdate(
          {
            _id: userId,

            chips: {
              $gte: addAmount,
            },
          },
          {
            $inc: {
              chips: -addAmount,
            },
          },
          {
            new: true,
          },
        );

        // =============================================
        // NOT ENOUGH ACCOUNT CHIPS
        // =============================================

        if (!updatedUser) {
          console.log("❌ NOT ENOUGH ACCOUNT CHIPS");

          socket.emit("add-chips-error", {
            message: "Not enough chips.",
          });

          return;
        }

        // =============================================
        // ADD TO TABLE
        // =============================================

        player.chips += addAmount;

        console.log("✅ ADD CHIPS SUCCESS");

        console.log("👤 PLAYER:", player.username);

        console.log("➕ ADDED:", addAmount);

        console.log("🎰 TABLE CHIPS:", player.chips);

        console.log("💰 ACCOUNT CHIPS:", updatedUser.chips);

        // =============================================
        // SUCCESS EVENT
        // =============================================

        socket.emit("add-chips-success", {
          amount: addAmount,

          tableChips: player.chips,

          accountChips: updatedUser.chips,
        });

        // =============================================
        // UPDATE EVERY PLAYER
        // =============================================

        emitGameUpdate(io, roomId, game.room);

        console.log("================================================\n");
      } catch (error) {
        console.error("❌ ADD CHIPS ERROR:", error);

        socket.emit("add-chips-error", {
          message: "Failed to add chips.",
        });
      }
    });

    // =====================================================
    // NORMAL LEAVE
    // =====================================================

    socket.on("leave-game-bot", ({ roomId }) => {
      console.log("🚪 NORMAL LEAVE:", socket.id, roomId);

      // خروج عادی:
      // BotScreen قبلاً چیپ‌ها را با API برگردانده است.
      // بنابراین اینجا دوباره refund نمی‌کنیم.
      removePlayer(socket, io, false);
    });

    // =====================================================
    // DISCONNECT
    // =====================================================

    socket.on("disconnect", async () => {
      console.log("🔴 DISCONNECT:", socket.id);

      // disconnect غیرعادی:
      // چیپ باقی‌مانده داخل میز باید به حساب کاربر برگردد.
      await removePlayer(socket, io, true);
    });
  });
}

// =========================================================
// BOT TURN
// =========================================================

async function checkBotTurn(
  io: Server,
  roomId: string,
  game: {
    room: Room;
    engine: PokerEngine;
  },
) {
  if (game.room.state === GameState.SHOWDOWN) {
    return;
  }

  const player = game.engine.getCurrentPlayer();

  if (!player) return;

  // =======================================================
  // HUMAN TURN
  // =======================================================

  if (!(player instanceof PokerBot)) {
    io.to(roomId).emit("turn-start", {
      playerId: player.id,
      seconds: 10,
    });

    return;
  }

  // =======================================================
  // BOT TIMER
  // =======================================================

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
    if (game.engine.getCurrentPlayer()?.id !== currentPlayerId) {
      console.log("OLD TIMER STOP:", player.username);

      return;
    }

    if (game.room.state === GameState.SHOWDOWN) {
      console.log("CHECKBOT SHOWDOWN");

      return;
    }

    const move = await player.think(game.engine);

    game.engine.playerAction(player, move.action, move.amount);

    emitGameUpdate(io, roomId, game.room);

    await new Promise((resolve) => setTimeout(resolve, 700));

    checkBotTurn(io, roomId, game);
  }, thinkTime);

  botTimers.set(roomId, timer);
}

// =========================================================
// GAME UPDATE
// =========================================================

function emitGameUpdate(io: Server, roomId: string, room: Room) {
  room.players.forEach((player) => {
    const socketId = [...socketUsers.entries()].find(
      ([_, userId]) => String(userId) === String(player.id),
    )?.[0];

    if (socketId) {
      io.to(socketId).emit("game-update", serialize(room, player.id));
    }
  });
}

// =========================================================
// SERIALIZE
// =========================================================

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

          winnerCards: room.winnerCards,
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

// =========================================================
// REMOVE PLAYER
// =========================================================

async function removePlayer(socket: Socket, io: Server, shouldRefund = false) {
  const userId = socketUsers.get(socket.id);

  if (!userId) {
    console.log("⚠️ REMOVE PLAYER → USER NOT FOUND:", socket.id);

    return;
  }

  // ================================================
  // FIND GAME + PLAYER BEFORE DELETE
  // ================================================

  let targetGame:
    | {
        room: Room;
        engine: PokerEngine;
      }
    | undefined;

  let targetRoomId: string | undefined;

  let playerIndex = -1;

  for (const [roomId, game] of games.entries()) {
    const index = game.room.players.findIndex(
      (p) => String(p.id) === String(userId),
    );

    if (index !== -1) {
      targetGame = game;
      targetRoomId = roomId;
      playerIndex = index;
      break;
    }
  }

  if (!targetGame || !targetRoomId || playerIndex === -1) {
    socketUsers.delete(socket.id);

    console.log("⚠️ PLAYER GAME NOT FOUND:", userId);

    return;
  }

  const player = targetGame.room.players[playerIndex];

  // ================================================
  // REFUND ON UNEXPECTED DISCONNECT
  // ================================================

  if (shouldRefund && !(player instanceof PokerBot)) {
    const refundAmount = Math.max(0, Math.floor(Number(player.chips)));

    if (refundAmount > 0) {
      try {
        const updatedUser = await User.findByIdAndUpdate(
          userId,
          {
            $inc: {
              chips: refundAmount,
            },
          },
          {
            new: true,
          },
        );

        if (updatedUser) {
          console.log(
            "💰 ================= DISCONNECT REFUND =================",
          );

          console.log("👤 USER:", userId);

          console.log("🎰 ROOM:", targetRoomId);

          console.log("↩️ REFUNDED:", refundAmount);

          console.log("💰 ACCOUNT CHIPS:", updatedUser.chips);

          console.log(
            "========================================================",
          );
        } else {
          console.log("❌ DISCONNECT REFUND → USER NOT FOUND:", userId);
        }
      } catch (error) {
        console.error("❌ DISCONNECT REFUND ERROR:", error);
      }
    } else {
      console.log("ℹ️ DISCONNECT REFUND → NOTHING TO RETURN:", userId);
    }
  }

  // ================================================
  // REMOVE SOCKET USER
  // ================================================

  socketUsers.delete(socket.id);

  // ================================================
  // FOLD IF CURRENT PLAYER
  // ================================================

  if (targetGame.engine.getCurrentPlayer()?.id === userId) {
    targetGame.engine.playerAction(player, PlayerAction.FOLD);
  }

  // ================================================
  // REMOVE PLAYER
  // ================================================

  targetGame.room.removePlayer(userId);

  // ================================================
  // HUMAN PLAYERS
  // ================================================

  const humanPlayers = targetGame.room.players.filter((p) => !(p as any).isBot);

  if (humanPlayers.length === 0) {
    console.log("STOP GAME:", targetRoomId);

    // ==============================================
    // ROUND TIMER
    // ==============================================

    if (targetGame.engine.roundTimer) {
      clearTimeout(targetGame.engine.roundTimer);

      targetGame.engine.roundTimer = undefined;
    }

    // ==============================================
    // BOT TIMER
    // ==============================================

    const botTimer = botTimers.get(targetRoomId);

    if (botTimer) {
      clearTimeout(botTimer);

      botTimers.delete(targetRoomId);
    }

    // ==============================================
    // TURN TIMER
    // ==============================================

    const turnTimer = turnTimers.get(targetRoomId);

    if (turnTimer) {
      clearTimeout(turnTimer);

      turnTimers.delete(targetRoomId);
    }

    // ==============================================
    // DELETE GAME
    // ==============================================

    games.delete(targetRoomId);

    return;
  }

  // ================================================
  // UPDATE REMAINING PLAYERS
  // ================================================

  emitGameUpdate(io, targetRoomId, targetGame.room);

  checkBotTurn(io, targetRoomId, targetGame);
}
