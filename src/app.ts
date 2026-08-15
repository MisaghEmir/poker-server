import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.routes";
import tableRoutes from "./routes/table.routes";

const app = express();

app.use(
  cors({
    origin: "*",
  })
);

app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/table", tableRoutes);

app.get("/", (_, res) => {
  res.send("Poker Server");
});

export default app;