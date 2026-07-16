import { findTable, joinOrCreateTable } from "../controllers/table";
import { Request, Response, Router } from "express";

const router = Router();

router.get("/find/:id", findTable);
// بررسی توکن

router.post("/join", async (req: Request, res: Response) => {
  try {
    const userId = req.body?.user._id; // بسته به میدل‌ور احراز هویت شما
    if (!userId) {
      return res.status(401).json({ error: "کاربر احراز هویت نشده" });
    }

    const result = await joinOrCreateTable(userId);

    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "خطای سرور" });
  }
});

export default router;
