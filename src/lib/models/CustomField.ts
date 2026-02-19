import mongoose, { Schema, Document } from 'mongoose';

export interface ICustomField extends Document {
  ghlId: string;
  locationId: string;
  name: string;
  fieldKey: string;
  dataType: string;
  placeholder: string;
  position: number;
  picklistOptions: string[];
  picklistImageOptions: unknown[];
  allowCustomOption: boolean;
  isMultiFileAllowed: boolean;
  maxFileLimit: number;
  isRequired: boolean;
  fieldModel: string; // 'opportunity' | 'contact' – renamed to avoid Mongoose Document.model conflict
  parentId: string; // folder ID – empty string if top-level
  parentName: string; // resolved folder name (denormalized for convenience)
  isFolder: boolean; // true when this entry IS a folder
  syncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CustomFieldSchema = new Schema<ICustomField>(
  {
    ghlId: { type: String, required: true, index: true },
    locationId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    fieldKey: { type: String, default: '' },
    dataType: { type: String, default: '' },
    placeholder: { type: String, default: '' },
    position: { type: Number, default: 0 },
    picklistOptions: { type: [String], default: [] },
    picklistImageOptions: { type: Schema.Types.Mixed, default: [] },
    allowCustomOption: { type: Boolean, default: false },
    isMultiFileAllowed: { type: Boolean, default: false },
    maxFileLimit: { type: Number, default: 0 },
    isRequired: { type: Boolean, default: false },
    fieldModel: { type: String, default: 'opportunity' },
    parentId: { type: String, default: '' },
    parentName: { type: String, default: '' },
    isFolder: { type: Boolean, default: false },
    syncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Unique field per location
CustomFieldSchema.index({ ghlId: 1, locationId: 1 }, { unique: true });

export default mongoose.models.CustomField ||
  mongoose.model<ICustomField>('CustomField', CustomFieldSchema);
