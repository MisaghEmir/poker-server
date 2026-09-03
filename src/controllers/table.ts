import { Request, Response } from "express";
import Table from "../models/Table";
import mongoose from "mongoose";

export const findTable = async (req: Request, res: Response) => {
  try {
    const { stakes, chips } = req.body;

    console.log("🔎 FIND TABLE:", {
      stakes,
      chips,
    });

    if (!stakes) {
      return res.status(400).json({
        message: "Stakes is required",
      });
    }

    // پیدا کردن یک میز با همان Stakes
    // که هنوز جا داشته باشد و در انتظار بازیکن باشد
    const table = await Table.findOne({
      isPrivate: false,
      stakes,
      status: "waiting",
      $expr: {
        $lt: [{ $size: "$players" }, "$maxPlayers"],
      },
    });

    // اگر میز پیدا شد
    if (table) {
      console.log("✅ EXISTING TABLE:", table._id.toString());

      return res.json({
        table,
        created: false,
      });
    }

    // اگر میز مناسب پیدا نشد
    const newTable = await Table.create({
      name: "Poker Table",
      isPrivate: false,
      stakes,
      maxPlayers: 5,
      players: [],
      status: "waiting",
    });

    console.log("🆕 NEW TABLE:", newTable._id.toString());

    return res.json({
      table: newTable,
      created: true,
    });
  } catch (error) {
    console.error("❌ FIND TABLE ERROR:", error);

    return res.status(500).json({
      message: "Could not find or create table",
    });
  }
};

export async function joinOrCreateTable(userId: string) {
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const table = await Table.findOneAndUpdate(
    {
      status: "waiting",
      "players.user": {
        $ne: userObjectId,
      },
      $expr: {
        $lt: [{ $size: "$players" }, "$maxPlayers"],
      },
    },
    { new: true },
  );

  if (table) {
    const takenSeats = table.players.map((p) => p.seat);

    let seat = 0;

    while (takenSeats.includes(seat)) {
      seat++;
    }

    const lastPlayer = table.players[table.players.length - 1];

    if (lastPlayer) {
      lastPlayer.seat = seat;
      await table.save();
    }

    return {
      table,
      created: false,
    };
  }

  const newTable = await Table.create({
    name: "Poker Table",
    stakes: "1 / 2",
    maxPlayers: 5,
    players: [],
    status: "waiting",
  });

  return {
    table: newTable,
    created: true,
  };
}

export const createPrivateTable = async (req: Request, res: Response) => {
  try {
    const { name, maxPlayers, buyIn, smallBlind, bigBlind } = req.body;

    if (!maxPlayers) {
      return res.status(400).json({
        message: "Spot is required",
      });
    }

    if (!buyIn) {
      return res.status(400).json({
        message: "Buy-in is required",
      });
    }

    if (!smallBlind || !bigBlind) {
      return res.status(400).json({
        message: "Blinds are required",
      });
    }

    if (maxPlayers < 2 || maxPlayers > 5) {
      return res.status(400).json({
        message: "Spot must be between 2 and 5",
      });
    }

    const tableCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const table = await Table.create({
      name: name?.trim() || "Private Poker Table",

      isPrivate: true,

      tableCode,

      stakes: `${smallBlind} / ${bigBlind}`,

      maxPlayers,

      buyIn,

      players: [],

      status: "waiting",

      pot: 0,
    });

    return res.status(201).json({
      message: "Private table created successfully",
      table,
    });
  } catch (error) {
    console.error("❌ CREATE PRIVATE TABLE ERROR:", error);

    return res.status(500).json({
      message: "Could not create private table",
    });
  }
};

export const joinPrivateTable = async (req: Request, res: Response) => {
  try {
    const { tableCode } = req.body;

    if (!tableCode) {
      return res.status(400).json({
        message: "Table code is required",
      });
    }

    const table = await Table.findOne({
      tableCode: tableCode.trim().toUpperCase(),
      isPrivate: true,
      status: "waiting",
    });

    if (!table) {
      return res.status(404).json({
        message: "Private table not found",
      });
    }

    const playerCount = table.players.length;

    if (playerCount >= table.maxPlayers) {
      return res.status(400).json({
        message: "Table is full",
      });
    }

    console.log("🔎 PRIVATE TABLE FOUND:", table._id.toString());

    return res.json({
      message: "Private table found",
      table,
    });
  } catch (error) {
    console.error("❌ JOIN PRIVATE TABLE ERROR:", error);

    return res.status(500).json({
      message: "Could not join private table",
    });
  }
};


export const deletePrivateTable = async (
  req: Request,
  res: Response
) => {
  try {
    const { tableId } = req.params;

    const table = await Table.findOne({
      _id: tableId,
      isPrivate: true,
    });

    if (!table) {
      return res.status(404).json({
        message: "Private table not found",
      });
    }

    // اگر کسی داخل میز است، حذف نکن
    if (table.players.length > 0) {
      return res.status(400).json({
        message: "Table has players",
      });
    }

    await Table.findByIdAndDelete(tableId);

    console.log(
      "🗑️ PRIVATE TABLE DELETED:",
      tableId
    );

    return res.json({
      message: "Private table deleted",
    });
  } catch (error) {
    console.error(
      "❌ DELETE PRIVATE TABLE ERROR:",
      error
    );

    return res.status(500).json({
      message: "Could not delete private table",
    });
  }
};