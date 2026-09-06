import { describe, it, expect } from "vitest";
import {
  register,
  InvalidEmailError,
  InvalidPasswordError,
} from "../services/auth.service";

describe("auth.service - validacion de password alfanumerica", () => {
  it("rechaza password con menos de 8 caracteres", async () => {
    await expect(register("pass@x.com", "abc1234")).rejects.toBeInstanceOf(
      InvalidPasswordError
    );
  });

  it("rechaza password con solo letras (sin numeros)", async () => {
    await expect(register("pass@x.com", "abcdefgh")).rejects.toBeInstanceOf(
      InvalidPasswordError
    );
  });

  it("rechaza password con solo numeros (sin letras)", async () => {
    await expect(register("pass@x.com", "12345678")).rejects.toBeInstanceOf(
      InvalidPasswordError
    );
  });

  it("el mensaje indica minimo 8 caracteres con letras y numeros", async () => {
    await expect(register("pass@x.com", "12345678")).rejects.toMatchObject({
      message: "La contraseña debe tener al menos 8 caracteres, con letras y números",
    });
  });

  it("sigue validando el email antes que la password", async () => {
    await expect(register("email-malo", "abc12345")).rejects.toBeInstanceOf(
      InvalidEmailError
    );
  });
});