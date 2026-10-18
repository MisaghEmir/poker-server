import { Router } from "express";

const router = Router();

router.get("/version", (_, res) => {
  res.json({
    latestVersion: "1.0.0",
    minVersion: "1.0.0",
    downloadUrl: "https://YOUR-DOWNLOAD-LINK.com/poker.apk",
  });
});

export default router;