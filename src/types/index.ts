// ==================== GHL API Types ====================

export interface GHLOpportunity {
  id: string;
  name: string;
  monetaryValue: number;
  pipelineId: string;
  pipelineStageId: string;
  pipelineStageUId?: string;
  assignedTo: string;
  status: 'open' | 'won' | 'lost' | 'abandoned';
  source: string;
  contactId: string;
  locationId: string;
  lastStatusChangeAt: string;
  lastStageChangeAt: string;
  lastActionDate: string;
  indexVersion?: number;
  createdAt: string;
  updatedAt: string;
  contact?: GHLContact;
  notes?: string[];
  tasks?: string[];
  calendarEvents?: string[];
  customFields?: GHLCustomField[];
  followers?: string[];
  lostReasonId?: string;
  isAttribute?: boolean;
  internalSource?: Record<string, unknown>;
}

export interface GHLContact {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  tags?: string[];
  source?: string;
  locationId?: string;
  followers?: string[];
  score?: unknown[];
}

export interface GHLCustomField {
  id: string;
  key: string;
  field_value: string | string[] | Record<string, unknown>;
}

export interface GHLPipelineStage {
  id: string;
  name: string;
  position: number;
  showInFunnel?: boolean;
  showInPieChart?: boolean;
}

export interface GHLPipeline {
  id: string;
  name: string;
  stages: GHLPipelineStage[];
  locationId: string;
  showInFunnel?: boolean;
}

// ==================== API Response Types ====================

export interface GHLSearchResponse {
  opportunities: GHLOpportunity[];
  meta: {
    total: number;
    currentPage: number;
    nextPage: number | null;
    previousPage: number | null;
    startAfter: number;
    startAfterId: string;
  };
  aggregations: Record<string, unknown>;
}

export interface GHLPipelinesResponse {
  pipelines: GHLPipeline[];
}

export interface GHLOpportunityResponse {
  opportunity: GHLOpportunity;
}

// ==================== Create/Update Payloads ====================

export interface CreateOpportunityPayload {
  pipelineId: string;
  locationId: string;
  name: string;
  pipelineStageId?: string;
  status: 'open' | 'won' | 'lost' | 'abandoned';
  contactId: string;
  monetaryValue?: number;
  assignedTo?: string;
  customFields?: GHLCustomField[];
  source?: string;
}

export interface UpdateOpportunityPayload {
  pipelineId?: string;
  name?: string;
  pipelineStageId?: string;
  status?: 'open' | 'won' | 'lost' | 'abandoned';
  contactId?: string;
  monetaryValue?: number;
  assignedTo?: string;
  customFields?: GHLCustomField[];
}

// ==================== DB Types ====================

export interface DBLocation {
  _id?: string;
  locationId: string;
  apiKey: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DBOpportunity {
  _id?: string;
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
  additionalContacts?: string[];
  lastStatusChangeAt: string;
  lastStageChangeAt: string;
  lastActionDate: string;
  isAttribute: boolean;
  internalSource: Record<string, unknown>;
  followers: string[];
  lostReasonId?: string;
  customFields: GHLCustomField[];
  ghlCreatedAt: string;
  ghlUpdatedAt: string;
  syncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DBPipeline {
  _id?: string;
  ghlId: string;
  locationId: string;
  name: string;
  stages: GHLPipelineStage[];
  syncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== Frontend Types ====================

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
