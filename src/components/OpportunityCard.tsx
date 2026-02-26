'use client';

import { memo, useState, useRef, useCallback, useEffect } from 'react';
import { Phone, Mail, MessageSquare, Calendar, Trash2, CheckSquare, FileText, Tag, User } from 'lucide-react';

interface OpportunityCardProps {
  opportunity: {
    _id: string;
    ghlId: string;
    name: string;
    monetaryValue: number;
    status: string;
    source: string;
    contactId?: string;
    contact?: {
      id?: string;
      name?: string;
      companyName?: string;
      email?: string;
      phone?: string;
      tags?: string[];
      followers?: string[];
    };
    pipelineStageId: string;
    assignedTo?: string;
    ghlCreatedAt?: string;
    ghlUpdatedAt?: string;
    lastStatusChangeAt?: string;
    lastStageChangeAt?: string;
    customFields?: Array<{ id: string; key: string; field_value: string | string[] | Record<string, unknown> }>;
  };
  onEdit: (opportunity: OpportunityCardProps['opportunity']) => void;
  onDelete: (ghlId: string) => void;
  onStatusChange: (ghlId: string, status: string) => void;
  visibleFields?: string[];
  fieldOrder?: string[];
  layout?: 'default' | 'compact' | 'unlabeled';
  pipelineName?: string;
  stageName?: string;
  visibleActions?: string[];
  actionOrder?: string[];
  actionCounts?: Partial<Record<'call' | 'sms' | 'email' | 'appointment' | 'tasks' | 'notes' | 'tags', number>>;
  locationId?: string;
}

// Derive 1-2 letter initials from a name string
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// Consistent colour for a given string
const AVATAR_COLOURS = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
];
function avatarColour(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLOURS[Math.abs(hash) % AVATAR_COLOURS.length];
}

