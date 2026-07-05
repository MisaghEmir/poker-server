import dotenv from "dotenv";
dotenv.config();

import http from "http";
import app from "./app";
import { connectDatabase } from "./config/database";

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

connectDatabase();

server.listen(PORT, () => {
  console.log(`Server Running On ${PORT}`);
});