import {
  findTable,
  joinOrCreateTable,
  createPrivateTable,
  joinPrivateTable,
  deletePrivateTable,
} from "../controllers/table";

import {
  Request,
  Response,
  Router,
} from "express";

const router = Router();

// پیدا کردن یا ساختن میز بر اساس stakes
router.post("/find", findTable);

// بررسی توکن
router.post("/join", async (
  req: Request,
  res: Response
) => {
  try {
    const userId = req.body?.user?._id;

    if (!userId) {
      return res.status(401).json({
        error: "کاربر احراز هویت نشده",
      });
    }

    const result =
      await joinOrCreateTable(userId);

    return res.json(result);
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: "خطای سرور",
    });
  }
});

router.post("/private/create", createPrivateTable);

router.post("/private/join", joinPrivateTable);

router.delete(
  "/private/:tableId",
  deletePrivateTable
);

export default router;