// Badge overlay: shows a count bubble on top-right of an icon button
function BadgeIcon({ icon, count, label, onClick, rawLabel }: {
  icon: React.ReactNode;
  count?: number;
  label: string;       // shown as-is in tooltip (pass tag names here for tags)
  rawLabel?: string;   // if set, tooltip = rawLabel (count); else tooltip = label (count)
  onClick?: (e: React.MouseEvent) => void;
}) {
  const title = rawLabel
    ? (count ? `${rawLabel} (${count})` : rawLabel)
    : label;
  return (
    <button
      className="relative w-6 h-6 inline-flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors shrink-0"
      title={title}
      onClick={onClick ?? ((e) => e.stopPropagation())}
    >
      {icon}
      {!!count && count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-3.5 h-3.5 px-0.5 flex items-center justify-center rounded-full bg-blue-600 text-white text-[8px] font-bold leading-none">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}

function TagsPopover({ tags, icon, count }: { tags: string[]; icon: React.ReactNode; count?: number }) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  return (
    <div
      ref={triggerRef}
      onMouseEnter={() => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        setPos({ top: rect.top, left: rect.left + rect.width / 2 });
      }}
      onMouseLeave={() => setPos(null)}
    >
      <BadgeIcon icon={icon} count={count} label={`Tags (${tags.length})`} />
      {pos && (
        <div
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            transform: 'translateX(-50%) translateY(-100%) translateY(-8px)',
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        >
          <div className="bg-gray-900 text-white rounded-lg shadow-xl py-1.5 px-0.5 min-w-[120px] max-w-[200px]">
            {tags.map((tag, i) => (
              <div key={i} className="px-3 py-1 text-xs whitespace-nowrap truncate">{tag}</div>
            ))}
          </div>
          <div className="w-2 h-2 bg-gray-900 rotate-45 mx-auto -mt-1" />
        </div>
      )}
    </div>
  );
}

const OpportunityCard = memo(function OpportunityCard({
  opportunity,
  onEdit,
  onDelete,
  onStatusChange,
  visibleFields = ['smartTags', 'opportunityName', 'contact', 'opportunityValue', 'status'],
  fieldOrder = ['smartTags', 'opportunityName', 'businessName', 'contact', 'pipeline', 'stage', 'status'],
  layout = 'default',
  pipelineName = '',
  stageName = '',
  visibleActions = ['call', 'sms', 'email', 'appointment', 'tasks', 'notes', 'tags'],
  actionOrder = ['call', 'sms', 'email', 'appointment', 'tasks', 'notes', 'tags'],
  actionCounts = {},
  locationId,
}: OpportunityCardProps) {
  // Detect GHL base URL dynamically from parent frame or referrer
  const ghlBaseUrl = (() => {
    try {
      if (typeof window !== 'undefined') {
        // Try ancestor origin (works when embedded in iframe)
        if (window.location.ancestorOrigins && window.location.ancestorOrigins.length > 0) {
          return window.location.ancestorOrigins[0];
        }
        // Fallback: parse document.referrer
        if (document.referrer) {
          const url = new URL(document.referrer);
          return url.origin;
        }
      }
    } catch { /* ignore */ }
    return 'https://app.gohighlevel.com';
  })();

  const ACTION_CONFIG: Record<string, { label: string; icon: React.ReactNode; onClick?: (e: React.MouseEvent) => void }> = {
    call: {
      label: opportunity.contact?.phone ? `Call ${opportunity.contact.phone}` : 'Call',
      icon: <Phone className="w-3.5 h-3.5" />,
      onClick: opportunity.contact?.phone
        ? (e) => { e.stopPropagation(); window.open(`tel:${opportunity.contact!.phone}`); }
        : undefined,
    },
    sms: {
      label: 'Message',
      icon: <MessageSquare className="w-3.5 h-3.5" />,
      onClick: (e) => {
        e.stopPropagation();
        const contactId = opportunity.contact?.id || opportunity.contactId;
        if (contactId && locationId) {
          const url = `${ghlBaseUrl}/v2/location/${locationId}/contacts/detail/${contactId}`;
          if (window.top) {
            window.top.location.href = url;
          } else {
            window.parent.location.href = url;
          }
        }
      },
    },
    email: {
      label: opportunity.contact?.email ? `Email ${opportunity.contact.email}` : 'Email',
      icon: <Mail className="w-3.5 h-3.5" />,
      onClick: opportunity.contact?.email
        ? (e) => { e.stopPropagation(); window.open(`mailto:${opportunity.contact!.email}`); }
        : undefined,
    },
    appointment: {
      label: 'Appointment',
      icon: <Calendar className="w-3.5 h-3.5" />,
    },
    tasks: {
      label: 'Tasks',
      icon: <CheckSquare className="w-3.5 h-3.5" />,
    },
    notes: {
      label: 'Notes',
      icon: <FileText className="w-3.5 h-3.5" />,
    },
    tags: {
      label: 'Tags',
      icon: <Tag className="w-3.5 h-3.5" />,
    },
  };
  const isFieldVisible = (fieldId: string) => visibleFields.includes(fieldId);

  // Helper functions for date calculations
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Invalid Date';
    }
  };

  const calculateDays = (dateStr: string) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffTime = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    } catch {
      return null;
    }
  };

  const getCustomFieldValue = (key: string) => {
    if (!opportunity.customFields) return null;
    const field = opportunity.customFields.find(f => f.key === key);
    if (!field) return null;
    const value = field.field_value;
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  // Field rendering function
  const renderField = (fieldId: string) => {
    if (!isFieldVisible(fieldId)) return null;

    const labelClass = layout !== 'unlabeled' ? 'text-gray-500' : 'sr-only';
    const spacing = 'py-0.5';

    // ── Compact: render as inline value chip (only used in hover detail) ──────
    if (layout === 'compact') {
      // Compact fields are rendered inline via renderCompactCard; skip normal rendering
      return null;
    }

    // ── Default / Unlabeled: stacked label:value rows ─────────────────────────
    switch (fieldId) {
      case 'smartTags':
        return null;

      case 'opportunityName':
        if (!opportunity.name) return null;
        return (
          <div key={fieldId} className={`flex items-center justify-between text-xs ${spacing}`}>
            <span className={labelClass}>Opportunity Name:</span>
            <span className="text-gray-900 font-medium truncate ml-2">{opportunity.name}</span>
          </div>
        );

      case 'contact':
        if (!opportunity.contact?.name) return null;
        return (
          <div key={fieldId} className={`flex items-center justify-between text-xs ${spacing}`}>
            <span className={labelClass}>Contact:</span>
            <span className="text-gray-900 truncate ml-2">{opportunity.contact.name}</span>
          </div>
        );

      case 'businessName':
        if (!opportunity.contact?.companyName) return null;
        return (
          <div key={fieldId} className={`flex items-center justify-between text-xs ${spacing}`}>
            <span className={labelClass}>Business Name:</span>
            <span className="text-gray-900 truncate ml-2">{opportunity.contact.companyName}</span>
          </div>
        );

      case 'pipeline':
        if (!pipelineName) return null;
        return (
          <div key={fieldId} className={`flex items-center justify-between text-xs ${spacing}`}>
            <span className={labelClass}>Pipeline:</span>
            <span className="text-gray-900 truncate ml-2">{pipelineName}</span>
          </div>
        );

      case 'stage':
        if (!stageName) return null;
        return (
          <div key={fieldId} className={`flex items-center justify-between text-xs ${spacing}`}>
            <span className={labelClass}>Stage:</span>
            <span className="text-gray-900 truncate ml-2">{stageName}</span>
          </div>
        );

      case 'status':
        return (
          <div key={fieldId} className={`flex items-center justify-between text-xs ${spacing}`}>
            <span className={labelClass}>Status:</span>
            <span className={`text-gray-900 capitalize ml-2 ${
              opportunity.status === 'won' ? 'text-green-600 font-medium' :
              opportunity.status === 'lost' ? 'text-red-600 font-medium' :
              opportunity.status === 'abandoned' ? 'text-gray-600' :
              'text-blue-600 font-medium'
            }`}>
              {opportunity.status}
            </span>
          </div>
        );

      case 'opportunityValue':
        return (
          <div key={fieldId} className={`flex items-center justify-between text-xs ${spacing}`}>
            <span className={labelClass}>Opportunity Value:</span>
            <span className="font-semibold text-gray-900 ml-2">
              ${(opportunity.monetaryValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        );

      case 'opportunitySource':
        if (!opportunity.source) return null;
        return (
          <div key={fieldId} className={`flex items-center justify-between text-xs ${spacing}`}>
            <span className={labelClass}>Source:</span>
            <span className="text-gray-900 truncate ml-2">{opportunity.source}</span>
          </div>
        );

      case 'contactEmail':
        if (!opportunity.contact?.email) return null;
        return (
          <div key={fieldId} className={`flex items-center justify-between text-xs ${spacing}`}>
            <span className={labelClass}>Email:</span>
            <span className="text-gray-900 truncate ml-2">{opportunity.contact.email}</span>
          </div>
        );

      case 'contactPhone':
        if (!opportunity.contact?.phone) return null;
        return (
          <div key={fieldId} className={`flex items-center justify-between text-xs ${spacing}`}>
            <span className={labelClass}>Phone:</span>
            <span className="text-gray-900 truncate ml-2">{opportunity.contact.phone}</span>
          </div>
        );

      // Other Details
      case 'createdOn':
        if (!opportunity.ghlCreatedAt) return null;
        return (
          <div key={fieldId} className={`flex items-center justify-between text-xs ${spacing}`}>
            <span className={labelClass}>Created On:</span>
            <span className="text-gray-900 ml-2">{formatDate(opportunity.ghlCreatedAt)}</span>
          </div>
        );

      case 'updatedOn':
        if (!opportunity.ghlUpdatedAt) return null;
        return (
          <div key={fieldId} className={`flex items-center justify-between text-xs ${spacing}`}>
            <span className={labelClass}>Updated On:</span>
            <span className="text-gray-900 ml-2">{formatDate(opportunity.ghlUpdatedAt)}</span>
          </div>
        );

      case 'lastStatusChangeDate':
        if (!opportunity.lastStatusChangeAt) return null;
        return (
          <div key={fieldId} className={`flex items-center justify-between text-xs ${spacing}`}>
            <span className={labelClass}>Last Status Change:</span>
            <span className="text-gray-900 ml-2">{formatDate(opportunity.lastStatusChangeAt)}</span>
          </div>
        );

      case 'lastStageChangeDate':
        if (!opportunity.lastStageChangeAt) return null;
        return (
          <div key={fieldId} className={`flex items-center justify-between text-xs ${spacing}`}>
            <span className={labelClass}>Last Stage Change:</span>
            <span className="text-gray-900 ml-2">{formatDate(opportunity.lastStageChangeAt)}</span>
          </div>
        );

      case 'daysSinceLastStageChange': {
        const days = calculateDays(opportunity.lastStageChangeAt || '');
        if (days === null) return null;
        return (
          <div key={fieldId} className={`flex items-center justify-between text-xs ${spacing}`}>
            <span className={labelClass}>Days Since Stage Change:</span>
            <span className="text-gray-900 ml-2 font-medium">{days} {days === 1 ? 'day' : 'days'}</span>
          </div>
        );
      }

      case 'daysSinceLastStatusChange': {
        const days = calculateDays(opportunity.lastStatusChangeAt || '');
        if (days === null) return null;
        return (
          <div key={fieldId} className={`flex items-center justify-between text-xs ${spacing}`}>
            <span className={labelClass}>Days Since Status Change:</span>
            <span className="text-gray-900 ml-2 font-medium">{days} {days === 1 ? 'day' : 'days'}</span>
          </div>
        );
      }

      case 'daysSinceLastUpdated': {
        const days = calculateDays(opportunity.ghlUpdatedAt || '');
        if (days === null) return null;
        return (
          <div key={fieldId} className={`flex items-center justify-between text-xs ${spacing}`}>
            <span className={labelClass}>Days Since Updated:</span>
            <span className="text-gray-900 ml-2 font-medium">{days} {days === 1 ? 'day' : 'days'}</span>
          </div>
        );
      }

      // Primary Contact Details (using custom fields)
      case 'nextTaskDueDate': {
        const value = getCustomFieldValue('next_task_due_date');
        if (!value) return null;
        return (
          <div key={fieldId} className={`flex items-center justify-between text-xs ${spacing}`}>
            <span className={labelClass}>Next Task Due:</span>
            <span className="text-gray-900 ml-2">{formatDate(value)}</span>
          </div>
        );
      }

      case 'daysTillNextTaskDueDate': {
        const value = getCustomFieldValue('next_task_due_date');
        if (!value) return null;
        const date = new Date(value);
        const now = new Date();
        const diffTime = date.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return (
          <div key={fieldId} className={`flex items-center justify-between text-xs ${spacing}`}>
            <span className={labelClass}>Days Till Next Task:</span>
            <span className={`ml-2 font-medium ${
              diffDays < 0 ? 'text-red-600' : 
              diffDays === 0 ? 'text-orange-600' : 
              'text-gray-900'
            }`}>
              {diffDays} {Math.abs(diffDays) === 1 ? 'day' : 'days'}
            </span>
          </div>
        );
      }

      case 'engagementScore': {
        const value = getCustomFieldValue('engagement_score');
        if (!value) return null;
        return (
          <div key={fieldId} className={`flex items-center justify-between text-xs ${spacing}`}>
            <span className={labelClass}>Engagement Score:</span>
            <span className="text-gray-900 ml-2 font-medium">{value}</span>
          </div>
        );
      }

      case 'daysTillNextAppointmentDate': {
        const value = getCustomFieldValue('next_appointment_date');
        if (!value) return null;
        const date = new Date(value);
        const now = new Date();
        const diffTime = date.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return (
          <div key={fieldId} className={`flex items-center justify-between text-xs ${spacing}`}>
            <span className={labelClass}>Days Till Appointment:</span>
            <span className={`ml-2 font-medium ${
              diffDays < 0 ? 'text-red-600' : 
              diffDays === 0 ? 'text-orange-600' : 
              'text-gray-900'
            }`}>
              {diffDays} {Math.abs(diffDays) === 1 ? 'day' : 'days'}
            </span>
          </div>
        );
      }

      // Opportunity Details
      case 'opportunityOwner':
        if (!opportunity.assignedTo) return null;
        return (
          <div key={fieldId} className={`flex items-center justify-between text-xs ${spacing}`}>
            <span className={labelClass}>Owner:</span>
            <span className="text-gray-900 truncate ml-2">{opportunity.assignedTo}</span>
          </div>
        );

      case 'lostReason': {
        const value = getCustomFieldValue('lost_reason');
        if (!value || opportunity.status !== 'lost') return null;
        return (
          <div key={fieldId} className={`flex items-center justify-between text-xs ${spacing}`}>
            <span className={labelClass}>Lost Reason:</span>
            <span className="text-gray-900 truncate ml-2">{value}</span>
          </div>
        );
      }

      case 'service': {
        const value = getCustomFieldValue('service');
        if (!value) return null;
        return (
          <div key={fieldId} className={`flex items-center justify-between text-xs ${spacing}`}>
            <span className={labelClass}>Service:</span>
            <span className="text-gray-900 truncate ml-2">{value}</span>
          </div>
        );
      }

      case 'ourService': {
        const value = getCustomFieldValue('our_service');
        if (!value) return null;
        return (
          <div key={fieldId} className={`flex items-center justify-between text-xs ${spacing}`}>
            <span className={labelClass}>Our Service:</span>
            <span className="text-gray-900 truncate ml-2">{value}</span>
          </div>
        );
      }

      default:
        return null;
    }
  };

  // Auto-derive tag count so it shows as a badge on the tag icon
  const tags = opportunity.contact?.tags ?? [];
  const counts: Partial<Record<string, number>> = { ...actionCounts, tags: tags.length || undefined };

  // Owner initials
  const ownerName = opportunity.assignedTo ?? '';
  const ownerInitials = ownerName ? getInitials(ownerName) : null;
  const ownerColour = ownerName ? avatarColour(ownerName) : '';

  // Fixed-position tooltip state (for compact layout) — must be top-level hooks
  const cardRef = useRef<HTMLDivElement>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    const onDragStart = () => { isDraggingRef.current = true; setTooltipPos(null); };
    const onDragEnd   = () => { isDraggingRef.current = false; };
    window.addEventListener('dragstart', onDragStart);
    window.addEventListener('dragend',   onDragEnd);
    return () => {
      window.removeEventListener('dragstart', onDragStart);
      window.removeEventListener('dragend',   onDragEnd);
    };
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (!cardRef.current || isDraggingRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setTooltipPos({ top: rect.top, left: rect.left });
  }, []);
  const handleMouseLeave = useCallback(() => setTooltipPos(null), []);

  // Contact initials
  const contactName = opportunity.contact?.name ?? '';
  const contactInitials = contactName ? getInitials(contactName) : null;
  const contactColour = contactName ? avatarColour(contactName) : '';

  // ── Helper: build detail rows for hover tooltip ──
  const buildDetailRows = (): { label: string; value: string; type?: string }[] => {
    const rows: { label: string; value: string; type?: string }[] = [];
    const orderedVisible = fieldOrder.filter(id => visibleFields.includes(id));
    for (const fieldId of orderedVisible) {
      switch (fieldId) {
        case 'status': rows.push({ label: 'Status', value: opportunity.status, type: 'status' }); break;
        case 'pipeline': if (pipelineName) rows.push({ label: 'Pipeline', value: pipelineName }); break;
        case 'opportunityValue': rows.push({ label: 'Opportunity Value', value: `$${(opportunity.monetaryValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` }); break;
        case 'contact': if (opportunity.contact?.name) rows.push({ label: 'Contact', value: opportunity.contact.name, type: 'contact' }); break;
        case 'stage': if (stageName) rows.push({ label: 'Stage', value: stageName }); break;
        case 'opportunityName': if (opportunity.name) rows.push({ label: 'Opportunity', value: opportunity.name }); break;
        case 'businessName': if (opportunity.contact?.companyName) rows.push({ label: 'Business', value: opportunity.contact.companyName }); break;
        case 'contactEmail': if (opportunity.contact?.email) rows.push({ label: 'Email', value: opportunity.contact.email }); break;
        case 'contactPhone': if (opportunity.contact?.phone) rows.push({ label: 'Phone', value: opportunity.contact.phone }); break;
        case 'opportunityOwner': if (opportunity.assignedTo) rows.push({ label: 'Owner', value: opportunity.assignedTo }); break;
        case 'opportunitySource': if (opportunity.source) rows.push({ label: 'Source', value: opportunity.source }); break;
        case 'createdOn': if (opportunity.ghlCreatedAt) rows.push({ label: 'Created On', value: formatDate(opportunity.ghlCreatedAt) }); break;
        case 'updatedOn': if (opportunity.ghlUpdatedAt) rows.push({ label: 'Updated On', value: formatDate(opportunity.ghlUpdatedAt) }); break;
        case 'lastStatusChangeDate': if (opportunity.lastStatusChangeAt) rows.push({ label: 'Last Status Change', value: formatDate(opportunity.lastStatusChangeAt) }); break;
        case 'lastStageChangeDate': if (opportunity.lastStageChangeAt) rows.push({ label: 'Last Stage Change', value: formatDate(opportunity.lastStageChangeAt) }); break;
        case 'daysSinceLastStageChange': { const d = calculateDays(opportunity.lastStageChangeAt || ''); if (d !== null) rows.push({ label: 'Days Since Stage Change', value: `${d}` }); break; }
        case 'daysSinceLastStatusChange': { const d = calculateDays(opportunity.lastStatusChangeAt || ''); if (d !== null) rows.push({ label: 'Days Since Status Change', value: `${d}` }); break; }
        case 'daysSinceLastUpdated': { const d = calculateDays(opportunity.ghlUpdatedAt || ''); if (d !== null) rows.push({ label: 'Days Since Updated', value: `${d}` }); break; }
      }
    }
    return rows;
  };

  // ── COMPACT LAYOUT ──────────────────────────────────────────────────────────
  if (layout === 'compact') {
    const detailRows = buildDetailRows();

    return (
      <div
        ref={cardRef}
        className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-all duration-150 cursor-pointer group relative"
        onClick={() => onEdit(opportunity)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* ── Fixed-position hover detail tooltip ── */}
        {tooltipPos && detailRows.length > 0 && (
          <div
            className="fixed z-[9999] pointer-events-none"
            style={{ top: tooltipPos.top, left: tooltipPos.left, transform: 'translateY(-100%) translateY(-8px)' }}
          >
            <div className="bg-gray-900 text-white rounded-lg shadow-2xl py-2.5 px-3.5" style={{ minWidth: 220, maxWidth: 300 }}>
              {detailRows.map((row, i) => (
                <div key={i} className="flex items-center justify-between gap-4 py-1 text-xs">
                  <span className="text-gray-400 shrink-0 font-medium">{row.label}:</span>
                  {row.type === 'status' ? (
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                      opportunity.status === 'won' ? 'bg-green-600 text-white' :
                      opportunity.status === 'lost' ? 'bg-red-600 text-white' :
                      opportunity.status === 'abandoned' ? 'bg-gray-600 text-white' :
                      'bg-gray-700 text-white'
                    }`}>{row.value}</span>
                  ) : row.type === 'contact' ? (
                    <span className="flex items-center gap-1.5 text-white font-medium">
                      <span className={`shrink-0 w-5 h-5 rounded-full text-[8px] font-bold flex items-center justify-center select-none ${contactColour}`}>
                        {contactInitials}
                      </span>
                      <span className="truncate">{row.value}</span>
                    </span>
                  ) : (
                    <span className="text-white font-medium text-right truncate">{row.value}</span>
                  )}
                </div>
              ))}
            </div>
            {/* Down arrow */}
            <div className="flex justify-start ml-6">
              <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-gray-900" />
            </div>
          </div>
        )}

        {/* ── Header row: opportunity name + owner avatar ── */}
        <div className="px-2.5 pt-2 pb-1 flex items-start justify-between gap-1.5">
          <button
            className="text-left flex-1 min-w-0"
            onClick={(e) => { e.stopPropagation(); onEdit(opportunity); }}
            title={opportunity.name || 'Untitled'}
          >
            <span className="block text-[13px] font-semibold text-gray-900 leading-snug truncate hover:text-blue-600 transition-colors">
              {opportunity.name || 'Untitled'}
            </span>
          </button>

          {ownerInitials ? (
            <span
              className={`shrink-0 w-6 h-6 rounded-full text-[9px] font-bold flex items-center justify-center select-none ${ownerColour}`}
              title={ownerName}
            >
              {ownerInitials}
            </span>
          ) : (
            <span className="shrink-0 w-6 h-6 rounded-full bg-gray-100 text-gray-400 text-[9px] font-bold flex items-center justify-center">
              <User className="w-3 h-3" />
            </span>
          )}
        </div>

        {/* ── Info row 1: status pill + pipeline + value ── */}
        <div className="px-2.5 pb-1 flex items-center gap-2 flex-wrap">
          {isFieldVisible('status') && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${
              opportunity.status === 'won' ? 'border-green-300 text-green-700 bg-green-50' :
              opportunity.status === 'lost' ? 'border-red-300 text-red-700 bg-red-50' :
              opportunity.status === 'abandoned' ? 'border-gray-300 text-gray-600 bg-gray-50' :
              'border-gray-300 text-gray-700 bg-white'
            }`}>{opportunity.status}</span>
          )}
          {isFieldVisible('pipeline') && pipelineName && (
            <span className="text-xs text-gray-600">{pipelineName}</span>
          )}
          {isFieldVisible('opportunityValue') && (
            <span className="text-xs font-semibold text-gray-900">
              ${(opportunity.monetaryValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          )}
        </div>

        {/* ── Info row 2: contact avatar + contact name + stage ── */}
        <div className="px-2.5 pb-1.5 flex items-center gap-1.5">
          {isFieldVisible('contact') && opportunity.contact?.name && (
            <>
              {contactInitials ? (
                <span
                  className={`shrink-0 w-5 h-5 rounded-full text-[8px] font-bold flex items-center justify-center select-none ${contactColour}`}
                  title={contactName}
                >
                  {contactInitials}
                </span>
              ) : null}
              <span className="text-xs text-gray-700 truncate">{opportunity.contact.name}</span>
            </>
          )}
          {isFieldVisible('stage') && stageName && (
            <span className="text-xs text-gray-500 truncate ml-1">{stageName}</span>
          )}
        </div>

        {/* ── Action Bar ── */}
        <div
          className="px-2 py-1.5 bg-gray-50 border-t border-gray-100 flex items-center gap-0.5 rounded-b-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {actionOrder
            .filter((id) => visibleActions.includes(id) && ACTION_CONFIG[id])
            .map((id) => {
              const action = ACTION_CONFIG[id];
              if (id === 'tags' && tags.length > 0) {
                return (
                  <TagsPopover key={id} tags={tags} icon={action.icon} count={counts[id]} />
                );
              }
              return (
                <BadgeIcon
                  key={id}
                  icon={action.icon}
                  count={counts[id]}
                  label={action.label}
                  onClick={action.onClick}
                />
              );
            })}

          <button
            onClick={(e) => { e.stopPropagation(); onDelete(opportunity.ghlId); }}
            className="ml-auto p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // ── DEFAULT / UNLABELED LAYOUT ──────────────────────────────────────────────
  return (
    <div
      className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-all duration-150 overflow-hidden cursor-pointer group"
      onClick={() => onEdit(opportunity)}
    >
      {/* ── Header row: opportunity name + owner avatar ── */}
      <div className="px-2.5 pt-2 pb-1 flex items-start justify-between gap-1.5">
        {/* Opportunity name — click goes to edit/detail */}
        <button
          className="text-left flex-1 min-w-0"
          onClick={(e) => { e.stopPropagation(); onEdit(opportunity); }}
          title={opportunity.name || 'Untitled'}
        >
          <span className="block text-[13px] font-semibold text-gray-900 leading-snug truncate hover:text-blue-600 transition-colors">
            {opportunity.name || 'Untitled'}
          </span>
        </button>

        {/* Owner avatar */}
        {ownerInitials ? (
          <span
            className={`shrink-0 w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center select-none ${ownerColour}`}
            title={ownerName}
          >
            {ownerInitials}
          </span>
        ) : (
          <span className="shrink-0 w-5 h-5 rounded-full bg-gray-100 text-gray-400 text-[9px] font-bold flex items-center justify-center">
            ?
          </span>
        )}
      </div>

      {/* ── Dynamic fields ── */}
      <div className="px-2.5 pb-1.5 space-y-0.5">
        {fieldOrder.map((fieldId) => renderField(fieldId))}
      </div>

      {/* ── Action Bar ── */}
      <div
        className="px-2 py-1.5 bg-gray-50 border-t border-gray-100 flex items-center gap-0.5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon action buttons */}
        {actionOrder
          .filter((id) => visibleActions.includes(id) && ACTION_CONFIG[id])
          .map((id) => {
            const action = ACTION_CONFIG[id];
            // Tags: show hover popover with tag names
            if (id === 'tags' && tags.length > 0) {
              return (
                <TagsPopover key={id} tags={tags} icon={action.icon} count={counts[id]} />
              );
            }
            return (
              <BadgeIcon
                key={id}
                icon={action.icon}
                count={counts[id]}
                label={action.label}
                onClick={action.onClick}
              />
            );
          })}

        {/* Delete — only on hover */}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(opportunity.ghlId); }}
          className="ml-auto p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
});

export default OpportunityCard;
