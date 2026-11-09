import { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User";
import jwt from "jsonwebtoken";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleAuth = async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        message: "Google ID token is required",
      });
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({
        message: "Google authentication is not configured",
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        message: "JWT is not configured",
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
      picture,
      email_verified,
    } = payload;

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

    // Find existing account by Google ID
    let user = await User.findOne({ googleId });

    // If not found, find existing account by email
    if (!user) {
      user = await User.findOne({ email: cleanEmail });
    }

    // Do not create new users
    if (!user) {
      return res.status(404).json({
        message: "No account found. Please register first.",
        code: "ACCOUNT_NOT_FOUND",
      });
    }

    // Link Google account to existing user
    if (!user.googleId) {
      user.googleId = googleId;
      user.authProvider = "google";

      if (picture && !user.avatar) {
        user.avatar = picture;
      }

      await user.save();
    }

    // Create JWT
    const token = jwt.sign(
      {
        userId: user._id.toString(),
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    // User response
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
      googleId: user.googleId,
      authProvider: user.authProvider,
    };

    return res.status(200).json({
      message: "Google authentication successful",
      token,
      user: userResponse,
    });

  } catch (error: any) {
    console.error("GOOGLE AUTH ERROR:", error);

    if (error?.code === 11000) {
      return res.status(400).json({
        message: "Google account is already linked to another user",
      });
    }

    return res.status(401).json({
      message: "Google authentication failed",
    });
  }
};