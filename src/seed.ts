import dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcrypt";
import { connectDatabase } from "./config/database";
import User from "./models/User";

async function seed() {
  try {
    await connectDatabase();

    await User.deleteMany();

    const password = await bcrypt.hash("123456", 10);

    await User.insertMany([
      {
        username: "emir",
        email: "emir@test.com",
        password,
        chips: 100000,
      },
      {
        username: "ali",
        email: "ali@test.com",
        password,
        chips: 50000,
      },
      {
        username: "reza",
        email: "reza@test.com",
        password,
        chips: 25000,
      },
      {
        username: "sara",
        email: "sara@test.com",
        password,
        chips: 75000,
      },
    ]);

    console.log("Users Created");
    process.exit();
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
}

seed(); 