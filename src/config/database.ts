import mongoose from "mongoose";

export const connectDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI!);

    console.log("Mongo Connected");
  } catch (error) {
    console.log(error);

    process.exit(1);
  }
};