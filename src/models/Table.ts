import mongoose from "mongoose";

const TableSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: "Poker Table",
    },

    // Private / Public
    isPrivate: {
      type: Boolean,
      default: false,
      index: true,
    },

    // فقط برای میزهای خصوصی
    tableCode: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    // نوع میز / Stakes
    // مثال: "1 / 2" ، "2 / 4" ، "5 / 10"
    stakes: {
      type: String,
      required: true,
      index: true,
    },

    // تعداد جایگاه‌های میز
    maxPlayers: {
      type: Number,
      default: 5,
      min: 2,
      max: 5,
    },

    // حداقل چیپ برای ورود به میز
    buyIn: {
      type: Number,
      default: 1000,
      min: 1,
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