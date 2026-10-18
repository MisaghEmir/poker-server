import { Server, Socket } from "socket.io";
import Room from "../game/Room";
import PokerEngine from "../game/PokerEngine";
import Player from "../game/Player";
import { PlayerAction } from "../game/PlayerAction";
import { GameState } from "../game/GameState";
import Table from "../models/Table";
import User from "../models/User";
import mongoose from "mongoose";

// =====================================================
// SOCKET USERS
// socketId -> userId
// =====================================================

const socketUsers = new Map<string, string>();

// =====================================================
// GAMES
// =====================================================

const games = new Map<
  string,
  {
    room: Room;
    engine: PokerEngine;
  }
>();

// =====================================================
// ONLINE GAME SOCKET
// =====================================================

export function onlineGameSocket(io: Server) {
  io.on("connection", (socket: Socket) => {
    console.log("🟢 ONLINE SOCKET:", socket.id);

    // =====================================================
    // JOIN ONLINE TABLE
    // =====================================================

    socket.on(
      "join-online-table",
      async ({ tableId, userId, username, chips, bigBlind, smallBlind }) => {
        try {
          console.log("🔥 JOIN ONLINE TABLE:", {
            tableId,
            userId,
            username,
            chips,
            socketId: socket.id,
            smallBlind,
            bigBlind,
          });

          // =====================================================
          // VALIDATION
          // =====================================================

          if (!tableId || !userId || !username || chips === undefined) {
            socket.emit("online-join-error", {
              message: "Invalid player data",
            });

            return;
          }

          // =====================================================
          // FIND / CREATE GAME
          // =====================================================

          let game = games.get(tableId);

          if (!game) {
            console.log("🆕 CREATE ONLINE GAME:", tableId);

            const room = new Room(tableId);

            const engine = new PokerEngine(room);

            engine.onWin = (playerId, amount) => {
              const player = room.players.find((p) => p.id === playerId);

              if (!player || (player as any).isBot) {
                return;
              }

              User.findByIdAndUpdate(playerId, {
                $inc: { totalWon: amount },
              })
                .then(() => {
                  console.log("🏆 TOTAL WON UPDATED:", {
                    playerId,
                    amount,
                  });
                })
                .catch((error) => {
                  console.error("❌ TOTAL WON UPDATE ERROR:", error);
                });
            };

            engine.onUpdate = () => {
              emitGameUpdate(io, tableId, room);
            };

            game = {
              room,
              engine,
            };

            games.set(tableId, game);
          }

          const { room, engine } = game;

          // =====================================================
          // CHECK EXISTING PLAYER
          // =====================================================

          let player = room.players.find((p) => p.id === userId);

          // =====================================================
          // NEW PLAYER
          // =====================================================

          if (!player) {
            // =====================================================
            // CHECK ROOM CAPACITY
            // =====================================================

            if (room.players.length >= room.maxPlayers) {
              console.log("❌ ONLINE ROOM FULL:", tableId);

              socket.emit("online-join-error", {
                message: "Table is full",
              });

              return;
            }

            // =====================================================
            // CREATE PLAYER
            // =====================================================

            player = new Player(userId, username, chips);

            room.addPlayer(player);

            await Table.findByIdAndUpdate(
              tableId,
              {
                $addToSet: {
                  players: {
                    user: new mongoose.Types.ObjectId(userId),
                    chips: chips,
                    socketId: socket.id,
                  },
                },
              },
              {
                new: true,
              },
            );

            console.log("👤 PLAYER JOINED:", username);

            console.log(
              `👥 PLAYERS: ${room.players.length}/${room.maxPlayers}`,
            );
          } else {
            // =====================================================
            // EXISTING PLAYER
            // =====================================================

            console.log("♻️ PLAYER ALREADY IN ROOM:", username);

            player.chips = chips;

            await Table.findByIdAndUpdate(
              tableId,
              {
                $set: {
                  "players.$[p].chips": chips,
                  "players.$[p].socketId": socket.id,
                },
              },
              {
                arrayFilters: [
                  {
                    "p.user": new mongoose.Types.ObjectId(userId),
                  },
                ],
              },
            );
          }

          // =====================================================
          // SAVE SOCKET USER
          // =====================================================

          socketUsers.set(socket.id, userId);

          // =====================================================
          // JOIN SOCKET ROOM
          // =====================================================

          socket.join(tableId);

          // =====================================================
          // JOIN SUCCESS
          // =====================================================

          socket.emit("online-join-success", {
            roomId: tableId,

            players: serializePlayers(room),
          });

          // =====================================================
          // CURRENT GAME UPDATE
          // =====================================================

          emitGameUpdate(io, tableId, room);

          // =====================================================
          // CHECK REAL PLAYERS
          // =====================================================

          const realPlayers = room.players.filter(
            (p) => !(p as any).isBot && p.chips > 0,
          );

          console.log("👥 PLAYABLE PLAYERS:", {
            count: realPlayers.length,
            players: realPlayers.map((p) => ({
              id: p.id,
              username: p.username,
              chips: p.chips,
            })),
          });

          if (realPlayers.length >= 2 && room.state === GameState.WAITING) {
            console.log("🎮 STARTING GAME - 2+ PLAYABLE PLAYERS");

            room.startGame();

            io.to(tableId).emit("online-game-start", serialize(room));

            emitGameUpdate(io, tableId, room);

            setTimeout(() => {
              checkTurn(io, tableId, game!);
            }, 300);
          } else {
            console.log(`⏳ WAITING: ${realPlayers.length}/2 PLAYABLE PLAYERS`);
          }

          console.log(`👥 REAL PLAYERS: ${realPlayers.length}/2`);

          // =====================================================
          // START GAME WHEN 2 REAL PLAYERS
          // =====================================================

          if (realPlayers.length >= 2 && room.state === GameState.WAITING) {
            console.log("🎮 ===============================");

            console.log(`🎮 ${realPlayers.length} REAL PLAYERS FOUND`);

            console.log("🎮 STARTING ONLINE GAME:", tableId);

            console.log(
              "🎮 PLAYERS:",
              realPlayers.map((p) => ({
                id: p.id,
                username: p.username,
                chips: p.chips,
              })),
            );

            // =====================================================
            // START GAME
            // =====================================================

            room.startGame();

            console.log("🎮 GAME STARTED:", tableId);

            console.log("🎯 CURRENT TURN:", room.getCurrentPlayer()?.username);

            console.log("🃏 COMMUNITY CARDS:", room.communityCards);

            // =====================================================
            // SEND PERSONALIZED GAME START
            // =====================================================

            emitGameStart(io, tableId, room);

            // =====================================================
            // SEND PERSONALIZED UPDATE
            // =====================================================

            emitGameUpdate(io, tableId, room);

            // =====================================================
            // CHECK TURN
            // =====================================================

            setTimeout(() => {
              checkTurn(io, tableId, game!);
            }, 300);

            console.log("🎮 ===============================");
          } else {
            console.log(`⏳ WAITING FOR PLAYER: ${realPlayers.length}/2`);
          }
        } catch (error) {
          console.error("❌ ONLINE JOIN ERROR:", error);

          socket.emit("online-join-error", {
            message: "Could not join online table",
          });
        }
      },
    );

    // =====================================================
    // PLAYER ACTION
    // =====================================================

    socket.on("online-action", ({ tableId, userId, action, amount }) => {
      try {
        console.log("🎯 ONLINE ACTION:", {
          tableId,
          userId,
          action,
          amount,
        });

        // =====================================================
        // FIND GAME
        // =====================================================

        const game = games.get(tableId);

        if (!game) {
          console.log("❌ GAME NOT FOUND:", tableId);

          return;
        }

        const { room, engine } = game;

        // =====================================================
        // FIND PLAYER
        // =====================================================

        const player = room.players.find((p) => p.id === userId);

        if (!player) {
          console.log("❌ PLAYER NOT FOUND:", userId);

          return;
        }

        // =====================================================
        // CHECK TURN
        // =====================================================

        const currentPlayer = engine.getCurrentPlayer();

        if (!currentPlayer) {
          return;
        }

        if (currentPlayer.id !== userId) {
          console.log("❌ NOT PLAYER TURN:", {
            current: currentPlayer.id,

            request: userId,
          });

          return;
        }

        // =====================================================
        // PLAYER ACTION
        // =====================================================

        engine.playerAction(player, action, amount ?? 0);

        // =====================================================
        // UPDATE
        // =====================================================

        emitGameUpdate(io, tableId, room);

        // =====================================================
        // NEXT TURN
        // =====================================================

        setTimeout(() => {
          checkTurn(io, tableId, game);
        }, 700);
      } catch (error) {
        console.error("❌ ONLINE ACTION ERROR:", error);
      }
    });

    // =====================================================
    // LEAVE ONLINE TABLE
    // =====================================================

    socket.on("leave-online-table", async ({ tableId, userId }) => {
      console.log("🚪 LEAVE ONLINE TABLE:", {
        tableId,
        userId,
      });

      await removePlayer(socket, io, tableId, userId);
    });

    // =====================================================
    // DISCONNECT
    // =====================================================

    socket.on("disconnect", async () => {
      console.log("🔴 ONLINE DISCONNECT:", socket.id);

      const userId = socketUsers.get(socket.id);

      if (!userId) {
        return;
      }

      socketUsers.delete(socket.id);

      // =====================================================
      // FIND PLAYER GAME
      // =====================================================

      for (const [tableId, game] of games.entries()) {
        const player = game.room.players.find((p) => p.id === userId);

        if (!player) {
          continue;
        }

        await removePlayer(socket, io, tableId, userId);

        break;
      }
    });
  });
}

