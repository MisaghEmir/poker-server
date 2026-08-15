import dotenv from "dotenv";
dotenv.config();
import { Server } from "socket.io";
import { gameSocket } from "./socket/game.socket";
import http from "http";
import app from "./app";
import { connectDatabase } from "./config/database";
import { tableSocket } from "./socket/table.socket";
import { registerSockets } from "./socket";

const PORT = Number(process.env.PORT) || 5000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

registerSockets(io);

async function startServer() {
  try {
    await connectDatabase();

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server Running On ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to connect database");
    console.error(error);
    process.exit(1);
  }
}

startServer();
