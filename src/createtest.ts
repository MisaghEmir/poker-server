import dotenv from "dotenv";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import User from "./models/User";

dotenv.config();

async function seed() {
  await mongoose.connect(process.env.MONGO_URI!);

  const password = await bcrypt.hash("123456", 10);

  const user = await User.findOneAndUpdate(
    { email: "emir@test.com" },
    {
      username: "emir",
      email: "emir@test.com",
      password,
      avatar: "",
      chips: 10000,
      wins: 0,
      losses: 0,
      gamesPlayed: 0,
    },
    {
      new: true,
      upsert: true,
    }
  );

  console.log("USER CREATED:", user);

  await mongoose.disconnect();
}

seed();