// =====================================================
// CHECK TURN
// =====================================================

function checkTurn(
  io: Server,
  tableId: string,
  game: {
    room: Room;
    engine: PokerEngine;
  },
) {
  const { room, engine } = game;

  // =====================================================
  // SHOWDOWN
  // =====================================================

  if (room.state === GameState.SHOWDOWN) {
    console.log("🏆 SHOWDOWN:", tableId);

    return;
  }

  // =====================================================
  // FINISHED
  // =====================================================

  if (room.state === GameState.FINISHED) {
    return;
  }

  // =====================================================
  // REAL PLAYERS
  // =====================================================

  const realPlayers = room.players.filter((p) => !(p as any).isBot);

  console.log(`👥 CHECK TURN PLAYERS: ${realPlayers.length}/2`);

  // =====================================================
  // WAITING
  // =====================================================

  if (realPlayers.length < 2) {
    console.log(`⏳ NOT ENOUGH PLAYERS: ${realPlayers.length}/2`);

    emitGameUpdate(io, tableId, room);

    return;
  }

  // =====================================================
  // CURRENT PLAYER
  // =====================================================

  const currentPlayer = engine.getCurrentPlayer();

  if (!currentPlayer) {
    console.log("❌ NO CURRENT PLAYER");

    return;
  }

  console.log("🎯 CURRENT TURN:", {
    username: currentPlayer.username,

    id: currentPlayer.id,

    state: room.state,
  });

  // =====================================================
  // SEND TURN
  // =====================================================

  io.to(tableId).emit("online-turn-start", {
    playerId: currentPlayer.id,

    seconds: 10,
  });
}

