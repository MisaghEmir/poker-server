import mongoose from "mongoose";

const TableSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: "Poker Table",
    },

    maxPlayers: {
      type: Number,
      default: 5,
    },

    players: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },

        chips: {
          type: Number,
          default: 10000,
        },

        seat: {
          type: Number,
        },
        socketId: {
          type: String,
        },
      },
    ],

    status: {
      type: String,
      enum: ["waiting", "playing"],
      default: "waiting",
    },

    pot: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("table", TableSchema);
