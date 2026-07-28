import type { Request, Response } from "express";
import Database from "better-sqlite3";

export function leave(_db: InstanceType<typeof Database>) {
  return (_req: Request, res: Response): void => {
    res.status(501).json({ error: { code: "not_implemented", message: "Not implemented (S2)." } });
  };
}
