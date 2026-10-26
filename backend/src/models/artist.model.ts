import mongoose, { Schema, type Document } from 'mongoose';

export interface IArtist extends Document {
  name: string;
  nameNormalized: string;
  bio?: string;
  artworkUrl?: string;
  country?: string;
  genres: mongoose.Types.ObjectId[];
  externalLinks?: { platform: string; url: string }[];
  provenance: string;
  createdAt: Date;
  updatedAt: Date;
}

const ArtistSchema: Schema = new Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    nameNormalized: { type: String, required: true, trim: true, lowercase: true, index: true },
    bio: { type: String, trim: true },
    artworkUrl: { type: String, trim: true },
    country: { type: String, trim: true },
    genres: [{ type: Schema.Types.ObjectId, ref: 'Genre' }],
    externalLinks: [
      {
        platform: { type: String, required: true, trim: true },
        url: { type: String, required: true, trim: true },
      },
    ],
    provenance: { type: String, default: 'tag-extracted' },
  },
  {
    timestamps: true,
  }
);

export const Artist = mongoose.models.Artist || mongoose.model<IArtist>('Artist', ArtistSchema);
