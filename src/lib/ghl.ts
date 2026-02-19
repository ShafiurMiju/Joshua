import {
  GHLSearchResponse,
  GHLPipelinesResponse,
  GHLOpportunityResponse,
  CreateOpportunityPayload,
  UpdateOpportunityPayload,
} from '@/types';

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const API_VERSION = '2021-07-28';

export class GHLClient {
  private apiKey: string;
  private locationId: string;

  constructor(apiKey: string, locationId: string) {
    this.apiKey = apiKey;
    this.locationId = locationId;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${GHL_API_BASE}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Version: API_VERSION,
        ...options.headers,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GHL API Error:', {
        status: response.status,
        statusText: response.statusText,
        url,
        errorText,
      });
      throw new Error(
        `GHL API Error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return response.json();
  }

  // ==================== PIPELINES ====================

  async getPipelines(): Promise<GHLPipelinesResponse> {
    return this.request<GHLPipelinesResponse>(
      `/opportunities/pipelines?locationId=${this.locationId}`
    );
  }

  // ==================== OPPORTUNITIES ====================

  async searchOpportunities(params: {
    pipelineId?: string;
    pipelineStageId?: string;
    status?: string;
    page?: number;
    limit?: number;
    q?: string;
    order?: string;
    startAfter?: string | number;
    startAfterId?: string;
  } = {}): Promise<GHLSearchResponse> {
    const searchParams = new URLSearchParams();
    searchParams.set('location_id', this.locationId);

    if (params.pipelineId) searchParams.set('pipeline_id', params.pipelineId);
    if (params.pipelineStageId) searchParams.set('pipeline_stage_id', params.pipelineStageId);
    if (params.status) searchParams.set('status', params.status);
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.q) searchParams.set('q', params.q);
    if (params.order) searchParams.set('order', params.order);
    if (params.startAfter) searchParams.set('startAfter', String(params.startAfter));
    if (params.startAfterId) searchParams.set('startAfterId', params.startAfterId);

    return this.request<GHLSearchResponse>(
      `/opportunities/search?${searchParams.toString()}`
    );
  }

  async getOpportunity(opportunityId: string): Promise<GHLOpportunityResponse> {
    return this.request<GHLOpportunityResponse>(
      `/opportunities/${opportunityId}`
    );
  }

  async createOpportunity(data: CreateOpportunityPayload): Promise<GHLOpportunityResponse> {
    const payload = {
      ...data,
      locationId: this.locationId,
    };

    return this.request<GHLOpportunityResponse>('/opportunities/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateOpportunity(
    opportunityId: string,
    data: UpdateOpportunityPayload
  ): Promise<GHLOpportunityResponse> {
    return this.request<GHLOpportunityResponse>(
      `/opportunities/${opportunityId}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
  }

  async deleteOpportunity(opportunityId: string): Promise<{ succeded: boolean }> {
    return this.request<{ succeded: boolean }>(
      `/opportunities/${opportunityId}`,
      {
        method: 'DELETE',
      }
    );
  }

  async updateOpportunityStatus(
    opportunityId: string,
    status: 'open' | 'won' | 'lost' | 'abandoned'
  ): Promise<{ succeded: boolean }> {
    return this.request<{ succeded: boolean }>(
      `/opportunities/${opportunityId}/status`,
      {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }
    );
  }

  // Fetch ALL opportunities with pagination (for sync)
  async fetchAllOpportunities(pipelineId?: string): Promise<GHLSearchResponse['opportunities']> {
    const allOpportunities: GHLSearchResponse['opportunities'] = [];
    let startAfter: string | undefined;
    let startAfterId: string | undefined;
    const limit = 100;
    let hasMore = true;
    let isFirstPage = true;

    while (hasMore) {
      const params: Record<string, string | number | undefined> = {
        limit,
        pipelineId,
      };

      if (!isFirstPage && startAfter && startAfterId) {
        params.startAfter = startAfter;
        params.startAfterId = startAfterId;
      } else if (!isFirstPage) {
        // No pagination info, stop
        break;
      }

      const response = await this.searchOpportunities(params);
      allOpportunities.push(...response.opportunities);

      if (response.opportunities.length < limit) {
        hasMore = false;
      } else if (response.meta?.startAfter && response.meta?.startAfterId) {
        startAfter = String(response.meta.startAfter);
        startAfterId = response.meta.startAfterId;
      } else if (response.meta?.nextPage) {
        // Some endpoints still use page-based
        startAfter = undefined;
        startAfterId = undefined;
        hasMore = false; // fallback: stop if no cursor info
      } else {
        hasMore = false;
      }

      isFirstPage = false;
    }

    return allOpportunities;
  }

  // ==================== CONTACTS ====================

  async getContacts(
    locationId: string,
    query?: string
  ): Promise<{ contacts: Array<{ id: string; name: string; email: string; phone: string }>; total: number }> {
    const searchParams = new URLSearchParams();
    searchParams.set('locationId', locationId);
    if (query) searchParams.set('query', query);
    searchParams.set('limit', '100');

    const response = await this.request<{
      contacts: Array<{ id: string; contactName?: string; firstName?: string; lastName?: string; email?: string; phone?: string }>;
      total?: number;
    }>(`/contacts/?${searchParams.toString()}`);

    // Map GHL contact format to our format
    const contacts = (response.contacts || []).map((contact) => ({
      id: contact.id,
      name: contact.contactName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unnamed Contact',
      email: contact.email || '',
      phone: contact.phone || '',
    }));

    return {
      contacts,
      total: response.total || contacts.length,
    };
  }

  // ==================== USERS ====================

  async getLocationUsers(): Promise<{ users: Array<{ id: string; name: string; firstName?: string; lastName?: string; email?: string; phone?: string; profilePhoto?: string }> }> {
    return this.request<{ users: Array<{ id: string; name: string; firstName?: string; lastName?: string; email?: string; phone?: string; profilePhoto?: string }> }>(
      `/users/?locationId=${this.locationId}`
    );
  }

  async updateContact(
    contactId: string,
    data: {
      firstName?: string;
      lastName?: string;
      name?: string;
      email?: string;
      phone?: string;
      tags?: string[];
      customFields?: Array<{ id: string; key: string; field_value: unknown }>;
    }
  ): Promise<{ succeded: boolean; contact: Record<string, unknown> }> {
    return this.request<{ succeded: boolean; contact: Record<string, unknown> }>(
      `/contacts/${contactId}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
  }

  // ==================== FOLLOWERS ====================

  async addFollowers(
    opportunityId: string,
    followers: string[]
  ): Promise<{ followers: string[]; followersAdded: string[] }> {
    return this.request<{ followers: string[]; followersAdded: string[] }>(
      `/opportunities/${opportunityId}/followers`,
      {
        method: 'POST',
        body: JSON.stringify({ followers }),
      }
    );
  }

  async removeFollowers(
    opportunityId: string,
    followers: string[],
    removeAll = false
  ): Promise<{ followers: string[]; followersRemoved: string[] }> {
    const qsParams = new URLSearchParams();
    if (removeAll) qsParams.set('isRemoveAllFollowers', 'true');
    // Some HTTP implementations strip DELETE bodies, so pass followers in both body and query
    const qs = qsParams.toString() ? `?${qsParams.toString()}` : '';
    return this.request<{ followers: string[]; followersRemoved: string[] }>(
      `/opportunities/${opportunityId}/followers${qs}`,
      {
        method: 'DELETE',
        body: JSON.stringify({ followers }),
      }
    );
  }

  // ==================== TAGS ====================

  async getLocationTags(): Promise<{ tags: Array<{ id: string; name: string }> }> {
    return this.request<{ tags: Array<{ id: string; name: string }> }>(
      `/locations/${this.locationId}/tags`
    );
  }

  // ==================== CUSTOM FIELDS ====================

  async getCustomFields(
    model: 'opportunity' | 'contact' = 'opportunity'
  ): Promise<{
    customFields: Array<{
      id: string;
      name: string;
      fieldKey: string;
      dataType: string;
      placeholder?: string;
      position?: number;
      picklistOptions?: string[];
      picklistImageOptions?: unknown[];
      allowCustomOption?: boolean;
      isMultiFileAllowed?: boolean;
      maxFileLimit?: number;
      isRequired?: boolean;
      model?: string;
      parentId?: string;
    }>;
  }> {
    return this.request<{
      customFields: Array<{
        id: string;
        name: string;
        fieldKey: string;
        dataType: string;
        placeholder?: string;
        position?: number;
        picklistOptions?: string[];
        picklistImageOptions?: unknown[];
        allowCustomOption?: boolean;
        isMultiFileAllowed?: boolean;
        maxFileLimit?: number;
        isRequired?: boolean;
        model?: string;
        parentId?: string;
      }>;
    }>(`/locations/${this.locationId}/customFields?model=${model}`);
  }

  // Fetch a single custom field or folder by ID
  async getCustomField(fieldId: string): Promise<{
    customField: {
      id: string;
      name: string;
      fieldKey?: string;
      dataType?: string;
      documentType?: string; // "folder" for folder entries
      model?: string;
      position?: number;
      standard?: boolean;
      parentId?: string;
      picklistOptions?: string[];
      picklistImageOptions?: unknown[];
      allowCustomOption?: boolean;
      isMultiFileAllowed?: boolean;
      maxFileLimit?: number;
      isRequired?: boolean;
    };
  }> {
    return this.request<{
      customField: {
        id: string;
        name: string;
        fieldKey?: string;
        dataType?: string;
        documentType?: string;
        model?: string;
        position?: number;
        standard?: boolean;
        parentId?: string;
        picklistOptions?: string[];
        picklistImageOptions?: unknown[];
        allowCustomOption?: boolean;
        isMultiFileAllowed?: boolean;
        maxFileLimit?: number;
        isRequired?: boolean;
      };
    }>(`/locations/${this.locationId}/customFields/${fieldId}`);
  }

  getLocationId(): string {
    return this.locationId;
  }
}
