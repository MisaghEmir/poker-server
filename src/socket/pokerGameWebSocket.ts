
import { Server, Socket } from "socket.io";

import Room from "../game/Room";
import PokerEngine from "../game/PokerEngine";
import PokerBot from "../game/bots/PokerBot";
import Player from "../game/Player";
import { PlayerAction } from "../game/PlayerAction";
import { GameState } from "../game/GameState";

type WebGame = {
  room: Room;
  engine: PokerEngine;
};

type GuestSocket = {
  guestId: string;
  roomId: string;
};

const botTimers = new Map<string, NodeJS.Timeout>();
const guestSockets = new Map<string, GuestSocket>();
const games = new Map<string, WebGame>();

export function pokerGameWebSocket(io: Server) {
  io.on("connection", (socket: Socket) => {
    console.log("🌐 WEB SOCKET:", socket.id);

    // =====================================================
    // JOIN WEB BOT GAME
    // =====================================================

    socket.on("join-game-bot-web", (data) => {
      try {
        const {
          roomId,
          guestId,
          username,
          chip,
          smallBlind,
          bigBlind,
        } = data || {};

        if (
          !roomId ||
          !guestId ||
          !username ||
          !Number.isFinite(Number(chip)) ||
          Number(chip) <= 0
        ) {
          socket.emit("join-game-bot-web-error", {
            message: "Invalid game information.",
          });
          return;
        }

        const sb = Number(smallBlind);
        const bb = Number(bigBlind);
        const buyIn = Math.floor(Number(chip));

        if (
          !Number.isFinite(sb) ||
          !Number.isFinite(bb) ||
          sb <= 0 ||
          bb <= sb
        ) {
          socket.emit("join-game-bot-web-error", {
            message: "Invalid table stakes.",
          });
          return;
        }

        let game = games.get(String(roomId));

        // CREATE GAME
        if (!game) {
          const room = new Room(String(roomId), sb, bb);

          function getRandomBotChips(
            smallBlind: number,
            bigBlind: number,
          ): number {
            const tableRanges: Record<
              string,
              { min: number; max: number }
            > = {
              "1/2": { min: 40, max: 200 },
              "2/4": { min: 80, max: 400 },
              "5/10": { min: 200, max: 1000 },
              "10/20": { min: 800, max: 4000 },
              "20/40": { min: 2000, max: 5000 },
            };

            const key = `${smallBlind}/${bigBlind}`;
            const range = tableRanges[key];

            if (!range) {
              throw new Error(`Unknown poker stakes: ${key}`);
            }

            return (
              Math.floor(
                Math.random() * (range.max - range.min + 1),
              ) + range.min
            );
          }

          const bots = [
            new PokerBot(
              "bot1",
              "Oliver",
              "tight",
              getRandomBotChips(sb, bb),
            ),
            new PokerBot(
              "bot2",
              "Emily",
              "aggressive",
              getRandomBotChips(sb, bb),
            ),
            new PokerBot(
              "bot3",
              "Dante",
              "balanced",
              getRandomBotChips(sb, bb),
            ),
            new PokerBot(
              "bot4",
              "Zoe",
              "loose",
              getRandomBotChips(sb, bb),
            ),
          ];

          bots.forEach((bot) => room.addPlayer(bot));

          const engine = new PokerEngine(room);

          game = { room, engine };

          engine.onUpdate = () => {
            emitWebGameUpdate(io, String(roomId), room);

            setTimeout(() => {
              checkWebBotTurn(io, String(roomId), game!);
            }, 100);
          };

          games.set(String(roomId), game);

          console.log("🆕 WEB GAME CREATED:", roomId);
        }

        // CHECK EXISTING GUEST
        const existingPlayer = game.room.players.find(
          (player) => String(player.id) === String(guestId),
        );

        if (!existingPlayer) {
          const player = new Player(
            String(guestId),
            String(username).slice(0, 24),
            buyIn,
          );

          game.room.addPlayer(player);
        }

        // REGISTER SOCKET
        guestSockets.set(socket.id, {
          guestId: String(guestId),
          roomId: String(roomId),
        });

        socket.join(String(roomId));

        // JOIN SUCCESS
        socket.emit("join-success-web", {
          roomId,
          guestId,
          players: game.room.players.map((player) => ({
            id: player.id,
            username: player.username,
            chips: player.chips,
            isBot: (player as any).isBot ?? false,
          })),
        });

        console.log("✅ WEB GUEST JOINED:", {
          username,
          guestId,
          roomId,
          socketId: socket.id,
        });
      } catch (error) {
        console.error("WEB JOIN ERROR:", error);

        socket.emit("join-game-bot-web-error", {
          message: "Could not join the game.",
        });
      }
    });

    // =====================================================
    // START GAME
    // =====================================================

    socket.on("start-game-bot-web", (data) => {
      try {
        console.log("🎮 START GAME REQUEST:", data);

        const { roomId, guestId } = data || {};

        const game = games.get(String(roomId));
        const guest = guestSockets.get(socket.id);

        if (!game) {
          console.log("❌ START FAILED: GAME NOT FOUND", roomId);
          return;
        }

        if (!guest) {
          console.log(
            "❌ START FAILED: GUEST SOCKET NOT FOUND",
            socket.id,
          );
          return;
        }

        if (
          guest.roomId !== String(roomId) ||
          guest.guestId !== String(guestId)
        ) {
          console.log("❌ START FAILED: GUEST MISMATCH", {
            registeredGuest: guest,
            receivedGuest: { roomId, guestId },
          });
          return;
        }

        console.log("🎯 CURRENT GAME STATE:", game.room.state);

        if (game.room.state === GameState.SHOWDOWN) {
          console.log("⚠️ GAME ALREADY IN SHOWDOWN");
          return;
        }

        console.log("🚀 CALLING room.startGame()");

        game.room.startGame();

        console.log("✅ ROOM STARTED:", game.room.state);

        const gameData = serializeWebGame(
          game.room,
          String(guestId),
        );

        console.log("📤 SENDING GAME START:", {
          roomId,
          state: gameData.state,
          players: gameData.players.length,
          turn: gameData.turn,
        });

        socket.emit("game-start-web", gameData);

        socket.to(String(roomId)).emit(
          "game-start-web",
          serializeWebGame(game.room),
        );

        checkWebBotTurn(io, String(roomId), game);
      } catch (error) {
        console.error("❌ START GAME ERROR:", error);

        socket.emit("join-game-bot-web-error", {
          message: "Could not start the poker game.",
        });
      }
    });

    // =====================================================
    // PLAYER ACTION
    // =====================================================

    socket.on(
      "action-web",
      ({ roomId, guestId, action, amount }) => {
        try {
          const game = games.get(String(roomId));
          const guest = guestSockets.get(socket.id);

          if (!game || !guest) return;

          if (
            guest.roomId !== String(roomId) ||
            guest.guestId !== String(guestId)
          ) {
            return;
          }

          const player = game.room.players.find(
            (p) => String(p.id) === String(guestId),
          );

          if (!player || player instanceof PokerBot) return;

          if (
            String(game.engine.getCurrentPlayer()?.id) !==
            String(guestId)
          ) {
            return;
          }

          game.engine.playerAction(player, action, amount);

          emitWebGameUpdate(io, String(roomId), game.room);

          setTimeout(() => {
            checkWebBotTurn(io, String(roomId), game);
          }, 700);
        } catch (error) {
          console.error("WEB PLAYER ACTION ERROR:", error);
        }
      },
    );

    // =====================================================
    // ADD CHIPS
    // =====================================================

    socket.on(
      "add-chips-bot-web",
      ({ roomId, guestId, amount }) => {
        const game = games.get(String(roomId));
        const guest = guestSockets.get(socket.id);

        if (!game || !guest) {
          socket.emit("add-chips-error-web", {
            message: "Game not found.",
          });
          return;
        }

        if (
          guest.roomId !== String(roomId) ||
          guest.guestId !== String(guestId)
        ) {
          socket.emit("add-chips-error-web", {
            message: "Unauthorized.",
          });
          return;
        }

        const addAmount = Number(amount);

        if (
          !Number.isFinite(addAmount) ||
          !Number.isInteger(addAmount) ||
          addAmount <= 0
        ) {
          socket.emit("add-chips-error-web", {
            message: "Invalid chip amount.",
          });
          return;
        }

        const player = game.room.players.find(
          (p) => String(p.id) === String(guestId),
        );

        if (!player || player instanceof PokerBot) {
          socket.emit("add-chips-error-web", {
            message: "Player not found.",
          });
          return;
        }

        player.chips += addAmount;

        socket.emit("add-chips-success-web", {
          amount: addAmount,
          tableChips: player.chips,
        });

        emitWebGameUpdate(io, String(roomId), game.room);
      },
    );

    // =====================================================
    // LEAVE GAME
    // =====================================================

    socket.on("leave-game-bot-web", ({ roomId }) => {
      const guest = guestSockets.get(socket.id);

      if (!guest || guest.roomId !== String(roomId)) return;

      console.log("🚪 WEB GUEST LEAVE:", guest.guestId);

      removeWebPlayer(socket, io);
    });

    // =====================================================
    // DISCONNECT
    // =====================================================

    socket.on("disconnect", () => {
      console.log("🔴 WEB DISCONNECT:", socket.id);

      removeWebPlayer(socket, io);
    });
  });
}

