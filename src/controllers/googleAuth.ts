import { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User";
import jwt from "jsonwebtoken";

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID
);

export const googleAuth = async (
  req: Request,
  res: Response
) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        message: "Google ID token is required",
      });
    }

    // Verify Google token
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload) {
      return res.status(401).json({
        message: "Invalid Google token",
      });
    }

    const {
      sub: googleId,
      email,
      name,
      picture,
    } = payload;

    if (!googleId || !email) {
      return res.status(400).json({
        message: "Google account information is incomplete",
      });
    }

    // پیدا کردن کاربر با Google ID
    let user = await User.findOne({
      googleId,
    });

    // اگر با Google پیدا نشد،
    // ایمیل را هم بررسی کن
    if (!user) {
      user = await User.findOne({
        email: email.toLowerCase(),
      });
    }

    // =========================
    // CREATE USER
    // =========================

    if (!user) {
      let username =
        name?.replace(/\s+/g, "_").toLowerCase() ||
        `player_${Date.now()}`;

      // username باید unique باشد
      const usernameExists = await User.findOne({
        username,
      });

      if (usernameExists) {
        username = `${username}_${Date.now()}`;
      }

      user = await User.create({
        username,
        email: email.toLowerCase(),

        password: "",

        googleId,

        authProvider: "google",

        avatar: picture || "",

        chips: 200,
        chipsD: 0,

        wins: 0,
        losses: 0,
        gamesPlayed: 0,

        buysell: false,
      });
    }

    // =========================
    // UPDATE EXISTING USER
    // =========================

    if (!user.googleId) {
      user.googleId = googleId;
      user.authProvider = "google";

      if (picture && !user.avatar) {
        user.avatar = picture;
      }

      await user.save();
    }

    // =========================
    // CREATE JWT
    // =========================

    const token = jwt.sign(
      {
        userId: user._id.toString(),
      },
      process.env.JWT_SECRET!,
      {
        expiresIn: "7d",
      }
    );

    return res.status(200).json({
      message: "Google authentication successful",

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

        googleId: user.googleId,
        authProvider: user.authProvider,
      },
    });
  } catch (error) {
    console.error("GOOGLE AUTH ERROR:", error);

    return res.status(401).json({
      message: "Google authentication failed",
    });
  }
};