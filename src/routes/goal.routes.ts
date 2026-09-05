import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import {
  createGoalController,
  listGoalsController,
  addContributionController,
  removeGoalController,
} from "../controllers/goal.controller";

const router = Router();

router.get("/", requireAuth, listGoalsController);
router.post("/", requireAuth, createGoalController);
router.post("/:id/contributions", requireAuth, addContributionController);
router.delete("/:id", requireAuth, removeGoalController);

export default router;