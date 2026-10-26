import mongoose, { Schema, type Document } from 'mongoose';

export interface IGenre extends Document {
  name: string;
  nameNormalized: string;
  parentGenre?: mongoose.Types.ObjectId | null;
  description?: string;
  artworkUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const GenreSchema: Schema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    nameNormalized: { type: String, required: true, trim: true, lowercase: true, index: true },
    parentGenre: { type: Schema.Types.ObjectId, ref: 'Genre', default: null },
    description: { type: String, trim: true },
    artworkUrl: { type: String, trim: true },
  },
  {
    timestamps: true,
  }
);

export const Genre = mongoose.models.Genre || mongoose.model<IGenre>('Genre', GenreSchema);
