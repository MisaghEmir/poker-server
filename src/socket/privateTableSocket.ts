import { Server, Socket } from "socket.io";
import Room from "../game/Room";
import PokerEngine from "../game/PokerEngine";
import Player from "../game/Player";
import { PlayerAction } from "../game/PlayerAction";
import { GameState } from "../game/GameState";
import Table from "../models/Table";
import mongoose from "mongoose";

// =====================================================
// SOCKET USERS
// socketId -> userId
// =====================================================

const privateSocketUsers = new Map<string, string>();

// =====================================================
// PRIVATE GAMES
// tableId -> game
// =====================================================

const privateGames = new Map<
  string,
  {
    room: Room;
    engine: PokerEngine;
  }
>();

// =====================================================
// PRIVATE GAME SOCKET
// =====================================================

export function privateGameSocket(io: Server) {
  io.on("connection", (socket: Socket) => {
    console.log("🟣 PRIVATE SOCKET:", socket.id);

    // =====================================================
    // JOIN PRIVATE TABLE
    // =====================================================

    socket.on(
      "join-private-table",
      async ({ tableId, userId, username, chips }) => {
        try {
          console.log("🔥 JOIN PRIVATE TABLE:", {
            tableId,
            userId,
            username,
            chips,
            socketId: socket.id,
          });

          // =====================================================
          // VALIDATION
          // =====================================================

          if (!tableId || !userId || !username || chips === undefined) {
            socket.emit("private-join-error", {
              message: "Invalid player data",
            });

            return;
          }

          // =====================================================
          // CHECK TABLE IN DATABASE
          // =====================================================

          const table = await Table.findOne({
            _id: tableId,
            isPrivate: true,
          });

          if (!table) {
            socket.emit("private-join-error", {
              message: "Private table not found",
            });

            return;
          }

          // =====================================================
          // CHECK TABLE STATUS
          // =====================================================

          if (table.status !== "waiting") {
            socket.emit("private-join-error", {
              message: "Game has already started",
            });

            return;
          }

          // =====================================================
          // FIND / CREATE GAME
          // =====================================================

          let game = privateGames.get(tableId);

          if (!game) {
            console.log("🆕 CREATE PRIVATE GAME:", tableId);

            const room = new Room(tableId);

            // ظرفیت میز خصوصی
            room.maxPlayers = table.maxPlayers;

            const engine = new PokerEngine(room);

            engine.onUpdate = () => {
              emitPrivateGameUpdate(io, tableId, room);
            };

            game = {
              room,
              engine,
            };

            privateGames.set(tableId, game);
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
              console.log("❌ PRIVATE ROOM FULL:", tableId);

              socket.emit("private-join-error", {
                message: "Table is full",
              });

              return;
            }

            // =====================================================
            // CREATE PLAYER
            // =====================================================

            player = new Player(userId, username, chips);

            room.addPlayer(player);

            // =====================================================
            // SAVE PLAYER IN DATABASE
            // =====================================================

            await Table.findByIdAndUpdate(
              tableId,
              {
                $addToSet: {
                  players: {
                    user: new mongoose.Types.ObjectId(userId),
                    chips,
                    socketId: socket.id,
                  },
                },
              },
              {
                new: true,
              },
            );

            console.log("👤 PRIVATE PLAYER JOINED:", username);

            console.log(
              `👥 PRIVATE PLAYERS: ${room.players.length}/${room.maxPlayers}`,
            );
          } else {
            // =====================================================
            // EXISTING PLAYER
            // =====================================================

            console.log("♻️ PRIVATE PLAYER ALREADY IN ROOM:", username);

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

          privateSocketUsers.set(socket.id, userId);

          // =====================================================
          // JOIN SOCKET ROOM
          // =====================================================

          socket.join(tableId);

          // =====================================================
          // JOIN SUCCESS
          // =====================================================

          socket.emit("private-join-success", {
            roomId: tableId,
            players: serializePrivatePlayers(room),
          });

          // =====================================================
          // CURRENT GAME UPDATE
          // =====================================================

          emitPrivateGameUpdate(io, tableId, room);

          // =====================================================
          // CHECK PLAYABLE PLAYERS
          // =====================================================

          const realPlayers = room.players.filter(
            (p) => !(p as any).isBot && p.chips > 0,
          );

          console.log("👥 PRIVATE PLAYABLE PLAYERS:", {
            count: realPlayers.length,
            players: realPlayers.map((p) => ({
              id: p.id,
              username: p.username,
              chips: p.chips,
            })),
          });

          // =====================================================
          // START GAME
          // =====================================================

          if (realPlayers.length >= 2 && room.state === GameState.WAITING) {
            console.log("🎮 STARTING PRIVATE GAME:", tableId);

            room.startGame();

            // =====================================================
            // UPDATE DATABASE STATUS
            // =====================================================

            await Table.findByIdAndUpdate(tableId, {
              status: "playing",
            });

            console.log("🎮 PRIVATE GAME STARTED:", tableId);

            console.log("🎯 CURRENT TURN:", room.getCurrentPlayer()?.username);

            console.log("🃏 COMMUNITY CARDS:", room.communityCards);

            // =====================================================
            // GAME START
            // =====================================================

            emitPrivateGameStart(io, tableId, room);

            // =====================================================
            // GAME UPDATE
            // =====================================================

            emitPrivateGameUpdate(io, tableId, room);

            // =====================================================
            // TURN
            // =====================================================

            setTimeout(() => {
              checkPrivateTurn(io, tableId, game!);
            }, 300);
          } else {
            console.log(`⏳ PRIVATE WAITING: ${realPlayers.length}/2`);
          }
        } catch (error) {
          console.error("❌ PRIVATE JOIN ERROR:", error);

          socket.emit("private-join-error", {
            message: "Could not join private table",
          });
        }
      },
    );

    // =====================================================
    // PLAYER ACTION
    // =====================================================

    socket.on("private-action", ({ tableId, userId, action, amount }) => {
      try {
        console.log("🎯 PRIVATE ACTION:", {
          tableId,
          userId,
          action,
          amount,
        });

        const game = privateGames.get(tableId);

        if (!game) {
          console.log("❌ PRIVATE GAME NOT FOUND:", tableId);

          return;
        }

        const { room, engine } = game;

        // =====================================================
        // FIND PLAYER
        // =====================================================

        const player = room.players.find((p) => p.id === userId);

        if (!player) {
          console.log("❌ PRIVATE PLAYER NOT FOUND:", userId);

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
          console.log("❌ PRIVATE NOT PLAYER TURN:", {
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

        emitPrivateGameUpdate(io, tableId, room);

        // =====================================================
        // NEXT TURN
        // =====================================================

        setTimeout(() => {
          checkPrivateTurn(io, tableId, game);
        }, 700);
      } catch (error) {
        console.error("❌ PRIVATE ACTION ERROR:", error);
      }
    });

    // =====================================================
    // LEAVE PRIVATE TABLE
    // =====================================================

    socket.on("leave-private-table", async ({ tableId, userId }) => {
      console.log("🚪 LEAVE PRIVATE TABLE:", {
        tableId,
        userId,
      });

      await removePrivatePlayer(socket, io, tableId, userId);
    });

    // =====================================================
    // DISCONNECT
    // =====================================================

    socket.on("disconnect", async () => {
      console.log("🔴 PRIVATE DISCONNECT:", socket.id);

      const userId = privateSocketUsers.get(socket.id);

      if (!userId) {
        return;
      }

      privateSocketUsers.delete(socket.id);

      // =====================================================
      // FIND PLAYER GAME
      // =====================================================

      for (const [tableId, game] of privateGames.entries()) {
        const player = game.room.players.find((p) => p.id === userId);

        if (!player) {
          continue;
        }

        await removePrivatePlayer(socket, io, tableId, userId);

        break;
      }
    });
  });
}

// =====================================================
// CHECK TURN
// =====================================================

function checkPrivateTurn(
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
    console.log("🏆 PRIVATE SHOWDOWN:", tableId);

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

  console.log(`👥 PRIVATE CHECK TURN: ${realPlayers.length}/2`);

  // =====================================================
  // WAITING
  // =====================================================

  if (realPlayers.length < 2) {
    console.log(`⏳ PRIVATE NOT ENOUGH PLAYERS: ${realPlayers.length}/2`);

    emitPrivateGameUpdate(io, tableId, room);

    return;
  }

  // =====================================================
  // CURRENT PLAYER
  // =====================================================

  const currentPlayer = engine.getCurrentPlayer();

  if (!currentPlayer) {
    console.log("❌ PRIVATE NO CURRENT PLAYER");

    return;
  }

  console.log("🎯 PRIVATE CURRENT TURN:", {
    username: currentPlayer.username,
    id: currentPlayer.id,
    state: room.state,
  });

  // =====================================================
  // SEND TURN
  // =====================================================

  io.to(tableId).emit("private-turn-start", {
    playerId: currentPlayer.id,
    seconds: 10,
  });
}

// =====================================================
// GAME START
// =====================================================

async function emitPrivateGameStart(io: Server, tableId: string, room: Room) {
  try {
    const sockets = await io.in(tableId).fetchSockets();

    console.log(`📡 PRIVATE GAME START → ${sockets.length} SOCKETS`);

    for (const client of sockets) {
      const userId = privateSocketUsers.get(client.id);

      const data = serializePrivate(room, userId);

      client.emit("private-game-start", data);
    }
  } catch (error) {
    console.error("❌ PRIVATE GAME START ERROR:", error);
  }
}

// =====================================================
// GAME UPDATE
// =====================================================

async function emitPrivateGameUpdate(io: Server, tableId: string, room: Room) {
  try {
    const sockets = await io.in(tableId).fetchSockets();

    console.log("📡 PRIVATE GAME UPDATE:", {
      tableId,
      players: room.players.length,
      state: room.state,
      pot: room.pot,
      turn: room.getCurrentPlayer()?.username,
      sockets: sockets.length,
    });

    // =====================================================
    // PERSONALIZED DATA
    // =====================================================

    for (const client of sockets) {
      const userId = privateSocketUsers.get(client.id);

      const data = serializePrivate(room, userId);

      client.emit("private-game-update", data);
    }
  } catch (error) {
    console.error("❌ PRIVATE GAME UPDATE ERROR:", error);
  }
}

// =====================================================
// SERIALIZE
// =====================================================

function serializePrivate(room: Room, userId?: string) {
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

      hand: room.state === GameState.SHOWDOWN || p.id === userId ? p.hand : [],
    })),
  };
}

