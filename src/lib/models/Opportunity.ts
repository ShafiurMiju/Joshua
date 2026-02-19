import mongoose, { Schema, Document } from 'mongoose';

export interface IOpportunity extends Document {
  ghlId: string;
  locationId: string;
  name: string;
  monetaryValue: number;
  pipelineId: string;
  pipelineStageId: string;
  assignedTo: string;
  status: 'open' | 'won' | 'lost' | 'abandoned';
  source: string;
  contactId: string;
  contact: {
    id: string;
    name: string;
    companyName: string;
    email: string;
    phone: string;
    tags: string[];
    followers: string[];
  };
  additionalContacts: string[];
  lastStatusChangeAt: string;
  lastStageChangeAt: string;
  lastActionDate: string;
  isAttribute: boolean;
  internalSource: {
    type?: string;
    id?: string;
    apiVersion?: string;
    channel?: string;
    source?: string;
  };
  followers: string[];
  customFields: Array<Record<string, unknown>>;
  lostReasonId: string;
  ghlCreatedAt: string;
  ghlUpdatedAt: string;
  syncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OpportunitySchema = new Schema<IOpportunity>(
  {
    ghlId: { type: String, required: true, index: true },
    locationId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    monetaryValue: { type: Number, default: 0 },
    pipelineId: { type: String, required: true, index: true },
    pipelineStageId: { type: String, required: true, index: true },
    assignedTo: { type: String, default: '' },
    status: {
      type: String,
      enum: ['open', 'won', 'lost', 'abandoned'],
      default: 'open',
      index: true,
    },
    source: { type: String, default: '' },
    contactId: { type: String, default: '' },
    contact: {
      id: { type: String, default: '' },
      name: { type: String, default: '' },
      companyName: { type: String, default: '' },
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
      tags: { type: [String], default: [] },
      followers: { type: [String], default: [] },
    },
    additionalContacts: { type: [String], default: [] },
    lastStatusChangeAt: { type: String, default: '' },
    lastStageChangeAt: { type: String, default: '' },
    lastActionDate: { type: String, default: '' },
    isAttribute: { type: Boolean, default: false },
    internalSource: {
      type: Schema.Types.Mixed,
      default: {},
    },
    followers: { type: [String], default: [] },
    customFields: { type: Schema.Types.Mixed, default: [] },
    lostReasonId: { type: String, default: '' },
    ghlCreatedAt: { type: String, default: '' },
    ghlUpdatedAt: { type: String, default: '' },
    syncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Compound index for unique opportunity per location
OpportunitySchema.index({ ghlId: 1, locationId: 1 }, { unique: true });

export default mongoose.models.Opportunity || mongoose.model<IOpportunity>('Opportunity', OpportunitySchema);
