import { Response } from "express";
import User from "../models/User";
import { AuthRequest } from "../middleware/authMiddleware";

// =====================================================
// CONFIG
// =====================================================

const FREE_GIFT_TIME = 4 * 60 * 60 * 1000; // 4 hours
const SPECIAL_GIFT_WAIT = 6 * 60 * 60 * 1000; // 6 hours

// =====================================================
// GIFT CONFIG
// =====================================================

const GIFT_CONFIG = {
  silver: {
    unlockAt: 500,
    minReward: 150,
    maxReward: 250,
  },

  gold: {
    unlockAt: 2500,
    minReward: 300,
    maxReward: 500,
  },

  diamond: {
    unlockAt: 10000,
    minReward: 600,
    maxReward: 900,
  },

  royal: {
    unlockAt: 50000,
    minReward: 1000,
    maxReward: 1500,
  },

  legendary: {
    unlockAt: 250000,
    minReward: 2000,
    maxReward: 3000,
  },
};

// =====================================================
// TYPES
// =====================================================

type SpecialGiftName = "silver" | "gold" | "diamond" | "royal" | "legendary";

// =====================================================
// RANDOM REWARD
// =====================================================

const randomReward = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// =====================================================
// INITIALIZE GIFT PROGRESS
// =====================================================

const initializeGiftProgress = (user: any) => {
  if (!user.giftProgress) {
    user.giftProgress = {};
  }

  const gifts: SpecialGiftName[] = [
    "silver",
    "gold",
    "diamond",
    "royal",
    "legendary",
  ];

  for (const gift of gifts) {
    if (!user.giftProgress[gift]) {
      user.giftProgress[gift] = {
        unlockedAt: null,
        readyAt: null,
        claimed: false,
      };
    }
  }
};

// =====================================================
// UPDATE UNLOCKED GIFTS
// =====================================================

const updateGiftUnlocks = (user: any) => {
  initializeGiftProgress(user);

  const totalWon = Number(user.totalWon || 0);
  const now = Date.now();

  for (const giftName of Object.keys(GIFT_CONFIG) as SpecialGiftName[]) {
    const config = GIFT_CONFIG[giftName];
    const gift = user.giftProgress[giftName];

    // Already claimed
    if (gift.claimed) {
      continue;
    }

    // Already unlocked
    if (gift.unlockedAt) {
      continue;
    }

    // Not enough total won
    if (totalWon < config.unlockAt) {
      continue;
    }

    // Unlock gift
    gift.unlockedAt = new Date(now);

    // 6 hour waiting period
    gift.readyAt = new Date(now + SPECIAL_GIFT_WAIT);

    console.log("🎁 GIFT UNLOCKED:", {
      userId: user._id.toString(),
      gift: giftName,
      totalWon,
      unlockAt: config.unlockAt,
      readyAt: gift.readyAt,
    });
  }
};

// =====================================================
// GET GIFTS
// =====================================================

