import { Router } from "express";
import { requireAuth, requireAdmin } from "../middlewares/auth.middleware";
import { getAdminSummaryController } from "../controllers/admin.controller";

const router = Router();

router.get(
  "/summary",
  requireAuth,
  requireAdmin,
  getAdminSummaryController
);

export default router;