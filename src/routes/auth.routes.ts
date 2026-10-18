import { Router } from "express";

import { login, me } from "../controllers/login";
import { authMiddleware } from "../middleware/authMiddleware";
import { register } from "../controllers/register";
import { googleAuth } from "../controllers/googleAuth";

// =====================================================
// GIFT
// =====================================================

import {
  getGift,
  claimFreeGift,
  claimGift,
  rewardGiftVideo,
} from "../controllers/gift";

// =====================================================
// SHOP
// =====================================================

import {
  getShop,
  buyAvatar,
  selectAvatar,
  buyCardDesign,
  selectCardDesign,
  buyTableBackground,
  selectTableBackground,
} from "../controllers/shop";

// =====================================================
// FREE CHIPS
// =====================================================

import {
  getFreeChips,
  claimFreeChips,
} from "../controllers/freeChipsController";

// =====================================================
// CHIPS
// =====================================================

import {
  deductChips,
  addChips,
} from "../controllers/chipsController";

// =====================================================
// RANKING
// =====================================================

import {
  getChipRanking,
} from "../controllers/rankingController";

const router = Router();

// =====================================================
// AUTH
// =====================================================

router.post("/register", register);

router.post("/login", login);

router.post("/google", googleAuth);

router.get("/me", authMiddleware, me);

// =====================================================
// GIFT
// =====================================================

router.get("/gift", authMiddleware, getGift);

router.post(
  "/gift/free/claim",
  authMiddleware,
  claimFreeGift,
);

router.post(
  "/gift/claim",
  authMiddleware,
  claimGift,
);

router.post(
  "/gift/video",
  authMiddleware,
  rewardGiftVideo,
);

// =====================================================
// FREE CHIPS
// =====================================================

router.get(
  "/free-chips",
  authMiddleware,
  getFreeChips,
);

router.post(
  "/free-chips/claim",
  authMiddleware,
  claimFreeChips,
);

// =====================================================
// SHOP
// =====================================================

router.get(
  "/shop",
  authMiddleware,
  getShop,
);

// Avatar

router.post(
  "/shop/avatar/buy",
  authMiddleware,
  buyAvatar,
);

router.post(
  "/shop/avatar/select",
  authMiddleware,
  selectAvatar,
);

// Card

router.post(
  "/shop/card/buy",
  authMiddleware,
  buyCardDesign,
);

router.post(
  "/shop/card/select",
  authMiddleware,
  selectCardDesign,
);

// Background

router.post(
  "/shop/background/buy",
  authMiddleware,
  buyTableBackground,
);

router.post(
  "/shop/background/select",
  authMiddleware,
  selectTableBackground,
);

// =====================================================
// CHIPS
// =====================================================

router.post(
  "/chips/deduct",
  authMiddleware,
  deductChips,
);

router.post(
  "/chips/add",
  authMiddleware,
  addChips,
);

// =====================================================
// CHIP RANKING
// =====================================================

router.get(
  "/ranking/chips",
  authMiddleware,
  getChipRanking,
);

export default router;