import { Router } from "express";
import { getBalances } from "../controllers/balance.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", requireAuth, getBalances);

export default router;