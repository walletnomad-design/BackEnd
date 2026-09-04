import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import walletRoutes from "./routes/wallet.routes";
import balanceRoutes from "./routes/balance.routes";
import transactionRoutes from "./routes/transaction.routes";
import ratesRoutes from "./routes/rates.routes";
import exchangeRoutes from "./routes/exchange.routes";

const app = express();

// Middlewares generales
app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/rates", ratesRoutes);

// Ruta simple para comprobar que la API funciona
app.get("/", (_req, res) => {
  res.status(200).json({
    message: "NomadWallet API funcionando",
  });
});

app.use("/api/exchange", exchangeRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/balances", balanceRoutes);
app.use("/api/transactions", transactionRoutes);
export default app;