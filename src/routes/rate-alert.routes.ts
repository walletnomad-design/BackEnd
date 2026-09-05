import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";

import {
  createRateAlertController,
  listRateAlertsController,
  removeRateAlertController,
  reactivateRateAlertController,
  evaluateRateAlertsController,
} from "../controllers/rate-alert.controller";

const router = Router();

router.get("/", requireAuth, listRateAlertsController);
router.post("/", requireAuth, createRateAlertController);
router.post("/evaluate", requireAuth, evaluateRateAlertsController);
router.post("/:id/reactivate", requireAuth, reactivateRateAlertController);
router.delete("/:id", requireAuth, removeRateAlertController);

export default router;