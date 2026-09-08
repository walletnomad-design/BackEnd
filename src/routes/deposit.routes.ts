import { Router } from "express";

import { requireAuth } from "../middlewares/auth.middleware";
import { depositController } from "../controllers/deposit.controller";

const router = Router();

router.post("/", requireAuth, depositController);

export default router;