// =====================================================
// SERIALIZE PLAYERS
// =====================================================

function serializePrivatePlayers(room: Room) {
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
// REMOVE PRIVATE PLAYER
// =====================================================

async function removePrivatePlayer(
  socket: Socket,
  io: Server,
  tableId: string,
  userId: string,
) {
  try {
    console.log("🚪 REMOVING PRIVATE PLAYER:", {
      tableId,
      userId,
      socketId: socket.id,
    });

    // =====================================================
    // FIND GAME
    // =====================================================

    const game = privateGames.get(tableId);

    // =====================================================
    // REMOVE FROM MEMORY
    // =====================================================

    if (game) {
      const { room } = game;

      const playerIndex = room.players.findIndex((p) => p.id === userId);

      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);

        console.log("👤 REMOVED FROM ROOM:", userId);
      }

      // =====================================================
      // NO PLAYERS IN MEMORY
      // =====================================================

      if (room.players.length === 0) {
        privateGames.delete(tableId);

        console.log(`🧹 PRIVATE GAME REMOVED FROM MEMORY: ${tableId}`);
      }
    }

    // =====================================================
    // FIND TABLE IN DATABASE
    // =====================================================

    const table = await Table.findById(tableId);

    if (!table) {
      console.log("⚠️ PRIVATE TABLE NOT FOUND:", tableId);

      privateSocketUsers.delete(socket.id);

      socket.leave(tableId);

      return;
    }

    // =====================================================
    // REMOVE PLAYER FROM DATABASE
    // =====================================================

    const playerIndex = table.players.findIndex(
      (p: any) => p.user?.toString() === userId,
    );

    if (playerIndex !== -1) {
      table.players.splice(playerIndex, 1);
    }

    console.log(`👥 DATABASE PLAYERS LEFT: ${table.players.length}`);

    // =====================================================
    // NO PLAYERS LEFT
    // DELETE TABLE
    // =====================================================

    if (table.players.length === 0) {
      await Table.findByIdAndDelete(tableId);

      privateGames.delete(tableId);

      console.log(`🗑️ PRIVATE TABLE DELETED: ${tableId}`);

      // اطلاع به socketهای باقی‌مانده
      io.to(tableId).emit("private-table-deleted", {
        tableId,
      });

      privateSocketUsers.delete(socket.id);

      socket.leave(tableId);

      return;
    }

    // =====================================================
    // SAVE REMAINING PLAYERS
    // =====================================================

    await table.save();

    // =====================================================
    // UPDATE REMAINING PLAYERS
    // =====================================================

    const currentGame = privateGames.get(tableId);

    if (currentGame) {
      emitPrivateGameUpdate(io, tableId, currentGame.room);
    }

    // =====================================================
    // REMOVE SOCKET FROM ROOM
    // =====================================================

    privateSocketUsers.delete(socket.id);

    socket.leave(tableId);

    console.log("✅ PRIVATE PLAYER REMOVED:", userId);
  } catch (error) {
    console.error("❌ REMOVE PRIVATE PLAYER ERROR:", error);
  }
}
