import mongoose, { Schema, type Document } from 'mongoose';

export interface IPlaylistTrack {
  track: mongoose.Types.ObjectId;
  addedAt: Date;
  position: number;
}

export interface IPlaylist extends Document {
  title: string;
  description?: string;
  artworkUrl?: string;
  owner: mongoose.Types.ObjectId;
  isPublic: boolean;
  tracks: IPlaylistTrack[];
  trackCount: number;
  totalDurationSeconds: number;
  createdAt: Date;
  updatedAt: Date;
}

const PlaylistTrackSchema: Schema = new Schema(
  {
    track: { type: Schema.Types.ObjectId, ref: 'Track', required: true },
    addedAt: { type: Date, default: Date.now },
    position: { type: Number, required: true },
  },
  { _id: false }
);

const PlaylistSchema: Schema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    artworkUrl: { type: String, trim: true },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    isPublic: { type: Boolean, default: false, index: true },
    tracks: [PlaylistTrackSchema],
    trackCount: { type: Number, default: 0 },
    totalDurationSeconds: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

PlaylistSchema.index({ owner: 1, createdAt: -1 });

export const Playlist = mongoose.models.Playlist || mongoose.model<IPlaylist>('Playlist', PlaylistSchema);
