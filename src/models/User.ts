import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  username: string;
  email: string;
  password: string;

  googleId?: string;
  authProvider: "local" | "google";

  // =====================================================
  // PROFILE
  // =====================================================

  avatar: string;

  // =====================================================
  // OWNED ITEMS
  // =====================================================

  ownedAvatars: string[];

  ownedCardDesigns: string[];

  ownedTableBackgrounds: string[];

  // =====================================================
  // ACTIVE ITEMS
  // =====================================================

  activeCardDesign: string;

  activeTableBackground: string;

  // =====================================================
  // CURRENCY
  // =====================================================

  chips: number;

  chipsD: number;

  // =====================================================
  // STATS
  // =====================================================

  wins: number;

  losses: number;

  gamesPlayed: number;

  // =====================================================
  // BUY / SELL
  // =====================================================

  buysell: boolean;

  // =====================================================
  // GIFTS
  // =====================================================

  // مجموع چیپ‌هایی که کاربر در بازی‌ها برنده شده
  totalWon: number;

  // Free Gift
  gift: {
    lastClaimAt: Date | null;
    nextClaimAt: Date | null;
  };

  // Gifts unlocked by totalWon
  giftProgress: {
    silver: {
      unlockedAt: Date | null;
      readyAt: Date | null;
      claimed: boolean;
    };

    gold: {
      unlockedAt: Date | null;
      readyAt: Date | null;
      claimed: boolean;
    };

    diamond: {
      unlockedAt: Date | null;
      readyAt: Date | null;
      claimed: boolean;
    };

    royal: {
      unlockedAt: Date | null;
      readyAt: Date | null;
      claimed: boolean;
    };

    legendary: {
      unlockedAt: Date | null;
      readyAt: Date | null;
      claimed: boolean;
    };
  };

  // =====================================================
  // FREE CHIPS
  // =====================================================

  freeChips: {
    claims: number;
    nextClaimAt: Date | null;
  };
}

const UserSchema = new Schema<IUser>(
  {
    // =====================================================
    // USER
    // =====================================================

    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      default: "",
    },

    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },

    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },

    // =====================================================
    // AVATAR
    // =====================================================

    avatar: {
      type: String,
      default: "avatar1",
    },

    // =====================================================
    // OWNED AVATARS
    // =====================================================

    ownedAvatars: {
      type: [String],
      default: ["avatar1"],
    },

    // =====================================================
    // OWNED CARD DESIGNS
    // =====================================================

    ownedCardDesigns: {
      type: [String],
      default: ["default"],
    },

    // =====================================================
    // OWNED TABLE BACKGROUNDS
    // =====================================================

    ownedTableBackgrounds: {
      type: [String],
      default: ["default"],
    },

    // =====================================================
    // ACTIVE CARD DESIGN
    // =====================================================

    activeCardDesign: {
      type: String,
      default: "default",
    },

    // =====================================================
    // ACTIVE TABLE BACKGROUND
    // =====================================================

    activeTableBackground: {
      type: String,
      default: "default",
    },

    // =====================================================
    // CHIPS
    // =====================================================

    chips: {
      type: Number,
      default: 10000,
    },

    chipsD: {
      type: Number,
      default: 0,
    },

    // =====================================================
    // STATS
    // =====================================================

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

    // =====================================================
    // BUY / SELL
    // =====================================================

    buysell: {
      type: Boolean,
      default: false,
    },

    // =====================================================
    // TOTAL WON
    // =====================================================

    totalWon: {
      type: Number,
      default: 0,
    },

    // =====================================================
    // FREE GIFT
    // =====================================================

    gift: {
      lastClaimAt: {
        type: Date,
        default: null,
      },

      nextClaimAt: {
        type: Date,
        default: null,
      },
    },

    // =====================================================
    // GIFT PROGRESS
    // =====================================================

    giftProgress: {
      // ---------------------------------------------------
      // SILVER
      // Unlock: 500 totalWon
      // Wait: 6 hours
      // ---------------------------------------------------

      silver: {
        unlockedAt: {
          type: Date,
          default: null,
        },

        readyAt: {
          type: Date,
          default: null,
        },

        claimed: {
          type: Boolean,
          default: false,
        },
      },

      // ---------------------------------------------------
      // GOLD
      // Unlock: 2,500 totalWon
      // Wait: 6 hours
      // ---------------------------------------------------

      gold: {
        unlockedAt: {
          type: Date,
          default: null,
        },

        readyAt: {
          type: Date,
          default: null,
        },

        claimed: {
          type: Boolean,
          default: false,
        },
      },

      // ---------------------------------------------------
      // DIAMOND
      // Unlock: 10,000 totalWon
      // Wait: 6 hours
      // ---------------------------------------------------

      diamond: {
        unlockedAt: {
          type: Date,
          default: null,
        },

        readyAt: {
          type: Date,
          default: null,
        },

        claimed: {
          type: Boolean,
          default: false,
        },
      },

      // ---------------------------------------------------
      // ROYAL
      // Unlock: 50,000 totalWon
      // Wait: 6 hours
      // ---------------------------------------------------

      royal: {
        unlockedAt: {
          type: Date,
          default: null,
        },

        readyAt: {
          type: Date,
          default: null,
        },

        claimed: {
          type: Boolean,
          default: false,
        },
      },

      // ---------------------------------------------------
      // LEGENDARY
      // Unlock: 250,000 totalWon
      // Wait: 6 hours
      // ---------------------------------------------------

      legendary: {
        unlockedAt: {
          type: Date,
          default: null,
        },

        readyAt: {
          type: Date,
          default: null,
        },

        claimed: {
          type: Boolean,
          default: false,
        },
      },
    },

    // =====================================================
    // FREE CHIPS
    // =====================================================

    freeChips: {
      claims: {
        type: Number,
        default: 0,
      },

      nextClaimAt: {
        type: Date,
        default: null,
      },
    },
  },

  {
    timestamps: true,
  },
);

export default mongoose.model<IUser>("User", UserSchema);
