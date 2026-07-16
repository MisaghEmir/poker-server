import { Request, Response } from "express";
import User from "../models/User";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { AuthRequest } from "../middleware/authMiddleware";

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });

  if (!user)
    return res.status(400).json({
      message: "User not found",
    });

  const match = await bcrypt.compare(password, user.password);

  if (!match)
    return res.status(400).json({
      message: "Wrong password",
    });

  const token = user.token;
  // console.log({ user });

  res.json({
    token,
    user,
  });
};

export const me = async (req: AuthRequest, res: Response) => {
  res.status(200).json({
    message: "Valid Token",
  });
};
