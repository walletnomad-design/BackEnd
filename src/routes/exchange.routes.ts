import { Router } from "express";

import { exchangeCurrency } from "../controllers/exchange.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

router.post("/", requireAuth, exchangeCurrency);

export default router;