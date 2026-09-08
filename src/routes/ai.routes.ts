import { Router } from "express";

import { requireAuth } from "../middlewares/auth.middleware";
import { aiChatController } from "../controllers/ai.controller";

const router = Router();

router.post("/chat", requireAuth, aiChatController);

export default router;