// =========================================================
// BOT TURN
// =========================================================

async function checkWebBotTurn(
  io: Server,
  roomId: string,
  game: WebGame,
) {
  if (game.room.state === GameState.SHOWDOWN) return;

  const player = game.engine.getCurrentPlayer();

  if (!player) return;

  // HUMAN TURN
  if (!(player instanceof PokerBot)) {
    io.to(roomId).emit("turn-start-web", {
      playerId: player.id,
      seconds: 10,
    });

    return;
  }

  // BOT TIMER
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
    if (
      String(game.engine.getCurrentPlayer()?.id) !==
      String(currentPlayerId)
    ) {
      return;
    }

    if (game.room.state === GameState.SHOWDOWN) return;

    try {
      const move = await player.think(game.engine);

      game.engine.playerAction(
        player,
        move.action,
        move.amount,
      );

      emitWebGameUpdate(io, roomId, game.room);

      await new Promise((resolve) => setTimeout(resolve, 700));

      checkWebBotTurn(io, roomId, game);
    } catch (error) {
      console.error("WEB BOT ACTION ERROR:", error);
    }
  }, thinkTime);

  botTimers.set(roomId, timer);
}

// =========================================================
// GAME UPDATE
// =========================================================

function emitWebGameUpdate(
  io: Server,
  roomId: string,
  room: Room,
) {
  room.players.forEach((player) => {
    for (const [socketId, guest] of guestSockets.entries()) {
      if (
        guest.roomId === roomId &&
        guest.guestId === String(player.id)
      ) {
        io.to(socketId).emit(
          "game-update-web",
          serializeWebGame(room, guest.guestId),
        );
      }
    }
  });
}

