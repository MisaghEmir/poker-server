import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";

export interface AuthRequest extends Request {
  user?: any;
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const token = req.headers.authorization?.split(" ")[1];
  const id = req.headers.id as string;
  const user = await User.findById(id).lean();
  const userToken = user?.token;

  if (!token) {
    return res.status(401).json({
      message: "No Token",
    });
  }

  try {
    if (token === user?.token) {
      next();
    }
  } catch {
    return res.status(401).json({
      message: "Invalid Token",
    });
  }
  return;
};
