import { Request, Response } from "express";
import Table from "../models/Table";
import mongoose from "mongoose";

export const findTable = async (req: Request, res: Response) => {
  const { id } = req.params;
  console.log({ id });

  const tables = Table.find();
  console.log(tables);
};

export async function joinOrCreateTable(userId: string) {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  // مرحله ۱: تلاش برای پیدا کردن میزی که جای خالی داره و کاربر توش نیست
  const table = await Table.findOneAndUpdate(
    {
      status: "waiting",
      "players.user": { $ne: userObjectId }, // کاربر از قبل توی میز نباشه
      $expr: { $lt: [{ $size: "$players" }, "$maxPlayers"] }, // جای خالی داشته باشه
    },
   
    { new: true },
  );
  if (table) {
    // مرحله ۲: تعیین شماره صندلی خالی
    const takenSeats = table.players.map((p) => p.seat);
    let seat = 0;
    while (takenSeats.filter((s) => s === seat).length > 1) {
      seat++;
    }

    const lastPlayer = table.players[table.players.length - 1];
    lastPlayer.seat = seat;
    await table.save();

    return { table, created: false };
  }

  // مرحله ۳: اگه هیچ میز خالی‌ای پیدا نشد، یه میز جدید بساز
  const newTable = await Table.create({
    name: "Poker Table",
    maxPlayers: 5,
    players: [],
  });
  return { table: newTable, created: true };
}
