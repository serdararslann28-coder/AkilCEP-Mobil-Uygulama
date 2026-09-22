import { Router } from "express";
import { adminAuth } from "../middlewares/adminAuth";

const router = Router();

router.get("/health", adminAuth, (_req, res) => {
  res.json({
    ok: true,
    service: "AkılCEP Admin API",
    timestamp: new Date().toISOString()
  });
});

router.get("/me", adminAuth, (req, res) => {
  const admin = (req as typeof req & {
    adminUser?: { id: string; email: string };
  }).adminUser;

  res.json({
    ok: true,
    admin
  });
});

export default router;
