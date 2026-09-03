import { Server } from "socket.io";
import Table from "../models/Table";

const MAX_PLAYERS = 5;

export const tableSocket = (io: Server) => {
  io.on("connection", (socket) => {
    console.log("player connected:", socket.id);

    // ==========================================
    // JOIN TABLE
    // ==========================================

    socket.on("join-table", async (data) => {
      console.log("🔥 JOIN TABLE:", data);

      try {
        const {
          userId,
          tableId,
          chips,
        } = data;

        console.log("📥 JOIN DATA:", {
          userId,
          tableId,
          chips,
          socketId: socket.id,
        });

        if (!userId) {
          socket.emit("join-error", {
            message: "User ID is required",
          });

          return;
        }

        if (!chips || chips <= 0) {
          socket.emit("join-error", {
            message: "Buy-in / chips is required",
          });

          return;
        }

        // ==========================================
        // FIND TABLE
        // ==========================================

        let table;

        if (tableId) {
          table = await Table.findById(tableId);
        }

        if (!table) {
          socket.emit("join-error", {
            message: "Table not found",
          });

          return;
        }

        console.log("🎰 TABLE FOUND:", {
          tableId: table._id.toString(),
          players: table.players.length,
          maxPlayers: MAX_PLAYERS,
        });

        // ==========================================
        // CHECK IF USER IS ALREADY IN THIS TABLE
        // ==========================================

        const existingPlayer = table.players.find(
          (player: any) =>
            player.user?.toString() === userId
        );

        if (existingPlayer) {
          // آپدیت socket
          existingPlayer.socketId = socket.id;

          // اگر لازم بود buy-in را هم آپدیت کن
          existingPlayer.chips = chips;

          await table.save();

          socket.join(table._id.toString());

          console.log(
            "♻️ PLAYER ALREADY IN TABLE:",
            userId
          );

          socket.emit("join-success", {
            tableId: table._id.toString(),
            table,
            status:
              table.players.length >= MAX_PLAYERS
                ? "PLAYING"
                : "WAITING",
            playerCount: table.players.length,
            maxPlayers: MAX_PLAYERS,
          });

          return;
        }

        // ==========================================
        // CHECK TABLE CAPACITY
        // ==========================================

        if (table.players.length >= MAX_PLAYERS) {
          console.log(
            "❌ TABLE FULL:",
            table._id.toString()
          );

          socket.emit("join-error", {
            message: "Table is full",
          });

          return;
        }

        // ==========================================
        // FIND FREE SEAT
        // ==========================================

        const takenSeats = table.players.map(
          (player: any) => player.seat
        );

        let seat = 0;

        while (takenSeats.includes(seat)) {
          seat++;
        }

        // ==========================================
        // ADD PLAYER
        // ==========================================

        table.players.push({
          user: userId,

          seat,

          // 🔥 چیپ انتخاب‌شده از فرانت
          chips,

          socketId: socket.id,
        });

        await table.save();

        const joinedTableId =
          table._id.toString();

        socket.join(joinedTableId);

        console.log(
          "👤 PLAYER JOINED TABLE:",
          joinedTableId
        );

        console.log("💰 PLAYER BUY-IN:", chips);

        console.log(
          `👥 PLAYERS: ${table.players.length}/${MAX_PLAYERS}`
        );

        // ==========================================
        // TABLE STATUS
        // ==========================================

        const status =
          table.players.length >= MAX_PLAYERS
            ? "PLAYING"
            : "WAITING";

        // ==========================================
        // SEND JOIN SUCCESS
        // ==========================================

        socket.emit("join-success", {
          tableId: joinedTableId,

          table,

          status,

          playerCount:
            table.players.length,

          maxPlayers: MAX_PLAYERS,
        });

        // ==========================================
        // UPDATE EVERYONE
        // ==========================================

        io.to(joinedTableId).emit(
          "table-update",
          {
            tableId: joinedTableId,

            table,

            status,

            playerCount:
              table.players.length,

            maxPlayers: MAX_PLAYERS,
          }
        );

        // ==========================================
        // TABLE FULL
        // ==========================================

        if (
          table.players.length >=
          MAX_PLAYERS
        ) {
          console.log(
            "🎮 TABLE FULL - READY FOR GAME:",
            joinedTableId
          );

          io.to(joinedTableId).emit(
            "table-ready",
            {
              tableId: joinedTableId,

              table,

              playerCount:
                table.players.length,
            }
          );
        }
      } catch (error) {
        console.log(
          "❌ JOIN TABLE ERROR:",
          error
        );

        socket.emit("join-error", {
          message:
            "Could not join table",
        });
      }
    });

    // ==========================================
    // LEAVE TABLE
    // ==========================================

    socket.on(
      "leave-table",
      async ({ tableId }) => {
        try {
          socket.leave(tableId);

          const table =
            await Table.findOne({
              "players.socketId":
                socket.id,
            });

          if (!table) {
            return;
          }

          table.players.pull({
            socketId: socket.id,
          });

          // ==========================================
          // DELETE EMPTY TABLE
          // ==========================================

          if (
            table.players.length === 0
          ) {
            await Table.findByIdAndDelete(
              table._id
            );

            console.log(
              "🗑️ EMPTY TABLE DELETED:",
              table._id.toString()
            );

            return;
          }

          // ==========================================
          // SAVE TABLE
          // ==========================================

          await table.save();

          const tableIdString =
            table._id.toString();

          io.to(tableIdString).emit(
            "table-update",
            {
              tableId:
                tableIdString,

              table,

              status:
                table.players.length >=
                MAX_PLAYERS
                  ? "PLAYING"
                  : "WAITING",

              playerCount:
                table.players.length,

              maxPlayers:
                MAX_PLAYERS,
            }
          );
        } catch (error) {
          console.log(
            "❌ LEAVE TABLE ERROR:",
            error
          );
        }
      }
    );

    // ==========================================
    // DISCONNECT
    // ==========================================

    socket.on(
      "disconnect",
      async () => {
        console.log(
          "player left:",
          socket.id
        );

        try {
          const table =
            await Table.findOne({
              "players.socketId":
                socket.id,
            });

          if (!table) {
            return;
          }

          table.players.pull({
            socketId: socket.id,
          });

          // ==========================================
          // DELETE EMPTY TABLE
          // ==========================================

          if (
            table.players.length === 0
          ) {
            await Table.findByIdAndDelete(
              table._id
            );

            console.log(
              "🗑️ TABLE DELETED:",
              table._id.toString()
            );

            return;
          }

          // ==========================================
          // SAVE
          // ==========================================

          await table.save();

          const tableId =
            table._id.toString();

          // ==========================================
          // NOTIFY REMAINING PLAYER
          // ==========================================

          io.to(tableId).emit(
            "table-update",
            {
              tableId,

              table,

              status:
                table.players.length >=
                MAX_PLAYERS
                  ? "PLAYING"
                  : "WAITING",

              playerCount:
                table.players.length,

              maxPlayers:
                MAX_PLAYERS,
            }
          );

          console.log(
            `⏳ TABLE ${tableId} NOW HAS ${table.players.length}/${MAX_PLAYERS}`
          );
        } catch (error) {
          console.log(
            "❌ DISCONNECT ERROR:",
            error
          );
        }
      }
    );
  });
};
