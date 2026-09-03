import { Request, Response } from "express";
import User from "../models/User";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { AuthRequest } from "../middleware/authMiddleware";

// =========================
// LOGIN
// =========================
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // بررسی ورودی
    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    // پیدا کردن کاربر
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        message: "Invalid email or password",
      });
    }

    // بررسی پسورد
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(400).json({
        message: "Invalid email or password",
      });
    }

    // ساخت JWT
    const token = jwt.sign(
      {
        userId: user._id.toString(),
      },
      process.env.JWT_SECRET!,
      {
        expiresIn: "7d",
      }
    );

    console.log("LOGIN SUCCESS:", user.email);

    // ارسال اطلاعات به کلاینت
    return res.status(200).json({
      token,

      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        chips: user.chips,
        chipsD: user.chipsD,
        wins: user.wins,
        losses: user.losses,
        gamesPlayed: user.gamesPlayed,
        buysell: user.buysell,
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

// =========================
// ME
// =========================
export const me = async (req: AuthRequest, res: Response) => {
  return res.status(200).json({
    message: "Valid Token",
    user: req.user,
  });
};