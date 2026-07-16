import { Router } from "express";
import { login,me  } from "../controllers/login";
import { authMiddleware } from "../middleware/authMiddleware";


const router = Router();

router.post("/login", login);
// بررسی توکن
router.get("/me", authMiddleware, me);

export default router;
