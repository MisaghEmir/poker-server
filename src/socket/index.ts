import { Server } from "socket.io";

import { pokerGameSocket } from "./bot.socket";
import { pokerGameWebSocket } from "./pokerGameWebSocket";
import { tableSocket } from "./table.socket";
import { onlineGameSocket } from "./onlineGameSocket";
import { privateGameSocket } from "./privateTableSocket";

export function registerSockets(io: Server) {
  io.on("connection", (socket) => {
    console.log("🟢 SOCKET CONNECTED:", socket.id);

    socket.on(
      "connection-ping",
      (_clientTime: number, callback?: () => void) => {
        callback?.();
      },
    );

    socket.on("disconnect", (reason) => {
      console.log("🔴 SOCKET DISCONNECTED:", {
        socketId: socket.id,
        reason,
      });
    });
  });

  // GAME SOCKETS
  tableSocket(io);
  pokerGameSocket(io);
  pokerGameWebSocket(io);
  onlineGameSocket(io);
  privateGameSocket(io);

  console.log("✅ ALL SOCKETS REGISTERED");
}