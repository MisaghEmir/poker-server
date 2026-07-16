import { Server } from "socket.io";
import Table from "../models/Table";

export const gameSocket = (io: Server) => {
  io.on("connection", (socket) => {
    console.log("player connected", socket.id);

    socket.on("join-table", async (data) => {
      const { userId, tableId } = data;

      const table = await Table.findById(tableId);

      if (!table) return;

      table.players.push({
        user: userId,
        seat: table.players.length,
      });

      await table.save();

      socket.join(tableId);

      io.to(tableId).emit("table-update", table);
    });

    socket.on("disconnect", () => {
      console.log("player left");
    });
  });
};
