import { Response } from "express";
import User from "../models/User";
import { AuthRequest } from "../middleware/authMiddleware";

// ===============================
// DEDUCT CHIPS
// ===============================
export const deductChips = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { amount } = req.body;

    const value = Number(amount);

    if (!value || value <= 0) {
      return res.status(400).json({
        message: "Invalid chip amount",
      });
    }

    const user = await User.findById(req.user?._id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (user.chips < value) {
      return res.status(400).json({
        message: "Not enough chips",
        chips: user.chips,
      });
    }

    user.chips -= value;

    await user.save();

    console.log("💸 CHIPS DEDUCTED:", {
      userId: user._id.toString(),
      amount: value,
      chips: user.chips,
    });

    return res.status(200).json({
      message: "Chips deducted successfully",
      amount: value,
      chips: user.chips,
    });
  } catch (error) {
    console.error("DEDUCT CHIPS ERROR:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

// ===============================
// ADD CHIPS
// ===============================
export const addChips = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { amount } = req.body;

    const value = Number(amount);

    if (!value || value <= 0) {
      return res.status(400).json({
        message: "Invalid chip amount",
      });
    }

    const user = await User.findById(req.user?._id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    user.chips += value;

    await user.save();

    console.log("💰 CHIPS ADDED:", {
      userId: user._id.toString(),
      amount: value,
      chips: user.chips,
    });

    return res.status(200).json({
      message: "Chips added successfully",
      amount: value,
      chips: user.chips,
    });
  } catch (error) {
    console.error("ADD CHIPS ERROR:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};