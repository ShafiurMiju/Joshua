'use client';

import { memo } from 'react';
import { Phone, Mail, MessageSquare, Calendar, Trash2, CheckSquare, FileText, Tag } from 'lucide-react';

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
          const url = `https://app.gohighlevel.com/v2/location/${locationId}/contacts/detail/${contactId}`;
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

    // ── Compact: render as inline value chip ──────────────────────────────────
    if (layout === 'compact') {
      let value: React.ReactNode = null;
      switch (fieldId) {
        case 'smartTags': return null;
        case 'opportunityName': value = opportunity.name; break;
        case 'contact': value = opportunity.contact?.name; break;
        case 'businessName': value = opportunity.contact?.companyName; break;
        case 'pipeline': value = pipelineName; break;
        case 'stage': value = stageName; break;
        case 'status':
          return (
            <span key={fieldId} className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
              opportunity.status === 'won' ? 'bg-green-50 text-green-700' :
              opportunity.status === 'lost' ? 'bg-red-50 text-red-700' :
              opportunity.status === 'abandoned' ? 'bg-gray-100 text-gray-600' :
              'bg-blue-50 text-blue-700'
            }`}>{opportunity.status}</span>
          );
        case 'opportunityValue': value = `$${(opportunity.monetaryValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`; break;
        case 'contactEmail': value = opportunity.contact?.email; break;
        case 'contactPhone': value = opportunity.contact?.phone; break;
        case 'opportunityOwner': value = opportunity.assignedTo; break;
        case 'opportunitySource': value = opportunity.source; break;
        default: return null;
      }
      if (!value) return null;
      return (
        <span key={fieldId} className="inline-flex items-center text-[10px] text-gray-700 bg-gray-100 rounded px-1.5 py-0.5 max-w-[120px] truncate">
          {value}
        </span>
      );
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

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-150 overflow-hidden cursor-pointer group"
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
      <div className={layout === 'compact' ? 'px-2.5 pb-1.5 flex flex-wrap gap-1' : 'px-2.5 pb-1.5 space-y-0.5'}>
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
                <div key={id} className="relative group/tags">
                  <BadgeIcon
                    icon={action.icon}
                    count={counts[id]}
                    label={`Tags (${tags.length})`}
                  />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/tags:block z-30 min-w-[120px] max-w-[200px]">
                    <div className="bg-gray-900 text-white rounded-lg shadow-xl py-1.5 px-0.5">
                      {tags.map((tag, i) => (
                        <div key={i} className="px-3 py-1 text-xs whitespace-nowrap truncate">{tag}</div>
                      ))}
                    </div>
                    <div className="w-2 h-2 bg-gray-900 rotate-45 mx-auto -mt-1" />
                  </div>
                </div>
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
