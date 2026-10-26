import mongoose, { Schema, type Document } from 'mongoose';

export interface IFavorite extends Document {
  user: mongoose.Types.ObjectId;
  track: mongoose.Types.ObjectId;
  addedAt: Date;
}

const FavoriteSchema: Schema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    track: { type: Schema.Types.ObjectId, ref: 'Track', required: true, index: true },
    addedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
  }
);

// Prevent duplicate favorites for the same user and track
FavoriteSchema.index({ user: 1, track: 1 }, { unique: true });
FavoriteSchema.index({ user: 1, addedAt: -1 });

export const Favorite = mongoose.models.Favorite || mongoose.model<IFavorite>('Favorite', FavoriteSchema);
