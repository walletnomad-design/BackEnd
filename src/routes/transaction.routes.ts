import { Router } from "express";
import { getTransactions } from "../controllers/transaction.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", requireAuth, getTransactions);

export default router;