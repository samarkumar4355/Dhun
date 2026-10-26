import mongoose, { Schema, type Document } from 'mongoose';

export interface IUserSession {
  tokenHash: string;
  expiresAt: Date;
  userAgent?: string;
  ip?: string;
}

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  displayName: string;
  role: 'user' | 'admin';
  avatarUrl?: string;
  emailVerified: boolean;
  resetPasswordToken?: string | null;
  resetPasswordExpires?: Date | null;
  refreshTokens: IUserSession[];
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
      index: true,
    },
    avatarUrl: {
      type: String,
      trim: true,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
    },
    refreshTokens: [
      {
        tokenHash: { type: String, required: true },
        expiresAt: { type: Date, required: true },
        userAgent: { type: String },
        ip: { type: String },
      },
    ],
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
