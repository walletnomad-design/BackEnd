import { Router } from "express";

import { requireAuth } from "../middlewares/auth.middleware";
import { transferController } from "../controllers/transfer.controller";

const router = Router();

router.post("/", requireAuth, transferController);

export default router;