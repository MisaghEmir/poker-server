import { pokerGameSocket } from "./bot.socket";
import { tableSocket } from "./table.socket";
import { Server } from "socket.io";

export function registerSockets(io: Server){

 tableSocket(io);
 pokerGameSocket(io);

}