// =========================================================
// SERIALIZE
// =========================================================

function serializeWebGame(room: Room, guestId?: string) {
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

    players: room.players.map((player) => ({
      id: player.id,
      username: player.username,
      chips: player.chips,
      bet: player.currentBet,
      folded: player.folded,
      currentBet: player.currentBet,
      lastAction: player.lastAction,
      dealer: player.dealer,
      smallBlind: player.smallBlind,
      bigBlind: player.bigBlind,
      isBot: (player as any).isBot ?? false,

      hand:
        room.state === GameState.SHOWDOWN ||
        String(player.id) === String(guestId)
          ? player.hand
          : [],
    })),
  };
}

// =========================================================
// REMOVE GUEST
// =========================================================

function removeWebPlayer(socket: Socket, io: Server) {
  const guest = guestSockets.get(socket.id);

  if (!guest) return;

  const { guestId, roomId } = guest;

  const game = games.get(roomId);

  guestSockets.delete(socket.id);

  if (!game) return;

  const player = game.room.players.find(
    (p) => String(p.id) === String(guestId),
  );

  if (!player) return;

  // Fold if it is this guest's turn.
  if (
    String(game.engine.getCurrentPlayer()?.id) ===
    String(guestId)
  ) {
    game.engine.playerAction(player, PlayerAction.FOLD);
  }

  game.room.removePlayer(guestId);

  const remainingGuests = [...guestSockets.values()].filter(
    (item) => item.roomId === roomId,
  );

  if (remainingGuests.length === 0) {
    const timer = botTimers.get(roomId);

    if (timer) {
      clearTimeout(timer);
      botTimers.delete(roomId);
    }

    if (game.engine.roundTimer) {
      clearTimeout(game.engine.roundTimer);
      game.engine.roundTimer = undefined;
    }

    games.delete(roomId);

    console.log("🛑 WEB GAME REMOVED:", roomId);

    return;
  }

  emitWebGameUpdate(io, roomId, game.room);

  checkWebBotTurn(io, roomId, game);
}
