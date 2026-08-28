import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import walletRoutes from "./routes/wallet.routes";
import balanceRoutes from "./routes/balance.routes";


const app = express();

// Middlewares generales
app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);

// Ruta simple para comprobar que la API funciona
app.get("/", (_req, res) => {
  res.status(200).json({
    message: "NomadWallet API funcionando",
  });
});

app.use("/api/wallet", walletRoutes);
app.use("/api/balances", balanceRoutes);

export default app;