import mongoose, { Schema, type Document } from 'mongoose';

export interface IAlbum extends Document {
  title: string;
  titleNormalized: string;
  artists: mongoose.Types.ObjectId[];
  tracks: mongoose.Types.ObjectId[];
  artworkUrl?: string;
  releaseYear?: number;
  releaseDate?: Date;
  albumType: 'album' | 'ep' | 'single' | 'compilation';
  totalTracks?: number;
  totalDiscs?: number;
  genres: mongoose.Types.ObjectId[];
  provenance: string;
  createdAt: Date;
  updatedAt: Date;
}

const AlbumSchema: Schema = new Schema(
  {
    title: { type: String, required: true, trim: true, index: true },
    titleNormalized: { type: String, required: true, trim: true, lowercase: true, index: true },
    artists: [{ type: Schema.Types.ObjectId, ref: 'Artist', required: true }],
    tracks: [{ type: Schema.Types.ObjectId, ref: 'Track' }],
    artworkUrl: { type: String, trim: true },
    releaseYear: { type: Number },
    releaseDate: { type: Date },
    albumType: {
      type: String,
      enum: ['album', 'ep', 'single', 'compilation'],
      default: 'album',
    },
    totalTracks: { type: Number },
    totalDiscs: { type: Number, default: 1 },
    genres: [{ type: Schema.Types.ObjectId, ref: 'Genre' }],
    provenance: { type: String, default: 'tag-extracted' },
  },
  {
    timestamps: true,
  }
);

AlbumSchema.index({ titleNormalized: 1, artists: 1 });

export const Album = mongoose.models.Album || mongoose.model<IAlbum>('Album', AlbumSchema);
