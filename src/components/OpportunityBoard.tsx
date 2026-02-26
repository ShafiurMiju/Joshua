'use client';

import { useState, useEffect, useCallback, useRef, useMemo, memo, createContext, useContext } from 'react';
import {
  RefreshCw,
  Plus,
  Search,
  ChevronDown,
  LayoutGrid,
  List,
  Download,
  MoreVertical,
  Settings,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Loader2,
} from 'lucide-react';
import OpportunityCard from '@/components/OpportunityCard';
import OpportunityForm from '@/components/OpportunityForm';
import CustomizeCardPanel from '@/components/CustomizeCardPanel';

interface PipelineStage {
  id: string;
  name: string;
  position: number;
}

interface Pipeline {
  _id: string;
  ghlId: string;
  locationId: string;
  name: string;
  stages: PipelineStage[];
}

interface Opportunity {
  _id: string;
  ghlId: string;
  name: string;
  monetaryValue: number;
  pipelineId: string;
  pipelineStageId: string;
  status: string;
  source: string;
  contactId: string;
  contact: {
    id: string;
    name: string;
    companyName: string;
    email: string;
    phone: string;
    tags?: string[];
    followers?: string[];
  };
  isAttribute?: boolean;
  internalSource?: Record<string, unknown>;
  followers?: string[];
  additionalContacts?: string[];
  assignedTo?: string;
  ghlCreatedAt?: string;
  ghlUpdatedAt?: string;
  lastStatusChangeAt?: string;
  lastStageChangeAt?: string;
  customFields?: Array<{ id: string; key: string; field_value: string | string[] | Record<string, unknown> }>;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface OpportunityBoardProps {
  locationId: string;
}

// Context for operation states — changes here don't force StageColumn to re-render
interface OperationState {
  draggedId: string | null;
  movingId: string | null;
  deletingId: string | null;
  updatingId: string | null;
  onDragStart: (opp: Opportunity) => void;
  onEdit: (opp: Opportunity) => void;
  onDelete: (ghlId: string) => void;
  onStatusChange: (ghlId: string, status: string) => void;
}
const OperationContext = createContext<OperationState>({
  draggedId: null, movingId: null, deletingId: null, updatingId: null,
  onDragStart: () => {}, onEdit: () => {}, onDelete: () => {}, onStatusChange: () => {},
});

interface CardWrapperProps {
  opp: Opportunity;
  visibleCardFields: string[];
  cardFieldOrder: string[];
  cardLayout: 'default' | 'compact' | 'unlabeled';
  pipelineName: string;
  stageName: string;
  visibleActions: string[];
  actionOrder: string[];
  locationId: string;
}
const CardWrapper = memo(function CardWrapper({
  opp, visibleCardFields, cardFieldOrder, cardLayout, pipelineName, stageName, visibleActions, actionOrder, locationId,
}: CardWrapperProps) {
  const { draggedId, movingId, deletingId, updatingId, onDragStart, onEdit, onDelete, onStatusChange } = useContext(OperationContext);
  const isMoving = movingId === opp.ghlId;
  const isOtherOp = deletingId === opp.ghlId || updatingId === opp.ghlId;
  return (
    <div
      draggable={!movingId && !deletingId && !updatingId}
      onDragStart={() => onDragStart(opp)}
      className={`cursor-move relative ${
        draggedId === opp.ghlId ? 'opacity-50' : ''
      } ${isMoving ? 'blur-[2px] opacity-60 pointer-events-none select-none' : ''}`}
    >
      {isOtherOp && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-30 rounded-lg">
          <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
        </div>
      )}
      <OpportunityCard
        opportunity={opp}
        onEdit={(o) => onEdit(o as unknown as Opportunity)}
        onDelete={onDelete}
        onStatusChange={onStatusChange}
        visibleFields={visibleCardFields}
        fieldOrder={cardFieldOrder}
        layout={cardLayout}
        pipelineName={pipelineName}
        stageName={stageName}
        visibleActions={visibleActions}
        actionOrder={actionOrder}
        locationId={locationId}
      />
    </div>
  );
});

interface StageColumnProps {
  stage: PipelineStage;
  stageOpps: Opportunity[];
  stageValue: number;
  isCollapsed: boolean;
  isLoading: boolean;
  boardLoading: boolean;
  stageTotal: number;
  stagePage: number;
  pageSize: number;
  paginationPerStage: boolean;
  visibleCardFields: string[];
  cardFieldOrder: string[];
  cardLayout: 'default' | 'compact' | 'unlabeled';
  pipelineName: string;
  visibleActions: string[];
  actionOrder: string[];
  locationId: string;
  isDragTarget: boolean;
  draggedOpp: Opportunity | null;
  onToggleCollapse: (stageId: string) => void;
  onDragOver: (e: React.DragEvent, stageId: string) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, stageId: string, dropIndex: number) => void;
  onPrevPage: (stageId: string) => void;
  onNextPage: (stageId: string) => void;
  onPageChange: (stageId: string, page: number) => void;
  onPageBlur: (stageId: string, value: number) => void;
}

