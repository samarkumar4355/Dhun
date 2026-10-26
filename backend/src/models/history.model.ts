import mongoose, { Schema, type Document } from 'mongoose';

export interface IListeningHistory extends Document {
  user: mongoose.Types.ObjectId;
  track: mongoose.Types.ObjectId;
  playedAt: Date;
  durationPlayedSeconds: number;
  playbackPositionSeconds: number;
  completed: boolean;
}

const ListeningHistorySchema: Schema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    track: { type: Schema.Types.ObjectId, ref: 'Track', required: true, index: true },
    playedAt: { type: Date, default: Date.now, index: true },
    durationPlayedSeconds: { type: Number, default: 0 },
    playbackPositionSeconds: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
  },
  {
    timestamps: false,
  }
);

ListeningHistorySchema.index({ user: 1, playedAt: -1 });

export const ListeningHistory =
  mongoose.models.ListeningHistory ||
  mongoose.model<IListeningHistory>('ListeningHistory', ListeningHistorySchema);
