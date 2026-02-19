import mongoose, { Schema, Document } from 'mongoose';

export interface ILocation extends Document {
  locationId: string;
  apiKey: string;
  name: string;
  paginationEnabled: boolean;
  pageSize: number;
  paginationPerStage: boolean;
  sortField: string | null;
  sortOrder: 'asc' | 'desc';
  cardFieldSettings: {
    layout: 'default' | 'compact' | 'unlabeled';
    visibleFields: string[];
    fieldOrder: string[];
  };
  quickActions: {
    visibleActions: string[];
    actionOrder: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

const LocationSchema = new Schema<ILocation>(
  {
    locationId: { type: String, required: true, unique: true, index: true },
    apiKey: { type: String, default: '' },
    name: { type: String, default: '' },
    paginationEnabled: { type: Boolean, default: false },
    pageSize: { type: Number, default: 100 },
    paginationPerStage: { type: Boolean, default: false },
    sortField: { type: String, default: null },
    sortOrder: { type: String, enum: ['asc', 'desc'], default: 'desc' },
    cardFieldSettings: {
      type: {
        layout: { type: String, enum: ['default', 'compact', 'unlabeled'], default: 'default' },
        visibleFields: { type: [String], default: ['smartTags', 'opportunityName', 'businessName', 'contact', 'pipeline', 'stage', 'status'] },
        fieldOrder: { type: [String], default: ['smartTags', 'opportunityName', 'businessName', 'contact', 'pipeline', 'stage', 'status'] },
      },
      default: { layout: 'default', visibleFields: ['smartTags', 'opportunityName', 'businessName', 'contact', 'pipeline', 'stage', 'status'], fieldOrder: ['smartTags', 'opportunityName', 'businessName', 'contact', 'pipeline', 'stage', 'status'] },
    },
    quickActions: {
      type: {
        visibleActions: { type: [String], default: ['call', 'sms', 'email', 'appointment', 'tasks', 'notes', 'tags'] },
        actionOrder: { type: [String], default: ['call', 'sms', 'email', 'appointment', 'tasks', 'notes', 'tags'] },
      },
      default: { visibleActions: ['call', 'sms', 'email', 'appointment', 'tasks', 'notes', 'tags'], actionOrder: ['call', 'sms', 'email', 'appointment', 'tasks', 'notes', 'tags'] },
    },
  },
  { timestamps: true }
);

export default mongoose.models.Location || mongoose.model<ILocation>('Location', LocationSchema);