const StageColumn = memo(function StageColumn({
  stage, stageOpps, stageValue, isCollapsed, isLoading, boardLoading, stageTotal,
  stagePage, pageSize, paginationPerStage,
  visibleCardFields, cardFieldOrder, cardLayout, pipelineName, visibleActions, actionOrder, locationId,
  isDragTarget, draggedOpp,
  onToggleCollapse, onDragOver, onDragLeave, onDrop, onPrevPage, onNextPage, onPageChange, onPageBlur,
}: StageColumnProps) {
  const totalPages = Math.ceil(stageTotal / pageSize);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dropIndex, setDropIndex] = useState<number>(0);

  // Reset drop index when no longer a target
  useEffect(() => {
    if (!isDragTarget) setDropIndex(stageOpps.length);
  }, [isDragTarget, stageOpps.length]);

  const handleContainerDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (containerRef.current) {
      // Exclude the ghost placeholder from position calculations to prevent flickering
      const children = Array.from(containerRef.current.children).filter(
        (el) => !(el as HTMLElement).dataset.ghost
      ) as HTMLElement[];
      const mouseY = e.clientY;
      let idx = children.length;
      for (let i = 0; i < children.length; i++) {
        const rect = children[i].getBoundingClientRect();
        if (mouseY < rect.top + rect.height / 2) {
          idx = i;
          break;
        }
      }
      setDropIndex(idx);
    }
    onDragOver(e, stage.id);
  }, [onDragOver, stage.id]);

  // Build card list with ghost spliced in at dropIndex
  const cardItems: React.ReactNode[] = [];
  const total = stageOpps.length;
  for (let i = 0; i <= total; i++) {
    if (isDragTarget && draggedOpp && i === dropIndex) {
      cardItems.push(
        <div key="__ghost__" data-ghost="true" className="pointer-events-none opacity-40 rounded-lg">
          <OpportunityCard
            opportunity={draggedOpp}
            onEdit={() => {}}
            onDelete={() => {}}
            onStatusChange={() => {}}
            visibleFields={visibleCardFields}
            fieldOrder={cardFieldOrder}
            layout={cardLayout}
            pipelineName={pipelineName}
            stageName={stage.name}
            visibleActions={visibleActions}
            actionOrder={actionOrder}
            locationId={locationId}
          />
        </div>
      );
    }
    if (i < total) {
      cardItems.push(
        <CardWrapper
          key={stageOpps[i].ghlId}
          opp={stageOpps[i]}
          visibleCardFields={visibleCardFields}
          cardFieldOrder={cardFieldOrder}
          cardLayout={cardLayout}
          pipelineName={pipelineName}
          stageName={stage.name}
          visibleActions={visibleActions}
          actionOrder={actionOrder}
          locationId={locationId}
        />
      );
    }
  }

  return (
    <div
      className={`flex flex-col ${isCollapsed ? 'w-12' : 'w-72'} shrink-0 transition-all duration-200`}
      onDragOver={handleContainerDragOver}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, stage.id, dropIndex)}
    >
      {/* Stage Header */}
      <div
        className={`bg-white border border-gray-200 cursor-pointer select-none transition-colors hover:bg-gray-50 ${isCollapsed ? 'rounded-lg px-2 py-4' : 'rounded-t-lg border-b-0 px-4 py-3'}`}
        onClick={() => onToggleCollapse(stage.id)}
      >
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-4">
            <ChevronDown className="w-4 h-4 text-gray-600 transition-transform -rotate-90 shrink-0" />
            <h3 className="font-semibold text-gray-900 text-xs whitespace-nowrap origin-center" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
              {stage.name}
            </h3>
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs font-semibold text-gray-900">{stageOpps.length}</span>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 text-sm">{stage.name}</h3>
              <ChevronDown className="w-4 h-4 text-gray-600 transition-transform" />
            </div>
            <p className="text-xs text-gray-600 mt-0.5">
              {stageOpps.length} of {stageTotal || stageOpps.length}{' '}
              <span className="font-medium text-gray-900">
                ${stageValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </p>
          </>
        )}
      </div>

      {/* Stage Cards */}
      {!isCollapsed && (
        <div
          ref={containerRef}
          className="bg-gray-50 border border-gray-200 rounded-b-lg p-2 flex flex-col gap-2 h-[calc(100vh-320px)] overflow-y-auto relative"
        >
          {/* Skeleton loader */}
          {(isLoading || boardLoading) ? (
            <div className="flex flex-col gap-2 h-full animate-pulse">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm space-y-2 shrink-0">
                  <div className="h-3.5 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                  <div className="flex gap-2 pt-1">
                    <div className="h-5 w-16 bg-gray-100 rounded-full" />
                    <div className="h-5 w-12 bg-gray-100 rounded-full" />
                  </div>
                  <div className="h-3 bg-gray-200 rounded w-1/3 mt-1" />
                </div>
              ))}
            </div>
          ) : null}
          {/* Cards + ghost spliced at mouse position */}
          {!isLoading && !boardLoading && cardItems}
          {stageOpps.length === 0 && !isLoading && !boardLoading && !isDragTarget && (
            <div className="text-center py-8 text-gray-500 text-sm">No opportunities</div>
          )}
        </div>
      )}

      {/* Stage Pagination */}
      {!isCollapsed && paginationPerStage && stageTotal > pageSize && (
        <div className="bg-white border-x border-b border-gray-200 rounded-b-lg px-3 py-2 flex items-center justify-center gap-2 text-xs">
          <button
            onClick={() => onPrevPage(stage.id)}
            disabled={stagePage <= 1 || isLoading}
            className="text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <div className="flex items-center gap-1">
            <span className="text-gray-600">Page</span>
            <input
              type="number"
              min="1"
              max={totalPages}
              value={stagePage}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                if (!isNaN(v)) onPageChange(stage.id, v);
              }}
              onBlur={(e) => {
                const v = parseInt(e.target.value);
                onPageBlur(stage.id, v);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const v = parseInt((e.target as HTMLInputElement).value);
                  onPageBlur(stage.id, v);
                  (e.target as HTMLInputElement).blur();
                }
              }}
              disabled={isLoading}
              className="w-12 px-1.5 py-1 text-center text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <span className="text-gray-600">of {totalPages}</span>
          </div>
          <button
            onClick={() => onNextPage(stage.id)}
            disabled={stagePage >= totalPages || isLoading}
            className="text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
});

