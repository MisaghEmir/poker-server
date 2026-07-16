import { Server } from "socket.io";
import Table from "../models/Table";

export const tableSocket = (io: Server) => {
  io.on("connection", (socket) => {
    console.log("player connected", socket.id);

    socket.on("join-table", async (data) => {
      console.log("🔥 JOIN EVENT RECEIVED", data);
      try {
        const { userId, tableId } = data;

        console.log("join", data);

        const tables = await Table.find();

        console.log(tables);

        const table = await Table.findById(tableId);
        console.log("socket", table);

        if (!table) return;

        table.players.push({
          user: userId,
          seat: table.players.length === 0 ? 0 :  table.players.length,
          chips: 59,
          socketId: socket.id,
        });

        console.log("AFTER PUSH:", table.players);

        await table.save();

        socket.join(tableId);
      } catch (error) {
        console.log("JOIN ERROR:", error);
      }

      // io.to(tableId).emit("table-update", table);
    });

    socket.on("leave-table", async ({ tableId }) => {
      socket.leave(tableId);

      const table = await Table.findOne({
        "players.socketId": socket.id,
      });

      if (!table) return;

      table.players.pull({
        socketId: socket.id,
      });

      if (table.players.length === 0) {
        await Table.findByIdAndDelete(table._id);
      } else {
        await table.save();

        io.to(tableId).emit("table-update", table);
      }
    });

    socket.on("disconnect", async () => {
      console.log("player left:", socket.id);

      const table = await Table.findOne({
        "players.socketId": socket.id,
      });

      if (!table) return;

      table.players.pull({
        socketId: socket.id,
      });

      if (table.players.length === 0) {
        await Table.findByIdAndDelete(table._id);
        console.log("table deleted");
        return;
      }

      await table.save();

      io.to(table._id.toString()).emit("table-update", table);
    });
  });
};
