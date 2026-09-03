import { Router } from "express";
import { getRatesController } from "../controllers/rates.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", requireAuth, getRatesController);

export default router;