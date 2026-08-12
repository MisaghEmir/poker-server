import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  avatar: string;
  token: string;
  chips: number;
  chipsD: number;
  wins: number;
  losses: number;
  gamesPlayed: number;
  buysell: boolean;
}

const UserSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
    },

    password: {
      type: String,
      required: true,
    },

    avatar: {
      type: String,
      default: "",
    },

    chips: {
      type: Number,
      default: 10000,
    },

    wins: {
      type: Number,
      default: 0,
    },

    losses: {
      type: Number,
      default: 0,
    },

    gamesPlayed: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IUser>("User", UserSchema);