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

    // =====================================================
    // VALIDATION
    // =====================================================

    if (!idToken) {
      return res.status(400).json({
        message: "Google ID token is required",
      });
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      console.error("GOOGLE_CLIENT_ID is missing");

      return res.status(500).json({
        message: "Google authentication is not configured",
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is missing");

      return res.status(500).json({
        message: "JWT is not configured",
      });
    }

    // =====================================================
    // VERIFY GOOGLE TOKEN
    // =====================================================

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
      email_verified,
    } = payload;

    // =====================================================
    // GOOGLE DATA VALIDATION
    // =====================================================

    if (!googleId || !email) {
      return res.status(400).json({
        message: "Google account information is incomplete",
      });
    }

    if (!email_verified) {
      return res.status(401).json({
        message: "Google email is not verified",
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // =====================================================
    // FIND USER
    // =====================================================

    let user = await User.findOne({
      googleId,
    });

    // =====================================================
    // FIND BY EMAIL
    // =====================================================

    if (!user) {
      user = await User.findOne({
        email: cleanEmail,
      });
    }

    // =====================================================
    // CREATE USER
    // =====================================================

    if (!user) {
      let username =
        name?.trim().replace(/\s+/g, "_").toLowerCase() ||
        `player_${Date.now()}`;

      // Remove characters that could cause problems
      username = username.replace(/[^a-zA-Z0-9_]/g, "");

      if (!username || username.length < 3) {
        username = `player_${Date.now()}`;
      }

      // Make username unique
      let usernameExists = await User.findOne({
        username,
      });

      if (usernameExists) {
        username = `${username}_${Date.now()}`;
      }

      // ===================================================
      // STARTER PACK
      // ===================================================

      const starterAvatars = [
        "bot1",
        "bot2",
        "user",
      ];

      const starterCardDesigns = [
        "AD",
        "AH",
        "AS",
      ];

      const starterTableBackgrounds = [
        "default",
        "green",
      ];

      // ===================================================
      // CREATE
      // ===================================================

      user = await User.create({
        username,

        email: cleanEmail,

        password: "",

        googleId,

        authProvider: "google",

        // Avatar
        avatar: picture || "user",

        ownedAvatars: starterAvatars,

        // Cards
        ownedCardDesigns: starterCardDesigns,

        activeCardDesign: "default",

        // Table
        ownedTableBackgrounds:
          starterTableBackgrounds,

        activeTableBackground: "default",

        // Chips
        chips: 300,

        chipsD: 0,

        // Stats
        wins: 0,
        losses: 0,
        gamesPlayed: 0,

        // Buy / Sell
        buysell: false,
      });
    }

    // =====================================================
    // LINK EXISTING ACCOUNT
    // =====================================================

    if (!user.googleId) {
      user.googleId = googleId;
      user.authProvider = "google";

      if (picture && !user.avatar) {
        user.avatar = picture;
      }

      await user.save();
    }

    // =====================================================
    // CREATE JWT
    // =====================================================

    const token = jwt.sign(
      {
        userId: user._id.toString(),
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    // =====================================================
    // USER RESPONSE
    // =====================================================

    const userResponse = {
      _id: user._id,

      username: user.username,

      email: user.email,

      avatar: user.avatar,

      ownedAvatars: user.ownedAvatars,

      ownedCardDesigns: user.ownedCardDesigns,

      ownedTableBackgrounds:
        user.ownedTableBackgrounds,

      activeCardDesign:
        user.activeCardDesign,

      activeTableBackground:
        user.activeTableBackground,

      chips: user.chips,

      chipsD: user.chipsD,

      wins: user.wins,

      losses: user.losses,

      gamesPlayed: user.gamesPlayed,

      buysell: user.buysell,

      googleId: user.googleId,

      authProvider: user.authProvider,
    };

    // =====================================================
    // RESPONSE
    // =====================================================

    return res.status(200).json({
      message: "Google authentication successful",

      token,

      user: userResponse,
    });
  } catch (error: any) {
    console.error("GOOGLE AUTH ERROR:", error);

    // Duplicate username/email
    if (error?.code === 11000) {
      return res.status(400).json({
        message: "Username or email already exists",
      });
    }

    return res.status(401).json({
      message: "Google authentication failed",
    });
  }
};