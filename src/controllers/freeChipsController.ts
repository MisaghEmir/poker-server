import { Response } from "express";
import User from "../models/User";
import { AuthRequest } from "../middleware/authMiddleware";

const REWARD = 50;
const MAX_CLAIMS = 2;
const RESET_TIME = 3 * 60 * 60 * 1000; // 3 hours

// =====================================================
// GET FREE CHIPS STATUS
// =====================================================

export const getFreeChips = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const user = await User.findById(req.user?._id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // اگر freeChips برای کاربر وجود نداشته باشد
    if (!user.freeChips) {
      user.freeChips = {
        claims: 0,
        nextClaimAt: null,
      };

      await user.save();
    }

    // اگر تایمر تمام شده باشد، دوباره 2 بار فعال شود
    if (
      user.freeChips.nextClaimAt &&
      Date.now() >=
        user.freeChips.nextClaimAt.getTime()
    ) {
      user.freeChips.claims = 0;
      user.freeChips.nextClaimAt = null;

      await user.save();
    }

    const claims =
      user.freeChips.claims ?? 0;

    console.log(
      "GET FREE CHIPS:",
      user._id.toString(),
      user.freeChips
    );

    return res.status(200).json({
      available: claims < MAX_CLAIMS,

      claims,

      remainingClaims:
        Math.max(0, MAX_CLAIMS - claims),

      nextClaimAt:
        user.freeChips.nextClaimAt,

      chips: user.chips,
    });
  } catch (error) {
    console.error(
      "GET FREE CHIPS ERROR:",
      error
    );

    return res.status(500).json({
      message: "Server error",
    });
  }
};

// =====================================================
// CLAIM FREE CHIPS
// =====================================================

export const claimFreeChips = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const user = await User.findById(req.user?._id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // اگر freeChips وجود نداشته باشد
    if (!user.freeChips) {
      user.freeChips = {
        claims: 0,
        nextClaimAt: null,
      };
    }

    // اگر تایمر تمام شده باشد
    if (
      user.freeChips.nextClaimAt &&
      Date.now() >=
        user.freeChips.nextClaimAt.getTime()
    ) {
      user.freeChips.claims = 0;
      user.freeChips.nextClaimAt = null;
    }

    const claims =
      user.freeChips.claims ?? 0;

    // =================================================
    // DEBUG
    // =================================================

    console.log(
      "FREE CHIPS BEFORE CLAIM:",
      {
        userId: user._id.toString(),
        claims,
        nextClaimAt:
          user.freeChips.nextClaimAt,
        chips: user.chips,
      }
    );

    // =================================================
    // CHECK LIMIT
    // =================================================

    if (claims >= MAX_CLAIMS) {
      console.log(
        "FREE CHIPS NOT AVAILABLE:",
        {
          claims,
          nextClaimAt:
            user.freeChips.nextClaimAt,
        }
      );

      return res.status(400).json({
        message:
          "Free chips are not available yet",

        claims,

        remainingClaims: 0,

        nextClaimAt:
          user.freeChips.nextClaimAt,
      });
    }

    // =================================================
    // GIVE 50 CHIPS
    // =================================================

    user.chips += REWARD;

    user.freeChips.claims =
      claims + 1;

    // =================================================
    // START 3 HOUR TIMER
    // =================================================

    if (
      user.freeChips.claims === MAX_CLAIMS
    ) {
      user.freeChips.nextClaimAt =
        new Date(
          Date.now() + RESET_TIME
        );
    }

    await user.save();

    console.log(
      "FREE CHIPS CLAIMED:",
      {
        userId: user._id.toString(),

        reward: REWARD,

        chips: user.chips,

        claims:
          user.freeChips.claims,

        nextClaimAt:
          user.freeChips.nextClaimAt,
      }
    );

    // =================================================
    // RESPONSE
    // =================================================

    return res.status(200).json({
      message:
        "Free chips claimed successfully",

      reward: REWARD,

      chips: user.chips,

      claims:
        user.freeChips.claims,

      remainingClaims:
        MAX_CLAIMS -
        user.freeChips.claims,

      nextClaimAt:
        user.freeChips.nextClaimAt,
    });
  } catch (error) {
    console.error(
      "CLAIM FREE CHIPS ERROR:",
      error
    );

    return res.status(500).json({
      message: "Server error",
    });
  }
};
