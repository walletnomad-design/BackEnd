import { Router } from "express";
import { getWallet } from "../controllers/wallet.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", requireAuth, getWallet);

export default router;