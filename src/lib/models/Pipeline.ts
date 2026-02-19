import mongoose, { Schema, Document } from 'mongoose';

export interface IPipelineStage {
  id: string;
  name: string;
  position: number;
  showInFunnel?: boolean;
  showInPieChart?: boolean;
}

export interface IPipeline extends Document {
  ghlId: string;
  locationId: string;
  name: string;
  stages: IPipelineStage[];
  syncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PipelineStageSchema = new Schema<IPipelineStage>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    position: { type: Number, required: true },
    showInFunnel: { type: Boolean, default: false },
    showInPieChart: { type: Boolean, default: false },
  },
  { _id: false }
);

const PipelineSchema = new Schema<IPipeline>(
  {
    ghlId: { type: String, required: true, index: true },
    locationId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    stages: { type: [PipelineStageSchema], default: [] },
    syncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

PipelineSchema.index({ ghlId: 1, locationId: 1 }, { unique: true });

export default mongoose.models.Pipeline || mongoose.model<IPipeline>('Pipeline', PipelineSchema);
