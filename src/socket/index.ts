import { Server } from "socket.io";

import { pokerGameSocket } from "./bot.socket";
import { tableSocket } from "./table.socket";
import { onlineGameSocket } from "./onlineGameSocket";
import { privateGameSocket } from "./privateTableSocket";

export function registerSockets(io: Server) {
  // ================================
  // GENERAL CONNECTION / PING
  // ================================

  io.on("connection", (socket) => {
    console.log("🟢 SOCKET CONNECTED:", socket.id);

    socket.on(
      "connection-ping",
      (clientTime: number, callback?: () => void) => {
        if (callback) {
          callback();
        }
      },
    );

    socket.on("disconnect", (reason) => {
      console.log("🔴 SOCKET DISCONNECTED:", {
        socketId: socket.id,
        reason,
      });
    });
  });

  // ================================
  // GAME SOCKETS
  // ================================

  tableSocket(io);
  pokerGameSocket(io);
  onlineGameSocket(io);
  privateGameSocket(io);
}