// =====================================================
// PERSONALIZED GAME START
// =====================================================

async function emitGameStart(io: Server, tableId: string, room: Room) {
  try {
    const sockets = await io.in(tableId).fetchSockets();

    console.log(`📡 GAME START → ${sockets.length} SOCKETS`);

    for (const client of sockets) {
      const userId = socketUsers.get(client.id);

      console.log("🎴 GAME START USER:", {
        socketId: client.id,
        userId,
      });

      const data = serialize(room, userId);

      client.emit("online-game-start", data);
    }
  } catch (error) {
    console.error("❌ GAME START EMIT ERROR:", error);
  }
}

// =====================================================
// PERSONALIZED GAME UPDATE
// =====================================================

async function emitGameUpdate(io: Server, tableId: string, room: Room) {
  try {
    const sockets = await io.in(tableId).fetchSockets();

    console.log("📡 ONLINE GAME UPDATE:", {
      tableId,

      players: room.players.length,

      state: room.state,

      pot: room.pot,

      turn: room.getCurrentPlayer()?.username,

      sockets: sockets.length,
    });

    // =====================================================
    // SEND PERSONALIZED DATA
    // =====================================================

    for (const client of sockets) {
      const userId = socketUsers.get(client.id);

      const data = serialize(room, userId);

      client.emit("online-game-update", data);
    }
  } catch (error) {
    console.error("❌ GAME UPDATE ERROR:", error);
  }
}

