import { Request, Response } from "express";
import User from "../models/User";

export const getChipRanking = async (
  req: Request,
  res: Response,
) => {
  try {
    const users = await User.find(
      {},
      {
        username: 1,
        chips: 1,
        avatar: 1,
      },
    )
      .sort({ chips: -1 })
      .limit(100)
      .lean();

    const ranking = users.map((user, index) => ({
      rank: index + 1,
      id: user._id,
      username: user.username,
      chips: user.chips,
      avatar: user.avatar,
    }));

    res.json({
      success: true,
      ranking,
    });
  } catch (error) {
    console.error("GET CHIP RANKING ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to get chip ranking",
    });
  }
};