export const getGift = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user?._id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Make sure old users have the new fields
    if (typeof user.totalWon !== "number") {
      user.totalWon = 0;
    }

    initializeGiftProgress(user);

    // ---------------------------------------------------
    // FREE GIFT
    // ---------------------------------------------------

    if (!user.gift) {
      user.gift = {
        lastClaimAt: null,
        nextClaimAt: null,
      };
    }

    if (!user.gift.nextClaimAt) {
      user.gift.nextClaimAt = new Date(Date.now() + FREE_GIFT_TIME);
    }

    // ---------------------------------------------------
    // SPECIAL GIFTS
    // ---------------------------------------------------

    updateGiftUnlocks(user);

    await user.save();

    const now = Date.now();

    const freeAvailable =
      !!user.gift.nextClaimAt && now >= user.gift.nextClaimAt.getTime();

    // ---------------------------------------------------
    // BUILD SPECIAL GIFT RESPONSE
    // ---------------------------------------------------

    const specialGifts = (Object.keys(GIFT_CONFIG) as SpecialGiftName[]).map(
      (giftName) => {
        const config = GIFT_CONFIG[giftName];
        const gift = user.giftProgress[giftName];

        let status: "locked" | "waiting" | "ready" | "claimed" = "locked";

        if (gift.claimed) {
          status = "claimed";
        } else if (gift.unlockedAt) {
          if (gift.readyAt && now >= gift.readyAt.getTime()) {
            status = "ready";
          } else {
            status = "waiting";
          }
        }

        return {
          id: giftName,
          status,

          unlockAt: config.unlockAt,

          unlockedAt: gift.unlockedAt,

          readyAt: gift.readyAt,

          claimed: gift.claimed,

          minReward: config.minReward,
          maxReward: config.maxReward,
        };
      },
    );

    return res.status(200).json({
      totalWon: user.totalWon,

      freeGift: {
        available: freeAvailable,
        lastClaimAt: user.gift.lastClaimAt,
        nextClaimAt: user.gift.nextClaimAt,
        minReward: 70,
        maxReward: 100,
      },

      specialGifts,
    });
  } catch (error) {
    console.error("GET GIFT ERROR:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

// =====================================================
// CLAIM FREE GIFT
// =====================================================

export const claimFreeGift = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user?._id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (!user.gift) {
      user.gift = {
        lastClaimAt: null,
        nextClaimAt: null,
      };
    }

    // Initialize timer for old users
    if (!user.gift.nextClaimAt) {
      user.gift.nextClaimAt = new Date(Date.now() + FREE_GIFT_TIME);

      await user.save();

      return res.status(400).json({
        message: "Free gift is not ready yet",
        nextClaimAt: user.gift.nextClaimAt,
      });
    }

    // Check cooldown
    if (Date.now() < user.gift.nextClaimAt.getTime()) {
      return res.status(400).json({
        message: "Free gift is not ready",
        nextClaimAt: user.gift.nextClaimAt,
      });
    }

    // 70 - 100
    const reward = randomReward(70, 100);

    user.chips += reward;

    const now = new Date();

    user.gift.lastClaimAt = now;

    user.gift.nextClaimAt = new Date(now.getTime() + FREE_GIFT_TIME);

    await user.save();

    console.log("🎁 FREE GIFT CLAIMED:", {
      userId: user._id.toString(),
      reward,
      chips: user.chips,
      nextClaimAt: user.gift.nextClaimAt,
    });

    return res.status(200).json({
      message: "Free gift claimed successfully",

      gift: "free",

      reward,

      chips: user.chips,

      nextClaimAt: user.gift.nextClaimAt,
    });
  } catch (error) {
    console.error("CLAIM FREE GIFT ERROR:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

// =====================================================
// CLAIM SPECIAL GIFT
// =====================================================

export const claimGift = async (req: AuthRequest, res: Response) => {
  try {
   const { gift } = req.body || {};

    // ---------------------------------------------------
    // Validate gift
    // ---------------------------------------------------

    if (!gift || !Object.prototype.hasOwnProperty.call(GIFT_CONFIG, gift)) {
      return res.status(400).json({
        message: "Invalid gift",
      });
    }

    const giftName = gift as SpecialGiftName;

    const user = await User.findById(req.user?._id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // ---------------------------------------------------
    // Initialize
    // ---------------------------------------------------

    if (typeof user.totalWon !== "number") {
      user.totalWon = 0;
    }

    initializeGiftProgress(user);

    // Check if new gift should unlock
    updateGiftUnlocks(user);

    const userGift = user.giftProgress[giftName];

    // ---------------------------------------------------
    // Already claimed
    // ---------------------------------------------------

    if (userGift.claimed) {
      return res.status(400).json({
        message: "Gift has already been claimed",
      });
    }

    // ---------------------------------------------------
    // Not unlocked
    // ---------------------------------------------------

    if (!userGift.unlockedAt) {
      return res.status(400).json({
        message: "Gift is locked",
        requiredTotalWon: GIFT_CONFIG[giftName].unlockAt,
        totalWon: user.totalWon,
      });
    }

    // ---------------------------------------------------
    // Still waiting
    // ---------------------------------------------------

    if (userGift.readyAt && Date.now() < userGift.readyAt.getTime()) {
      return res.status(400).json({
        message: "Gift is not ready",

        readyAt: userGift.readyAt,

        remainingMs: userGift.readyAt.getTime() - Date.now(),
      });
    }

    // ---------------------------------------------------
    // Reward
    // ---------------------------------------------------

    const config = GIFT_CONFIG[giftName];

    const reward = randomReward(config.minReward, config.maxReward);

    user.chips += reward;

    // Mark as claimed
    userGift.claimed = true;

    await user.save();

    console.log("🎁 SPECIAL GIFT CLAIMED:", {
      userId: user._id.toString(),
      gift: giftName,
      reward,
      chips: user.chips,
    });

    return res.status(200).json({
      message: "Gift claimed successfully",

      gift: giftName,

      reward,

      chips: user.chips,

      claimed: true,
    });
  } catch (error) {
    console.error("CLAIM GIFT ERROR:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

// =====================================================
// REWARDED VIDEO
// =====================================================

export const rewardGiftVideo = async (req: AuthRequest, res: Response) => {
  try {
    const { gift } = req.body;

    if (!gift || !Object.prototype.hasOwnProperty.call(GIFT_CONFIG, gift)) {
      return res.status(400).json({
        message: "Invalid gift",
      });
    }

    const giftName = gift as SpecialGiftName;

    const user = await User.findById(req.user?._id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (typeof user.totalWon !== "number") {
      user.totalWon = 0;
    }

    initializeGiftProgress(user);

    // Unlock if eligible
    updateGiftUnlocks(user);

    const userGift = user.giftProgress[giftName];

    // ---------------------------------------------------
    // Not unlocked
    // ---------------------------------------------------

    if (!userGift.unlockedAt) {
      return res.status(400).json({
        message: "Gift is locked",
        requiredTotalWon: GIFT_CONFIG[giftName].unlockAt,
        totalWon: user.totalWon,
      });
    }

    // ---------------------------------------------------
    // Already claimed
    // ---------------------------------------------------

    if (userGift.claimed) {
      return res.status(400).json({
        message: "Gift has already been claimed",
      });
    }

    // ---------------------------------------------------
    // Skip waiting
    // ---------------------------------------------------

    userGift.readyAt = new Date();

    await user.save();

    console.log("📺 GIFT VIDEO COMPLETED:", {
      userId: user._id.toString(),
      gift: giftName,
    });

    return res.status(200).json({
      message: "Gift is ready",

      gift: giftName,

      readyAt: userGift.readyAt,
    });
  } catch (error) {
    console.error("REWARDED GIFT VIDEO ERROR:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};
