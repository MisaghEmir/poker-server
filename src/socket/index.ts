import { Server } from "socket.io";

import { pokerGameSocket } from "./bot.socket";
import { tableSocket } from "./table.socket";
import { onlineGameSocket } from "./onlineGameSocket";
import { privateGameSocket } from "./privateTableSocket";

export function registerSockets(io: Server) {
  tableSocket(io);

  pokerGameSocket(io);

  onlineGameSocket(io);

  privateGameSocket(io);
}