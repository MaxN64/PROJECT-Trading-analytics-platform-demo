// упрощённая "авторизация": берём userId из заголовка X-User-Id,
// иначе используем один демо-юзер для локалки.
import mongoose from "mongoose";

export function attachUser(req, _res, next) {
  const id = req.header("x-user-id") || "000000000000000000000001";
  try {
    req.user = { _id: new mongoose.Types.ObjectId(id) };
  } catch {
    req.user = { _id: new mongoose.Types.ObjectId("000000000000000000000001") };
  }
  next();
}
