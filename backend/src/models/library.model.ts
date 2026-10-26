import mongoose, { Schema, type Document } from 'mongoose';

export interface ILibraryItem extends Document {
  user: mongoose.Types.ObjectId;
  track: mongoose.Types.ObjectId;
  addedAt: Date;
}

const LibraryItemSchema: Schema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    track: { type: Schema.Types.ObjectId, ref: 'Track', required: true, index: true },
    addedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
  }
);

// Prevent duplicate library entries for the same user and track
LibraryItemSchema.index({ user: 1, track: 1 }, { unique: true });
LibraryItemSchema.index({ user: 1, addedAt: -1 });

export const LibraryItem = mongoose.models.LibraryItem || mongoose.model<ILibraryItem>('LibraryItem', LibraryItemSchema);