// =====================================================
// SERIALIZE
// =====================================================

function serialize(room: Room, userId?: string) {
  return {
    roomId: room.id,

    pot: room.pot,

    communityCards: room.communityCards,

    turn: room.getCurrentPlayer()?.id ?? null,

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

      currentBet: p.currentBet,

      folded: p.folded,

      lastAction: p.lastAction,

      dealer: p.dealer,

      smallBlind: p.smallBlind,

      bigBlind: p.bigBlind,

      isBot: false,

      // =================================================
      // کارت‌ها
      // =================================================
      //
      // هر بازیکن فقط کارت‌های خودش را می‌بیند.
      // در SHOWDOWN کارت همه نمایش داده می‌شود.
      //

      hand: room.state === GameState.SHOWDOWN || p.id === userId ? p.hand : [],
    })),
  };
}

// =====================================================
// SERIALIZE PLAYERS
// =====================================================

function serializePlayers(room: Room) {
  return room.players.map((p) => ({
    id: p.id,

    username: p.username,

    chips: p.chips,

    currentBet: p.currentBet,

    folded: p.folded,

    dealer: p.dealer,

    smallBlind: p.smallBlind,

    bigBlind: p.bigBlind,

    isBot: false,

    hand: [],
  }));
}

// =====================================================
// REMOVE PLAYER
// =====================================================

async function removePlayer(
  socket: Socket,
  io: Server,
  tableId: string,
  userId: string,
) {
  const game = games.get(tableId);

  if (!game) {
    return;
  }

  const { room, engine } = game;

  // =====================================================
  // FIND PLAYER
  // =====================================================

  const index = room.players.findIndex((p) => p.id === userId);

  if (index === -1) {
    return;
  }

  const player = room.players[index];

  console.log("🚪 REMOVING PLAYER:", {
    userId,

    username: player.username,

    tableId,
  });

  // =====================================================
  // IF CURRENT PLAYER
  // =====================================================

  if (
    room.state !== GameState.WAITING &&
    engine.getCurrentPlayer()?.id === userId
  ) {
    try {
      engine.playerAction(player, PlayerAction.FOLD);
    } catch (error) {
      console.error("❌ FOLD ON LEAVE:", error);
    }
  }

  // =====================================================
  // REMOVE PLAYER
  // =====================================================

  room.removePlayer(userId);

  await Table.findByIdAndUpdate(tableId, {
    $pull: {
      players: {
        user: new mongoose.Types.ObjectId(userId),
      },
    },
  });

  socket.leave(tableId);

  console.log(`👥 PLAYERS LEFT: ${room.players.length}/${room.maxPlayers}`);

  // =====================================================
  // NO PLAYERS
  // =====================================================

  if (room.players.length === 0) {
    console.log("🗑️ DELETE ONLINE GAME:", tableId);

    games.delete(tableId);

    // حذف میز از MongoDB
    try {
      await Table.findByIdAndDelete(tableId);

      console.log("🗑️ TABLE DELETED FROM DATABASE:", tableId);
    } catch (error) {
      console.error("❌ DELETE TABLE FROM DATABASE ERROR:", error);
    }

    return;
  }

  // =====================================================
  // ONE PLAYER LEFT
  // =====================================================

  if (room.players.length === 1) {
    console.log("⏳ ONE PLAYER LEFT:", tableId);

    // =====================================================
    // RESET GAME
    // =====================================================

    if (room.state !== GameState.WAITING) {
      room.state = GameState.WAITING;

      room.communityCards = [];

      room.pot = 0;

      room.currentBet = 0;

      room.winner = null;

      room.winnerHand = null;

      room.winnerCards = [];

      room.players.forEach((p) => {
        p.clearHand();
      });
    }

    // =====================================================
    // UPDATE
    // =====================================================

    emitGameUpdate(io, tableId, room);

    return;
  }

  // =====================================================
  // UPDATE
  // =====================================================

  emitGameUpdate(io, tableId, room);

  // =====================================================
  // CONTINUE TURN
  // =====================================================

  if (room.state !== GameState.WAITING) {
    setTimeout(() => {
      checkTurn(io, tableId, game);
    }, 300);
  }
}