export default function OpportunityBoard({ locationId }: OpportunityBoardProps) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string; profilePhoto: string }>>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ total: 0, page: 1, limit: 100, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingOpportunity, setEditingOpportunity] = useState<Opportunity | null>(null);
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [draggedOpportunity, setDraggedOpportunity] = useState<Opportunity | null>(null);
  const [showPipelineDropdown, setShowPipelineDropdown] = useState(false);
  const [paginationEnabled, setPaginationEnabled] = useState(false);
  const [pageSize, setPageSize] = useState(100);
  const [paginationPerStage, setPaginationPerStage] = useState(false);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [collapsedStages, setCollapsedStages] = useState<Set<string>>(new Set());
  const [stagePages, setStagePages] = useState<Record<string, number>>({});
  const [stageTotals, setStageTotals] = useState<Record<string, number>>({});
  const [showCustomizePanel, setShowCustomizePanel] = useState(false);
  const [cardLayout, setCardLayout] = useState<'default' | 'compact' | 'unlabeled'>('default');
  const [visibleCardFields, setVisibleCardFields] = useState<string[]>(['smartTags', 'opportunityName', 'businessName', 'contact', 'pipeline', 'stage', 'status']);
  const [cardFieldOrder, setCardFieldOrder] = useState<string[]>(['smartTags', 'opportunityName', 'businessName', 'contact', 'pipeline', 'stage', 'status']);
  const [visibleActions, setVisibleActions] = useState<string[]>(['call', 'sms', 'email', 'appointment', 'tasks', 'notes', 'tags']);
  const [actionOrder, setActionOrder] = useState<string[]>(['call', 'sms', 'email', 'appointment', 'tasks', 'notes', 'tags']);
  
  // Loading states for different operations
  const [stageLoading, setStageLoading] = useState<Record<string, boolean>>({});
  const [creatingOpportunity, setCreatingOpportunity] = useState(false);
  const [updatingOpportunity, setUpdatingOpportunity] = useState(false);
  const [deletingOpportunity, setDeletingOpportunity] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [movingOpportunity, setMovingOpportunity] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [sortLoading, setSortLoading] = useState(false);

  // Use ref to always access latest stagePages without causing re-renders
  const stagePagesRef = useRef<Record<string, number>>({});
  const stageTotalsRef = useRef<Record<string, number>>({});
  useEffect(() => { stageTotalsRef.current = stageTotals; }, [stageTotals]);
  const pageSizeRef = useRef(pageSize);
  useEffect(() => { pageSizeRef.current = pageSize; }, [pageSize]);
  // Refs so memoized callbacks can read latest values without stale closures
  const metaRef = useRef(meta);
  useEffect(() => { metaRef.current = meta; }, [meta]);
  const editingOpportunityRef = useRef<Opportunity | null>(null);
  useEffect(() => { editingOpportunityRef.current = editingOpportunity; }, [editingOpportunity]);

  // Track previous dep values to distinguish sort-only changes from full resets
  const prevDepsRef = useRef<{
    pipelineId: string;
    search: string;
    sortField: string | null;
    sortOrder: string;
    paginationEnabled: boolean;
    paginationPerStage: boolean;
    pageSize: number;
  } | null>(null);
  useEffect(() => {
    stagePagesRef.current = stagePages;
  }, [stagePages]);

  // Load settings from DB
  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch(`/api/location/${locationId}/settings`);
      const data = await res.json();
      console.log('Loaded settings:', data);
      setPaginationEnabled(data.paginationEnabled ?? false);
      setPageSize(data.pageSize ?? 100);
      setPaginationPerStage(data.paginationPerStage ?? false);
      setSortField(data.sortField ?? null);
      setSortOrder(data.sortOrder ?? 'desc');
      setCardLayout(data.cardFieldSettings?.layout ?? 'default');
      setVisibleCardFields(data.cardFieldSettings?.visibleFields ?? ['smartTags', 'opportunityName', 'businessName', 'contact', 'pipeline', 'stage', 'status']);
      setCardFieldOrder(data.cardFieldSettings?.fieldOrder ?? ['smartTags', 'opportunityName', 'businessName', 'contact', 'pipeline', 'stage', 'status']);
      const ALL_ACTIONS = ['call', 'sms', 'email', 'appointment', 'tasks', 'notes', 'tags'];
      const savedVisible: string[] = data.quickActions?.visibleActions ?? ALL_ACTIONS;
      const savedOrder: string[] = data.quickActions?.actionOrder ?? ALL_ACTIONS;
      // Migration: ensure 'tags' is always present for locations saved before tags were added
      if (!savedVisible.includes('tags')) savedVisible.push('tags');
      if (!savedOrder.includes('tags')) savedOrder.push('tags');
      setVisibleActions(savedVisible);
      setActionOrder(savedOrder);
      setSettingsLoaded(true);
    } catch (error) {
      console.error('Error loading settings:', error);
      setSettingsLoaded(true);
    }
  }, [locationId]);

  // Save settings to DB
  const saveSettings = async (
    enabled?: boolean, 
    size?: number, 
    perStage?: boolean, 
    field?: string | null, 
    order?: 'asc' | 'desc',
    cardSettings?: {
      layout: 'default' | 'compact' | 'unlabeled';
      visibleFields: string[];
      fieldOrder: string[];
    },
    qActions?: {
      visibleActions: string[];
      actionOrder: string[];
    }
  ) => {
    try {
      const payload: any = { 
        paginationEnabled: enabled ?? paginationEnabled, 
        pageSize: size ?? pageSize,
        paginationPerStage: perStage ?? paginationPerStage,
        sortField: field !== undefined ? field : sortField,
        sortOrder: order ?? sortOrder,
      };
      if (cardSettings) {
        payload.cardFieldSettings = cardSettings;
      }
      if (qActions) {
        payload.quickActions = qActions;
      }
      console.log('Saving settings:', payload);
      const res = await fetch(`/api/location/${locationId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      console.log('Save result:', result);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  // Fetch pipelines from DB
  const fetchPipelines = useCallback(async () => {
    try {
      const res = await fetch(`/api/location/${locationId}/pipelines`);
      const data = await res.json();
      const pipelinesList = data.pipelines || [];
      setPipelines(pipelinesList);

      if (pipelinesList.length > 0 && !selectedPipelineId) {
        setSelectedPipelineId(pipelinesList[0].ghlId);
      }
    } catch (error) {
      console.error('Error fetching pipelines:', error);
    }
  }, [locationId, selectedPipelineId]);

  // Sync pipelines from GHL
  const syncPipelines = async () => {
    try {
      const res = await fetch(`/api/location/${locationId}/pipelines`, {
        method: 'POST',
      });
      const data = await res.json();
      const pipelinesList = data.pipelines || [];
      setPipelines(pipelinesList);

      if (pipelinesList.length > 0 && !selectedPipelineId) {
        setSelectedPipelineId(pipelinesList[0].ghlId);
      }

      return pipelinesList;
    } catch (error) {
      console.error('Error syncing pipelines:', error);
      return [];
    }
  };

  // Fetch opportunities for a single stage (used for per-stage pagination)
  const fetchSingleStageOpportunities = useCallback(
    async (stageId: string) => {
      if (!selectedPipelineId) return;
      setStageLoading(prev => ({ ...prev, [stageId]: true }));
      try {
        const pipeline = pipelines.find((p) => p.ghlId === selectedPipelineId);
        if (!pipeline) {
          setStageLoading(prev => ({ ...prev, [stageId]: false }));
          return;
        }

        const stage = pipeline.stages.find(s => s.id === stageId);
        if (!stage) {
          setStageLoading(prev => ({ ...prev, [stageId]: false }));
          return;
        }

        const currentPage = stagePagesRef.current[stageId] || 1;
        const params = new URLSearchParams({
          page: currentPage.toString(),
          limit: pageSize.toString(),
          pipelineId: selectedPipelineId,
          pipelineStageId: stageId,
        });
        if (searchQuery) params.set('search', searchQuery);
        if (sortField) {
          params.set('sortField', sortField);
          params.set('sortOrder', sortOrder);
        }

        console.log(`Fetching only ${stage.name} stage - page ${currentPage}`);
        const res = await fetch(`/api/location/${locationId}/opportunities?${params}`);
        const data = await res.json();
        
        console.log(`  - ${stage.name}: Fetched ${data.opportunities?.length || 0} of ${data.meta?.total || 0} total`);
        
        // Update opportunities: remove old data for this stage, add new data
        setOpportunities(prev => [
          ...prev.filter(opp => opp.pipelineStageId !== stageId),
          ...(data.opportunities || [])
        ]);
        
        // Update stage totals
        setStageTotals(prev => ({
          ...prev,
          [stageId]: data.meta?.total || 0
        }));
      } catch (error) {
        console.error('Error fetching stage opportunities:', error);
      } finally {
        setStageLoading(prev => ({ ...prev, [stageId]: false }));
      }
    },
    [locationId, selectedPipelineId, searchQuery, pipelines, sortField, sortOrder, pageSize]
  );

  // Fetch opportunities from DB with pagination
  const fetchOpportunities = useCallback(
    async (page = 1) => {
      if (!selectedPipelineId) return;
      setLoading(true);
      try {
        const pipeline = pipelines.find((p) => p.ghlId === selectedPipelineId);
        if (!pipeline) {
          setLoading(false);
          return;
        }

        if (paginationPerStage) {
          // PER-STAGE PAGINATION: Fetch {pageSize} opportunities FROM EACH stage IN PARALLEL
          // Example: pageSize=20 means 20 from stage A + 20 from stage B + 20 from stage C...
          console.log(`PER-STAGE PAGINATION ON: Fetching ${pageSize} opportunities from EACH stage (${pipeline.stages.length} stages) IN PARALLEL`);
          
          // Create all fetch promises in parallel
          const stagePromises = pipeline.stages.map(async (stage) => {
            const currentPage = stagePagesRef.current[stage.id] || 1;
            const params = new URLSearchParams({
              page: currentPage.toString(),
              limit: pageSize.toString(),
              pipelineId: selectedPipelineId,
              pipelineStageId: stage.id,
            });
            if (searchQuery) params.set('search', searchQuery);
            if (sortField) {
              params.set('sortField', sortField);
              params.set('sortOrder', sortOrder);
            }

            const res = await fetch(`/api/location/${locationId}/opportunities?${params}`);
            const data = await res.json();
            
            return {
              stageId: stage.id,
              stageName: stage.name,
              opportunities: data.opportunities || [],
              total: data.meta?.total || 0,
            };
          });

          // Wait for all stages to finish fetching in parallel
          const stageResults = await Promise.all(stagePromises);
          
          // Combine all results
          const allOpportunities: Opportunity[] = [];
          const newStageTotals: Record<string, number> = {};
          
          stageResults.forEach(result => {
            allOpportunities.push(...result.opportunities);
            newStageTotals[result.stageId] = result.total;
            console.log(`  - ${result.stageName}: Fetched ${result.opportunities.length} of ${result.total} total`);
          });

          console.log(`Total opportunities loaded: ${allOpportunities.length} (${pageSize} per stage × ${pipeline.stages.length} stages) - fetched in parallel`);
          setOpportunities(allOpportunities);
          setStageTotals(newStageTotals);
          setMeta({ 
            total: Object.values(newStageTotals).reduce((sum, val) => sum + val, 0), 
            page: 1, 
            limit: pageSize, 
            totalPages: 1 
          });
        } else {
          // BOARD-LEVEL PAGINATION: Fetch {pageSize} opportunities TOTAL across ALL stages
          // Example: pageSize=20 means 20 total (might be 5 in stage A, 10 in stage B, 5 in stage C)
          // NO pipelineStageId filter - get opportunities from ALL stages
          // Always use pageSize from database settings
          const params = new URLSearchParams({
            page: page.toString(),
            limit: pageSize.toString(), // Using pageSize from database
            pipelineId: selectedPipelineId,
            // NO pipelineStageId parameter - fetching across all stages
          });
          if (searchQuery) params.set('search', searchQuery);
          if (sortField) {
            params.set('sortField', sortField);
            params.set('sortOrder', sortOrder);
          }

          console.log(`PER-STAGE PAGINATION OFF: Fetching ${pageSize} opportunities TOTAL across all stages (page ${page}) - pageSize from DB: ${pageSize}`);
          const res = await fetch(`/api/location/${locationId}/opportunities?${params}`);
          const data = await res.json();
          console.log(`  - Received ${data.opportunities?.length || 0} opportunities (total in DB: ${data.meta?.total || 0}, page ${data.meta?.page} of ${data.meta?.totalPages})`);
          
          setOpportunities(data.opportunities || []);
          
          // Calculate stage totals from the received opportunities
          const newStageTotals: Record<string, number> = {};
          pipeline.stages.forEach(stage => {
            const count = (data.opportunities || []).filter(
              (opp: Opportunity) => opp.pipelineStageId === stage.id
            ).length;
            newStageTotals[stage.id] = count;
            console.log(`  - ${stage.name}: ${count} opportunities on this page`);
          });
          setStageTotals(newStageTotals);
          
          setMeta(data.meta || { total: 0, page: page, limit: pageSize, totalPages: Math.ceil((data.meta?.total || 0) / pageSize) });
        }
      } catch (error) {
        console.error('Error fetching opportunities:', error);
      } finally {
        setLoading(false);
      }
    },
    [locationId, selectedPipelineId, searchQuery, pipelines, sortField, sortOrder, pageSize, paginationPerStage, paginationEnabled]
  );

  // Sync ALL opportunities from GHL
  const syncOpportunities = async () => {
    setSyncing(true);
    setSyncProgress('Syncing pipelines...');
    try {
      // Sync pipelines first
      await syncPipelines();

      setSyncProgress('Syncing opportunities from GHL...');

      const params = new URLSearchParams();
      if (selectedPipelineId) params.set('pipelineId', selectedPipelineId);

      const res = await fetch(
        `/api/location/${locationId}/opportunities/sync?${params}`,
        { method: 'POST' }
      );
      const data = await res.json();

      setSyncProgress(
        `Synced ${data.synced || 0} of ${data.total || 0} opportunities`
      );

      // Reload from DB
      await fetchOpportunities(1);

      setTimeout(() => setSyncProgress(''), 3000);
    } catch (error) {
      console.error('Error syncing:', error);
      setSyncProgress('Sync failed!');
      setTimeout(() => setSyncProgress(''), 3000);
    } finally {
      setSyncing(false);
    }
  };

  // Create opportunity
  const handleCreateOpportunity = useCallback(async (data: Record<string, unknown>) => {
    setCreatingOpportunity(true);
    try {
      const res = await fetch(`/api/location/${locationId}/opportunities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create opportunity');
      }
      await fetchOpportunities(metaRef.current.page);
    } finally {
      setCreatingOpportunity(false);
    }
  }, [locationId, fetchOpportunities]);

  // Update opportunity
  const handleUpdateOpportunity = useCallback(async (data: Record<string, unknown>) => {
    setUpdatingOpportunity(true);
    try {
      const opp = editingOpportunityRef.current;
      if (!opp) return;
      const res = await fetch(
        `/api/location/${locationId}/opportunities/${opp.ghlId}`,
        { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }
      );
      if (!res.ok) throw new Error('Failed to update opportunity');
      const resData = await res.json();
      const updated = resData.opportunity as Opportunity;
      setEditingOpportunity(null);
      // Update only the changed opportunity in state instead of refetching all
      if (updated) {
        setOpportunities(prev => {
          const oldOpp = prev.find(o => o.ghlId === opp.ghlId);
          // If pipeline changed, remove from current view (it belongs to a different pipeline now)
          if (oldOpp && updated.pipelineId !== oldOpp.pipelineId) {
            setStageTotals(prevTotals => ({
              ...prevTotals,
              [oldOpp.pipelineStageId]: Math.max(0, (prevTotals[oldOpp.pipelineStageId] || 1) - 1),
            }));
            setMeta(prevMeta => ({ ...prevMeta, total: Math.max(0, prevMeta.total - 1) }));
            return prev.filter(o => o.ghlId !== opp.ghlId);
          }
          const stageChanged = oldOpp && oldOpp.pipelineStageId !== updated.pipelineStageId;
          const newList = prev.map(o => o.ghlId === opp.ghlId ? { ...o, ...updated } : o);
          // Update stage totals if the stage changed
          if (stageChanged && oldOpp) {
            setStageTotals(prevTotals => ({
              ...prevTotals,
              [oldOpp.pipelineStageId]: Math.max(0, (prevTotals[oldOpp.pipelineStageId] || 1) - 1),
              [updated.pipelineStageId]: (prevTotals[updated.pipelineStageId] || 0) + 1,
            }));
          }
          return newList;
        });
      }
    } finally {
      setUpdatingOpportunity(false);
    }
  }, [locationId]);

  // Delete opportunity
  const handleDeleteOpportunity = useCallback(async (ghlId: string) => {
    if (!confirm('Are you sure you want to delete this opportunity?')) return;
    setDeletingOpportunity(ghlId);
    try {
      const res = await fetch(
        `/api/location/${locationId}/opportunities/${ghlId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error('Failed to delete opportunity');
      // Remove the deleted opportunity from state instead of refetching all
      setOpportunities(prev => {
        const deleted = prev.find(o => o.ghlId === ghlId);
        if (deleted) {
          setStageTotals(prevTotals => ({
            ...prevTotals,
            [deleted.pipelineStageId]: Math.max(0, (prevTotals[deleted.pipelineStageId] || 1) - 1),
          }));
          setMeta(prevMeta => ({ ...prevMeta, total: Math.max(0, prevMeta.total - 1) }));
        }
        return prev.filter(o => o.ghlId !== ghlId);
      });
    } catch (error) {
      console.error('Error deleting opportunity:', error);
    } finally {
      setDeletingOpportunity(null);
    }
  }, [locationId]);

  // Update opportunity status
  const handleStatusChange = useCallback(async (ghlId: string, status: string) => {
    setUpdatingStatus(ghlId);
    try {
      const res = await fetch(
        `/api/location/${locationId}/opportunities/${ghlId}/status`,
        { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }
      );
      if (!res.ok) throw new Error('Failed to update status');
      const resData = await res.json();
      const updated = resData.opportunity as Opportunity;
      // Update only the changed opportunity in state instead of refetching all
      if (updated) {
        setOpportunities(prev => prev.map(o => o.ghlId === ghlId ? { ...o, ...updated } : o));
      }
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setUpdatingStatus(null);
    }
  }, [locationId]);

  // Move opportunity to different stage (drag & drop)
  const handleMoveOpportunity = useCallback(async (ghlId: string, newStageId: string, insertIndex: number) => {
    // Optimistic update — remove from current position, splice into target stage at insertIndex
    let previousStageId: string | null = null;
    let previousIndex: number = -1;
    setOpportunities(prev => {
      const draggedIdx = prev.findIndex(o => o.ghlId === ghlId);
      if (draggedIdx === -1) return prev;
      const dragged = prev[draggedIdx];
      previousStageId = dragged.pipelineStageId;
      previousIndex = draggedIdx;

      // Remove from current position
      const rest = prev.filter(o => o.ghlId !== ghlId);

      // Find cards in target stage within the remaining flat array
      const targetCards = rest.filter(o => o.pipelineStageId === newStageId);

      // Determine insertion point in the flat array
      let insertAt: number;
      if (insertIndex >= targetCards.length) {
        // After the last card in the target stage
        const last = targetCards[targetCards.length - 1];
        insertAt = last ? rest.indexOf(last) + 1 : rest.length;
      } else {
        insertAt = rest.indexOf(targetCards[insertIndex]);
      }

      const updated = { ...dragged, pipelineStageId: newStageId };
      return [...rest.slice(0, insertAt), updated, ...rest.slice(insertAt)];
    });
    // Optimistically adjust stage totals
    if (previousStageId) {
      setStageTotals(prev => ({
        ...prev,
        [previousStageId!]: Math.max(0, (prev[previousStageId!] ?? 1) - 1),
        [newStageId]: (prev[newStageId] ?? 0) + 1,
      }));
    }
    setMovingOpportunity(ghlId);
    try {
      const res = await fetch(
        `/api/location/${locationId}/opportunities/${ghlId}`,
        { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pipelineStageId: newStageId }) }
      );
      if (!res.ok) throw new Error('Failed to move opportunity');
      const data = await res.json();
      // Patch just this one card in state with the server-confirmed data
      if (data.opportunity) {
        setOpportunities(prev => prev.map(o =>
          o.ghlId === ghlId ? { ...o, ...data.opportunity } : o
        ));
      }
    } catch (error) {
      console.error('Error moving opportunity:', error);
      // Revert optimistic update on failure
      if (previousStageId && previousIndex !== -1) {
        setOpportunities(prev => {
          const rest = prev.filter(o => o.ghlId !== ghlId);
          const at = Math.min(previousIndex, rest.length);
          const original = prev.find(o => o.ghlId === ghlId);
          if (!original) return prev;
          return [...rest.slice(0, at), { ...original, pipelineStageId: previousStageId! }, ...rest.slice(at)];
        });
        setStageTotals(prev => ({
          ...prev,
          [previousStageId!]: (prev[previousStageId!] ?? 0) + 1,
          [newStageId]: Math.max(0, (prev[newStageId] ?? 1) - 1),
        }));
      }
    } finally {
      setMovingOpportunity(null);
    }
  }, [locationId]);

  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);

  // Drag and drop handlers
  const handleDragStart = useCallback((opp: Opportunity) => {
    setDraggedOpportunity(opp);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    setDragOverStageId(stageId);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if leaving the column entirely (not just entering a child element)
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setDragOverStageId(null);
    }
  }, []);

  const handleToggleCollapse = useCallback((stageId: string) => {
    setCollapsedStages((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(stageId)) newSet.delete(stageId);
      else newSet.add(stageId);
      return newSet;
    });
  }, []);

  const handlePrevPage = useCallback((stageId: string) => {
    const cur = stagePagesRef.current[stageId] || 1;
    if (cur <= 1) return;
    const newPage = cur - 1;
    stagePagesRef.current = { ...stagePagesRef.current, [stageId]: newPage };
    setStagePages(prev => ({ ...prev, [stageId]: newPage }));
    fetchSingleStageOpportunities(stageId);
  }, [fetchSingleStageOpportunities]);

  const handleNextPage = useCallback((stageId: string) => {
    const cur = stagePagesRef.current[stageId] || 1;
    const total = Math.ceil((stageTotalsRef.current[stageId] || 0) / pageSizeRef.current);
    if (cur >= total) return;
    const newPage = cur + 1;
    stagePagesRef.current = { ...stagePagesRef.current, [stageId]: newPage };
    setStagePages(prev => ({ ...prev, [stageId]: newPage }));
    fetchSingleStageOpportunities(stageId);
  }, [fetchSingleStageOpportunities]);

  const handlePageChange = useCallback((stageId: string, page: number) => {
    setStagePages(prev => ({ ...prev, [stageId]: page }));
  }, []);

  const handlePageBlur = useCallback((stageId: string, value: number) => {
    const total = Math.ceil((stageTotalsRef.current[stageId] || 0) / pageSizeRef.current);
    const valid = Math.max(1, Math.min(value || 1, total));
    stagePagesRef.current = { ...stagePagesRef.current, [stageId]: valid };
    setStagePages(prev => ({ ...prev, [stageId]: valid }));
    fetchSingleStageOpportunities(stageId);
  }, [fetchSingleStageOpportunities]);

  const handleEditOpportunity = useCallback((opp: Opportunity) => {
    setEditingOpportunity(opp);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, stageId: string, dropIndex: number) => {
    e.preventDefault();
    setDragOverStageId(null);
    if (draggedOpportunity && draggedOpportunity.pipelineStageId !== stageId) {
      await handleMoveOpportunity(draggedOpportunity.ghlId, stageId, dropIndex);
    }
    setDraggedOpportunity(null);
  }, [draggedOpportunity, handleMoveOpportunity]);

  // Fetch users for this location
  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`/api/location/${locationId}/users`);
      if (!res.ok) return;
      const data = await res.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  }, [locationId]);

  // Initial load - Load settings first
  useEffect(() => {
    const init = async () => {
      await loadSettings();
      await Promise.all([fetchPipelines(), fetchUsers()]);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When pipeline changes or settings loaded, reload opportunities
  useEffect(() => {
    if (selectedPipelineId && settingsLoaded) {
      setSearchLoading(false);
      setSortLoading(false);

      // Only search when query is empty (reset) or has minimum 3 characters
      if (searchQuery.length > 0 && searchQuery.length < MIN_SEARCH_CHARS) return;

      const prev = prevDepsRef.current;
      const onlySortChanged = prev !== null &&
        prev.pipelineId === selectedPipelineId &&
        prev.search === searchQuery &&
        prev.paginationEnabled === paginationEnabled &&
        prev.paginationPerStage === paginationPerStage &&
        prev.pageSize === pageSize &&
        (prev.sortField !== sortField || prev.sortOrder !== sortOrder);

      prevDepsRef.current = { pipelineId: selectedPipelineId, search: searchQuery, sortField, sortOrder, paginationEnabled, paginationPerStage, pageSize };

      // Stay on current page when only sort changed, otherwise reset to page 1
      fetchOpportunities(onlySortChanged ? meta.page : 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPipelineId, settingsLoaded, searchQuery, sortField, sortOrder, paginationEnabled, paginationPerStage, pageSize]);

  const MIN_SEARCH_CHARS = 3;

  const currentPipeline = useMemo(
    () => pipelines.find((p) => p.ghlId === selectedPipelineId),
    [pipelines, selectedPipelineId]
  );

  // Group opportunities by stage — memoized so 500 filters don't run on every render
  const opportunitiesByStage = useMemo<Record<string, Opportunity[]>>(() => {
    const map: Record<string, Opportunity[]> = {};
    if (currentPipeline) {
      for (const stage of currentPipeline.stages) {
        map[stage.id] = [];
      }
      for (const opp of opportunities) {
        if (map[opp.pipelineStageId] !== undefined) {
          map[opp.pipelineStageId].push(opp);
        }
      }
    }
    return map;
  }, [opportunities, currentPipeline]);

  // Memoize context value — only recreates when an operation state actually changes
  const operationCtxValue = useMemo<OperationState>(() => ({
    draggedId: draggedOpportunity?.ghlId ?? null,
    movingId: movingOpportunity,
    deletingId: deletingOpportunity,
    updatingId: updatingStatus,
    onDragStart: handleDragStart,
    onEdit: handleEditOpportunity,
    onDelete: handleDeleteOpportunity,
    onStatusChange: handleStatusChange,
  }), [draggedOpportunity, movingOpportunity, deletingOpportunity, updatingStatus,
      handleDragStart, handleEditOpportunity, handleDeleteOpportunity, handleStatusChange]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 pt-4">
          {/* Top tabs */}
          <div className="flex items-center gap-2 mb-0">
            <div className="flex items-center border border-gray-300 border-2 rounded-lg px-5 py-2 bg-white relative" style={{marginBottom: '-1px', zIndex: 1}}>
              <span className="text-xl font-semibold text-gray-900">Opportunities</span>
            </div>
          </div>

          {/* Pipeline selector + counts + actions */}
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              {/* Pipeline Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowPipelineDropdown(!showPipelineDropdown)}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm text-gray-900"
                >
                  {currentPipeline?.name || 'Select Pipeline'}
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>
                {showPipelineDropdown && (
                  <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-50">
                    {pipelines.map((p) => (
                      <button
                        key={p.ghlId}
                        onClick={() => {
                          setSelectedPipelineId(p.ghlId);
                          setShowPipelineDropdown(false);
                        }}
                        className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                          p.ghlId === selectedPipelineId ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-900'
                        }`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Total count badge */}
              <span className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                {meta.total} opportunities
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* View mode toggles */}
              <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('board')}
                  className={`p-2 ${viewMode === 'board' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              {/* Sync */}
              <button
                onClick={syncOpportunities}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm text-gray-900 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync'}
              </button>

              {/* Add opportunity button */}
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Add opportunity
              </button>

              <div className="relative">
                <button 
                  onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                {showSettingsDropdown && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-64 py-2">
                    {/* Pagination Toggle */}
                    <div className="px-4 py-2 border-b border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-900">Pagination</span>
                        <button
                          onClick={async () => {
                            const newEnabled = !paginationEnabled;
                            setPaginationEnabled(newEnabled);
                            await saveSettings(newEnabled);
                            fetchOpportunities(1);
                          }}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            paginationEnabled ? 'bg-blue-600' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              paginationEnabled ? 'translate-x-5' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                      
                      {/* Page Size Input - Only show when pagination is ON */}
                      {paginationEnabled && (
                        <>
                          <div className="mt-2">
                            <label className="text-xs text-gray-600 block mb-1 font-medium">Records per page</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="10"
                                max="1000"
                                value={pageSize}
                                onChange={async (e) => {
                                  const newSize = parseInt(e.target.value) || 100;
                                  setPageSize(newSize);
                                }}
                                onBlur={async () => {
                                  await saveSettings(undefined, pageSize);
                                  fetchOpportunities(1);
                                }}
                                className="w-full px-3 py-1.5 text-sm text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                              />
                              <span className="text-xs text-gray-500">10-1000</span>
                            </div>
                          </div>
                          
                          {/* Per Stage Toggle */}
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-sm text-gray-900 block font-medium">Per Stage</span>
                                <span className="text-xs text-gray-600">Apply limit to each stage</span>
                              </div>
                              <button
                                onClick={async () => {
                                  const newPerStage = !paginationPerStage;
                                  console.log('Toggling Per Stage from', paginationPerStage, 'to', newPerStage);
                                  setPaginationPerStage(newPerStage);
                                  // Reset stagePages when toggling off per-stage pagination
                                  if (!newPerStage) {
                                    setStagePages({});
                                  }
                                  await saveSettings(undefined, undefined, newPerStage);
                                }}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                  paginationPerStage ? 'bg-blue-600' : 'bg-gray-300'
                                }`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    paginationPerStage ? 'translate-x-5' : 'translate-x-1'
                                  }`}
                                />
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    
                    <button
                      onClick={() => setShowSettingsDropdown(false)}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 font-medium"
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-end">
          <div className="flex items-center gap-3">

            {/* Sort */}
            <div className="relative">
              <button 
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg ${
                  sortField ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
                }`}
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                Sort{sortField ? ' (1)' : ''}
              </button>
              {showSortDropdown && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 w-60 max-h-96 overflow-y-auto">
                  <div className="py-1">
                    <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                      <div className="text-xs font-semibold text-gray-500 uppercase">Sort By Select Field</div>
                      {sortField && (
                        <button
                          onClick={async () => {
                            setSortField(null);
                            setSortOrder('desc');
                            setShowSortDropdown(false);
                            await saveSettings(undefined, undefined, undefined, null, 'desc');
                          }}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    
                    {[
                      { value: 'updatedOn', label: 'Updated On' },
                      { value: 'createdOn', label: 'Created On' },
                      { value: 'lastStageChangeDate', label: 'Last Stage Change Date' },
                      { value: 'lastStatusChangeDate', label: 'Last Status Change Date' },
                      { value: 'opportunityName', label: 'Opportunity Name' },
                      { value: 'stage', label: 'Stage' },
                      { value: 'status', label: 'Status' },
                      { value: 'opportunitySource', label: 'Opportunity Source' },
                      { value: 'opportunityValue', label: 'Opportunity Value' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={async () => {
                          const newOrder = sortField === option.value && sortOrder === 'asc' ? 'desc' : 'asc';
                          setSortField(option.value);
                          setSortOrder(newOrder);
                          setShowSortDropdown(false);
                          await saveSettings(undefined, undefined, undefined, option.value, newOrder);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center justify-between ${
                          sortField === option.value ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                        }`}
                      >
                        <span>{option.label}</span>
                        {sortField === option.value && (
                          <span className="text-xs text-blue-600">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Search */}
            <div className="relative">
              {/* Tooltip: shown when 1 or 2 chars typed */}
              {searchQuery.length > 0 && searchQuery.length < MIN_SEARCH_CHARS && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
                  <div className="bg-gray-900 text-white text-xs font-medium px-3 py-1.5 rounded-md whitespace-nowrap shadow-lg">
                    Enter {MIN_SEARCH_CHARS - searchQuery.length} more character{MIN_SEARCH_CHARS - searchQuery.length !== 1 ? 's' : ''}
                  </div>
                  {/* Caret */}
                  <div className="flex justify-center">
                    <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900" />
                  </div>
                </div>
              )}

              {searchLoading && (
                <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10">
                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                </div>
              )}
              <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 transition-opacity ${
                searchLoading ? 'opacity-0' : 'opacity-100'
              }`} />
              <input
                type="text"
                placeholder="Search opportunities…"
                value={searchQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchQuery(val);
                  if (val === '' || val.length >= MIN_SEARCH_CHARS) {
                    setSearchLoading(true);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (searchQuery === '' || searchQuery.length >= MIN_SEARCH_CHARS)) {
                    setSearchLoading(true);
                    fetchOpportunities(1);
                  }
                }}
                className="pl-9 pr-4 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-56"
              />
            </div>

            {/* Manage Fields */}
            <button 
              onClick={() => setShowCustomizePanel(true)}
              className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-gray-900"
            >
              {sortLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Settings className="w-3.5 h-3.5" />
              )}
              Manage Fields
            </button>
          </div>
        </div>
      </div>

      {/* Sync Progress Banner */}
      {syncProgress && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-2 text-sm text-blue-700 flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncProgress}
        </div>
      )}

      {/* Kanban Board */}
      {viewMode === 'board' ? (
        <OperationContext.Provider value={operationCtxValue}>
        <div className="p-6 overflow-x-auto kanban-scroll">
          {!currentPipeline ? (
            <div className="text-center py-20">
              <p className="text-gray-500">
                No pipelines found. Click &quot;Import&quot; to sync from GoHighLevel.
              </p>
            </div>
          ) : (
            <>
              <div className="flex gap-4">
                {currentPipeline.stages
                .sort((a, b) => a.position - b.position)
                .map((stage) => {
                  const rawStageOpps = opportunitiesByStage[stage.id] || [];
                  const stageOpps = paginationPerStage
                    ? rawStageOpps.slice(0, pageSize * (stagePages[stage.id] || 1))
                    : rawStageOpps;
                  const stageValue = stageOpps.reduce((sum, opp) => sum + (opp.monetaryValue || 0), 0);
                  return (
                    <StageColumn
                      key={stage.id}
                      stage={stage}
                      stageOpps={stageOpps}
                      stageValue={stageValue}
                      isCollapsed={collapsedStages.has(stage.id)}
                      isLoading={!!stageLoading[stage.id]}
                      boardLoading={loading}
                      stageTotal={stageTotals[stage.id] || 0}
                      stagePage={stagePages[stage.id] || 1}
                      pageSize={pageSize}
                      paginationPerStage={paginationPerStage}
                      visibleCardFields={visibleCardFields}
                      cardFieldOrder={cardFieldOrder}
                      cardLayout={cardLayout}
                      pipelineName={currentPipeline.name}
                      visibleActions={visibleActions}
                      actionOrder={actionOrder}
                      locationId={locationId}
                      isDragTarget={dragOverStageId === stage.id && draggedOpportunity?.pipelineStageId !== stage.id}
                      draggedOpp={draggedOpportunity}
                      onToggleCollapse={handleToggleCollapse}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onPrevPage={handlePrevPage}
                      onNextPage={handleNextPage}
                      onPageChange={handlePageChange}
                      onPageBlur={handlePageBlur}
                    />
                  );
                })}
              </div>

              {/* Board-level pagination (when per-stage is OFF) */}
              {paginationEnabled && !paginationPerStage && meta.totalPages > 1 && (
                <div className="border-t border-gray-200 bg-white px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-700">
                      Showing page {meta.page} of {meta.totalPages} ({meta.total} total opportunities)
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setLoading(true);
                          fetchOpportunities(meta.page - 1);
                        }}
                        disabled={meta.page <= 1 || loading}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 flex items-center gap-1"
                      >
                        {loading && meta.page > 1 ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ChevronLeft className="w-4 h-4" />
                        )}
                      </button>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Page</span>
                        <input
                          type="number"
                          min="1"
                          max={meta.totalPages}
                          value={meta.page}
                          onChange={(e) => {
                            const value = parseInt(e.target.value);
                            if (!isNaN(value)) {
                              const validPage = Math.max(1, Math.min(value, meta.totalPages));
                              setLoading(true);
                              fetchOpportunities(validPage);
                            }
                          }}
                          disabled={loading}
                          className="w-20 px-2 py-1.5 text-center text-sm text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:opacity-50"
                        />
                        <span className="text-sm text-gray-600">of {meta.totalPages}</span>
                      </div>
                      <button
                        onClick={() => {
                          setLoading(true);
                          fetchOpportunities(meta.page + 1);
                        }}
                        disabled={meta.page >= meta.totalPages || loading}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 flex items-center gap-1"
                      >
                        {loading && meta.page < meta.totalPages ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        </OperationContext.Provider>
      ) : (
        <div className="p-6">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Contact</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Tags</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Stage</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Value</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Source</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {/* Skeleton rows while loading */}
                {loading && Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="animate-pulse">
                    <td className="px-4 py-3"><div className="h-3 bg-gray-200 rounded w-32" /></td>
                    <td className="px-4 py-3"><div className="h-3 bg-gray-200 rounded w-24" /></td>
                    <td className="px-4 py-3"><div className="h-3 bg-gray-100 rounded w-16" /></td>
                    <td className="px-4 py-3"><div className="h-3 bg-gray-200 rounded w-20" /></td>
                    <td className="px-4 py-3"><div className="h-3 bg-gray-200 rounded w-14" /></td>
                    <td className="px-4 py-3"><div className="h-5 bg-gray-100 rounded-full w-16" /></td>
                    <td className="px-4 py-3"><div className="h-3 bg-gray-100 rounded w-14" /></td>
                    <td className="px-4 py-3 text-right"><div className="h-5 w-5 bg-gray-200 rounded ml-auto" /></td>
                  </tr>
                ))}
                {!loading && opportunities.map((opp) => {
                  const stageName =
                    currentPipeline?.stages.find((s) => s.id === opp.pipelineStageId)?.name || '-';
                  return (
                    <tr key={opp.ghlId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{opp.name}</td>
                      <td className="px-4 py-3 text-gray-600">{opp.contact?.name || '-'}</td>
                      <td className="px-4 py-3">
                        {opp.contact?.tags && opp.contact.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {opp.contact.tags.slice(0, 2).map((tag, index) => (
                              <span
                                key={index}
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                                title={tag}
                              >
                                {tag.length > 15 ? tag.substring(0, 15) + '...' : tag}
                              </span>
                            ))}
                            {opp.contact.tags.length > 2 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                +{opp.contact.tags.length - 2}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{stageName}</td>
                      <td className="px-4 py-3 text-gray-900">
                        ${(opp.monetaryValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                            opp.status === 'won'
                              ? 'bg-green-100 text-green-700'
                              : opp.status === 'lost'
                              ? 'bg-red-100 text-red-700'
                              : opp.status === 'abandoned'
                              ? 'bg-gray-100 text-gray-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {opp.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{opp.source || '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setEditingOpportunity(opp)}
                          className="text-blue-600 hover:text-blue-800 text-xs mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteOpportunity(opp.ghlId)}
                          className="text-red-600 hover:text-red-800 text-xs"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {opportunities.length === 0 && !loading && (
              <div className="text-center py-12 text-gray-400">
                No opportunities found. Click &quot;Import&quot; to sync from GoHighLevel.
              </div>
            )}
          </div>

          {/* Pagination */}
          {paginationEnabled && !paginationPerStage && meta.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                Showing {(meta.page - 1) * meta.limit + 1}–
                {Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  disabled={meta.page <= 1}
                  onClick={() => fetchOpportunities(meta.page - 1)}
                  className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-600">
                  Page {meta.page} of {meta.totalPages}
                </span>
                <button
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => fetchOpportunities(meta.page + 1)}
                  className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Form */}
      <OpportunityForm
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={handleCreateOpportunity}
        mode="create"
        pipelines={pipelines}
        currentPipelineId={selectedPipelineId}
        locationId={locationId}
        isSubmitting={creatingOpportunity}
        users={users}
        allTags={Array.from(new Set(opportunities.flatMap(o => o.contact?.tags || [])))}
      />

      {/* Edit Form */}
      {editingOpportunity && (
        <OpportunityForm
          isOpen={!!editingOpportunity}
          onClose={() => setEditingOpportunity(null)}
          onSubmit={handleUpdateOpportunity}
          initialData={editingOpportunity as unknown as Record<string, unknown>}
          mode="edit"
          pipelines={pipelines}
          currentPipelineId={selectedPipelineId}
          locationId={locationId}
          isSubmitting={updatingOpportunity}
          users={users}
          allTags={Array.from(new Set(opportunities.flatMap(o => o.contact?.tags || [])))}
          onDelete={() => {
            handleDeleteOpportunity(editingOpportunity.ghlId);
            setEditingOpportunity(null);
          }}
        />
      )}

      {/* Customize Card Panel */}
      <CustomizeCardPanel
        isOpen={showCustomizePanel}
        onClose={() => setShowCustomizePanel(false)}
        layout={cardLayout}
        visibleFields={visibleCardFields}
        fieldOrder={cardFieldOrder}
        visibleActions={visibleActions}
        actionOrder={actionOrder}
        onSave={(layout, visibleFields, fieldOrder, newVisibleActions, newActionOrder) => {
          setCardLayout(layout);
          setVisibleCardFields(visibleFields);
          setCardFieldOrder(fieldOrder);
          setVisibleActions(newVisibleActions);
          setActionOrder(newActionOrder);
          saveSettings(undefined, undefined, undefined, undefined, undefined, {
            layout,
            visibleFields,
            fieldOrder,
          }, {
            visibleActions: newVisibleActions,
            actionOrder: newActionOrder,
          });
        }}
      />
    </div>
  );
}
