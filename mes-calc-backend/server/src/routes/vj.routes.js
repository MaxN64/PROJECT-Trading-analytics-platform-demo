// server/src/routes/vj.routes.js
import { Router } from "express";
import { listDays, getDay, upsertDay } from "../controllers/vj.controller.js";

const router = Router();

router.get("/", listDays);
router.get("/:day", getDay);
router.post("/:day", upsertDay);

export default router;
