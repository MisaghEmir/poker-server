import { Response } from "express";
import User from "../models/User";
import { AuthRequest } from "../middleware/authMiddleware";

// =====================================================
// SHOP ITEMS
// =====================================================

const AVATARS: Record<string, number> = {
  avatar1: 0,
  avatar2: 5000,
  avatar3: 10000,
  avatar4: 15000,
  avatar5: 25000,
};

const CARD_DESIGNS: Record<string, number> = {
  default: 0,
  gold: 10000,
  red: 15000,
  black: 20000,
  royal: 30000,
};

const TABLE_BACKGROUNDS: Record<string, number> = {
  default: 0,
  red: 10000,
  blue: 15000,
  purple: 20000,
  gold: 30000,
};

// =====================================================
// GET SHOP
// =====================================================

export const getShop = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    return res.json({
      chips: user.chips,

      avatar: user.avatar,

      ownedAvatars: user.ownedAvatars,

      ownedCardDesigns: user.ownedCardDesigns,

      ownedTableBackgrounds:
        user.ownedTableBackgrounds,

      activeCardDesign:
        user.activeCardDesign,

      activeTableBackground:
        user.activeTableBackground,

      items: {
        avatars: AVATARS,
        cardDesigns: CARD_DESIGNS,
        tableBackgrounds: TABLE_BACKGROUNDS,
      },
    });
  } catch (error) {
    console.error("GET SHOP ERROR:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

// =====================================================
// BUY AVATAR
// =====================================================

export const buyAvatar = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const { avatarId } = req.body;

    const price = AVATARS[avatarId];

    if (price === undefined) {
      return res.status(400).json({
        message: "Avatar does not exist",
      });
    }

    if (user.ownedAvatars.includes(avatarId)) {
      return res.status(400).json({
        message: "Avatar already owned",
      });
    }

    if (user.chips < price) {
      return res.status(400).json({
        message: "Not enough chips",
      });
    }

    user.chips -= price;

    user.ownedAvatars.push(avatarId);

    await user.save();

    return res.json({
      message: "Avatar purchased",

      chips: user.chips,

      ownedAvatars: user.ownedAvatars,
    });
  } catch (error) {
    console.error("BUY AVATAR ERROR:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

// =====================================================
// SELECT AVATAR
// =====================================================

export const selectAvatar = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const { avatarId } = req.body;

    if (!user.ownedAvatars.includes(avatarId)) {
      return res.status(400).json({
        message: "Avatar not owned",
      });
    }

    user.avatar = avatarId;

    await user.save();

    return res.json({
      message: "Avatar selected",

      avatar: user.avatar,
    });
  } catch (error) {
    console.error("SELECT AVATAR ERROR:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

// =====================================================
// BUY CARD DESIGN
// =====================================================

export const buyCardDesign = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const { designId } = req.body;

    const price = CARD_DESIGNS[designId];

    if (price === undefined) {
      return res.status(400).json({
        message: "Card design does not exist",
      });
    }

    if (user.ownedCardDesigns.includes(designId)) {
      return res.status(400).json({
        message: "Card design already owned",
      });
    }

    if (user.chips < price) {
      return res.status(400).json({
        message: "Not enough chips",
      });
    }

    user.chips -= price;

    user.ownedCardDesigns.push(designId);

    await user.save();

    return res.json({
      message: "Card design purchased",

      chips: user.chips,

      ownedCardDesigns:
        user.ownedCardDesigns,
    });
  } catch (error) {
    console.error(
      "BUY CARD DESIGN ERROR:",
      error
    );

    return res.status(500).json({
      message: "Server error",
    });
  }
};

// =====================================================
// SELECT CARD DESIGN
// =====================================================

export const selectCardDesign = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const { designId } = req.body;

    if (!user.ownedCardDesigns.includes(designId)) {
      return res.status(400).json({
        message: "Card design not owned",
      });
    }

    user.activeCardDesign = designId;

    await user.save();

    return res.json({
      message: "Card design selected",

      activeCardDesign:
        user.activeCardDesign,
    });
  } catch (error) {
    console.error(
      "SELECT CARD DESIGN ERROR:",
      error
    );

    return res.status(500).json({
      message: "Server error",
    });
  }
};

// =====================================================
// BUY TABLE BACKGROUND
// =====================================================

export const buyTableBackground = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const { backgroundId } = req.body;

    const price =
      TABLE_BACKGROUNDS[backgroundId];

    if (price === undefined) {
      return res.status(400).json({
        message: "Background does not exist",
      });
    }

    if (
      user.ownedTableBackgrounds.includes(
        backgroundId
      )
    ) {
      return res.status(400).json({
        message: "Background already owned",
      });
    }

    if (user.chips < price) {
      return res.status(400).json({
        message: "Not enough chips",
      });
    }

    user.chips -= price;

    user.ownedTableBackgrounds.push(
      backgroundId
    );

    await user.save();

    return res.json({
      message: "Background purchased",

      chips: user.chips,

      ownedTableBackgrounds:
        user.ownedTableBackgrounds,
    });
  } catch (error) {
    console.error(
      "BUY BACKGROUND ERROR:",
      error
    );

    return res.status(500).json({
      message: "Server error",
    });
  }
};

// =====================================================
// SELECT TABLE BACKGROUND
// =====================================================

export const selectTableBackground = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const { backgroundId } = req.body;

    if (
      !user.ownedTableBackgrounds.includes(
        backgroundId
      )
    ) {
      return res.status(400).json({
        message: "Background not owned",
      });
    }

    user.activeTableBackground =
      backgroundId;

    await user.save();

    return res.json({
      message: "Background selected",

      activeTableBackground:
        user.activeTableBackground,
    });
  } catch (error) {
    console.error(
      "SELECT BACKGROUND ERROR:",
      error
    );

    return res.status(500).json({
      message: "Server error",
    });
  }
};