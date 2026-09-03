import { Request, Response } from "express";
import User from "../models/User";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export const register = async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;

    // =====================================================
    // VALIDATION
    // =====================================================

    if (!username || !email || !password) {
      return res.status(400).json({
        message: "Username, email and password are required",
      });
    }

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanUsername.length < 3) {
      return res.status(400).json({
        message: "Username must be at least 3 characters",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    // =====================================================
    // CHECK USERNAME
    // =====================================================

    const existingUsername = await User.findOne({
      username: cleanUsername,
    });

    if (existingUsername) {
      return res.status(400).json({
        message: "Username already exists",
      });
    }

    // =====================================================
    // CHECK EMAIL
    // =====================================================

    const existingEmail = await User.findOne({
      email: cleanEmail,
    });

    if (existingEmail) {
      return res.status(400).json({
        message: "Email already exists",
      });
    }

    // =====================================================
    // HASH PASSWORD
    // =====================================================

    const hashedPassword = await bcrypt.hash(password, 10);

    // =====================================================
    // STARTER PACK
    // =====================================================

    const starterAvatars = ["bot1", "bot2", "user"];

    const starterCardDesigns = ["AD", "AH", "AS"];

    const starterTableBackgrounds = ["default", "green"];

    // =====================================================
    // CREATE USER
    // =====================================================

    const user = await User.create({
      username: cleanUsername,

      email: cleanEmail,

      password: hashedPassword,

      authProvider: "local",

      // ===================================================
      // AVATAR
      // ===================================================

      avatar: "user",

      ownedAvatars: starterAvatars,

      // ===================================================
      // CARD DESIGNS
      // ===================================================

      ownedCardDesigns: starterCardDesigns,

      activeCardDesign: "default",

      // ===================================================
      // TABLE BACKGROUNDS
      // ===================================================

      ownedTableBackgrounds: starterTableBackgrounds,

      activeTableBackground: "default",

      // ===================================================
      // CHIPS
      // ===================================================

      chips: 300,

      chipsD: 0,

      // ===================================================
      // STATS
      // ===================================================

      wins: 0,

      losses: 0,

      gamesPlayed: 0,

      // ===================================================
      // BUY / SELL
      // ===================================================

      buysell: false,
    });

    // =====================================================
    // CREATE JWT
    // =====================================================

    const token = jwt.sign(
      {
        userId: user._id.toString(),
      },
      process.env.JWT_SECRET!,
      {
        expiresIn: "7d",
      },
    );

    // =====================================================
    // RESPONSE
    // =====================================================

    const userResponse = {
      _id: user._id,

      username: user.username,

      email: user.email,

      avatar: user.avatar,

      ownedAvatars: user.ownedAvatars,

      ownedCardDesigns: user.ownedCardDesigns,

      ownedTableBackgrounds: user.ownedTableBackgrounds,

      activeCardDesign: user.activeCardDesign,

      activeTableBackground: user.activeTableBackground,

      chips: user.chips,

      chipsD: user.chipsD,

      wins: user.wins,

      losses: user.losses,

      gamesPlayed: user.gamesPlayed,

      buysell: user.buysell,

      authProvider: user.authProvider,
    };

    // =====================================================
    // RESPONSE
    // =====================================================

    return res.status(201).json({
      message: "Account created successfully",

      token,

      user: userResponse,
    });
  } catch (error: any) {
    console.error("REGISTER ERROR:", error);

    // =====================================================
    // DUPLICATE KEY
    // =====================================================

    if (error?.code === 11000) {
      return res.status(400).json({
        message: "Username or email already exists",
      });
    }

    return res.status(500).json({
      message: "Server error",
    });
  }
};
