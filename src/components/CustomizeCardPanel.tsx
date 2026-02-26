'use client';

import { useState, useEffect } from 'react';
import {
  X, Search, GripVertical, Lock,
  Phone, MessageSquare, Mail, Calendar, FileText, CheckSquare, Tag,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Field {
  id: string;
  label: string;
  locked?: boolean;
  category?: 'main' | 'otherDetails' | 'contactDetails' | 'opportunityDetails';
}

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface CustomizeCardPanelProps {
  isOpen: boolean;
  onClose: () => void;
  layout: 'default' | 'compact' | 'unlabeled';
  visibleFields: string[];
  fieldOrder: string[];
  visibleActions: string[];
  actionOrder: string[];
  onSave: (
    layout: 'default' | 'compact' | 'unlabeled',
    visibleFields: string[],
    fieldOrder: string[],
    visibleActions: string[],
    actionOrder: string[],
  ) => void;
}

// ─── Static data ──────────────────────────────────────────────────────────────

const ALL_FIELDS: Field[] = [
  { id: 'smartTags',        label: 'Smart Tags',       locked: true,  category: 'main' },
  { id: 'opportunityName',  label: 'Opportunity Name',               category: 'main' },
  { id: 'businessName',     label: 'Business Name',                  category: 'main' },
  { id: 'contact',          label: 'Contact',                        category: 'main' },
  { id: 'pipeline',         label: 'Pipeline',                       category: 'main' },
  { id: 'stage',            label: 'Stage',                          category: 'main' },
  { id: 'status',           label: 'Status',                         category: 'main' },
  { id: 'createdOn',              label: 'Created On',                         category: 'otherDetails' },
  { id: 'updatedOn',              label: 'Updated On',                         category: 'otherDetails' },
  { id: 'lastStatusChangeDate',   label: 'Last Status Change Date',            category: 'otherDetails' },
  { id: 'lastStageChangeDate',    label: 'Last Stage Change Date',             category: 'otherDetails' },
  { id: 'daysSinceLastStageChange',  label: 'Days Since Last Stage Change',    category: 'otherDetails' },
  { id: 'daysSinceLastStatusChange', label: 'Days Since Last Status Change',   category: 'otherDetails' },
  { id: 'daysSinceLastUpdated',      label: 'Days Since Last Updated',         category: 'otherDetails' },
  { id: 'nextTaskDueDate',          label: 'Next Task Due Date',               category: 'contactDetails' },
  { id: 'daysTillNextTaskDueDate',  label: 'Days Till Next Task Due Date',     category: 'contactDetails' },
  { id: 'engagementScore',          label: 'Engagement Score',                 category: 'contactDetails' },
  { id: 'daysTillNextAppointmentDate', label: 'Days Till Next Appointment Date', category: 'contactDetails' },
  { id: 'contactEmail',             label: "Contact's Email",                  category: 'contactDetails' },
  { id: 'contactPhone',             label: "Contact's Phone",                  category: 'contactDetails' },
  { id: 'opportunityValue',  label: 'Opportunity Value',   category: 'opportunityDetails' },
  { id: 'opportunityOwner',  label: 'Opportunity Owner',   category: 'opportunityDetails' },
  { id: 'opportunitySource', label: 'Opportunity Source',  category: 'opportunityDetails' },
  { id: 'lostReason',        label: 'Lost Reason',         category: 'opportunityDetails' },
  { id: 'service',           label: 'Service',             category: 'opportunityDetails' },
  { id: 'ourService',        label: 'Our Service',         category: 'opportunityDetails' },
];

const ALL_QUICK_ACTIONS: QuickAction[] = [
  { id: 'call',        label: 'Call',                           icon: <Phone className="w-3.5 h-3.5" /> },
  { id: 'sms',         label: 'Unread conversations',           icon: <MessageSquare className="w-3.5 h-3.5" /> },
  { id: 'tasks',       label: 'Tasks',                          icon: <CheckSquare className="w-3.5 h-3.5" /> },
  { id: 'notes',       label: 'Notes',                          icon: <FileText className="w-3.5 h-3.5" /> },
  { id: 'tags',        label: 'Tags',                           icon: <Tag className="w-3.5 h-3.5" /> },
  { id: 'email',       label: 'Email',                          icon: <Mail className="w-3.5 h-3.5" /> },
  { id: 'appointment', label: 'Upcoming Confirmed Appointment', icon: <Calendar className="w-3.5 h-3.5" /> },
];

const DEFAULT_VISIBLE_ACTIONS = ['call', 'sms', 'email', 'appointment', 'tasks', 'notes'];

// ─── Card Preview ─────────────────────────────────────────────────────────────

function CardPreview({
  layout,
  visibleFields,
  fieldOrder,
  visibleActions,
  actionOrder,
}: {
  layout: 'default' | 'compact' | 'unlabeled';
  visibleFields: string[];
  fieldOrder: string[];
  visibleActions: string[];
  actionOrder: string[];
}) {
  const previewData: Record<string, { label: string; value: React.ReactNode; plainValue?: string }> = {
    smartTags:        { label: 'Tags',             value: <span className="px-1.5 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">Stale</span>, plainValue: 'Stale' },
    opportunityName:  { label: 'Opportunity Name', value: <span className="font-semibold text-gray-900 text-sm">Opportunity Name</span>, plainValue: 'Opportunity Name' },
    businessName:     { label: 'Business Name',    value: 'Tech Innovators Inc.', plainValue: 'Tech Innovators Inc.' },
    contact:          { label: 'Contact',          value: <><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold mr-1">JO</span>John Smith</>, plainValue: 'John Smith' },
    pipeline:         { label: 'Pipeline',         value: 'Sales Pipeline', plainValue: 'Sales Pipeline' },
    stage:            { label: 'Stage',            value: 'Negotiation', plainValue: 'Negotiation' },
    status:           { label: 'Status',           value: <span className="px-1.5 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">open</span>, plainValue: 'open' },
    opportunityValue: { label: 'Value',            value: '$50,000.00', plainValue: '$50,000' },
    contactEmail:     { label: 'Email',            value: 'john@example.com', plainValue: 'john@example.com' },
    contactPhone:     { label: 'Phone',            value: '+1 555-0100', plainValue: '+1 555-0100' },
    opportunityOwner: { label: 'Owner',            value: 'Jane Doe', plainValue: 'Jane Doe' },
  };

  const previewFields = fieldOrder.filter(id => visibleFields.includes(id) && previewData[id]);
  const previewActions = actionOrder.filter(id => visibleActions.includes(id));

  // ── Compact preview ──────────────────────────────────────────────────────
  if (layout === 'compact') {
    const detailFields = previewFields.filter(id => id !== 'opportunityName' && id !== 'smartTags');
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm max-w-[260px] relative group/preview overflow-visible">
        {/* Header: name + owner avatar */}
        <div className="px-2.5 pt-2 pb-1 flex items-start justify-between gap-1.5">
          <span className="text-[13px] font-semibold text-gray-900 truncate leading-snug flex-1 min-w-0">Opportunity Name</span>
          <span className="shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-bold flex items-center justify-center select-none">JD</span>
        </div>

        {/* Row 1: status pill + pipeline + value */}
        <div className="px-2.5 pb-1 flex items-center gap-2 flex-wrap">
          {previewFields.includes('status') && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border border-gray-300 text-gray-700 bg-white">open</span>
          )}
          {previewFields.includes('pipeline') && (
            <span className="text-xs text-gray-600">Sales Pipeline</span>
          )}
          {previewFields.includes('opportunityValue') && (
            <span className="text-xs font-semibold text-gray-900">$50,000.00</span>
          )}
        </div>

        {/* Row 2: contact avatar + contact name + stage */}
        <div className="px-2.5 pb-1.5 flex items-center gap-1.5">
          {previewFields.includes('contact') && (
            <>
              <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[8px] font-bold flex items-center justify-center select-none">JS</span>
              <span className="text-xs text-gray-700 truncate">John Smith</span>
            </>
          )}
          {previewFields.includes('stage') && (
            <span className="text-xs text-gray-500 truncate ml-1">Negotiation</span>
          )}
        </div>

        {/* Action bar */}
        {previewActions.length > 0 && (
          <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-t border-gray-100 flex-wrap">
            {previewActions.map(id => {
              const action = ALL_QUICK_ACTIONS.find(a => a.id === id);
              if (!action) return null;
              return (
                <span key={id} className="p-1 rounded bg-gray-100 text-gray-500">{action.icon}</span>
              );
            })}
          </div>
        )}

        {/* Hover detail tooltip — appears ABOVE */}
        {detailFields.length > 0 && (
          <div className="absolute bottom-full left-0 mb-2 hidden group-hover/preview:block z-50 pointer-events-none">
            <div className="bg-gray-900 text-white rounded-lg shadow-2xl py-2.5 px-3.5 min-w-[200px] max-w-[280px]">
              {detailFields.map(id => {
                const f = previewData[id];
                if (!f) return null;
                return (
                  <div key={id} className="flex items-center justify-between gap-4 py-1 text-xs">
                    <span className="text-gray-400 shrink-0 font-medium">{f.label}:</span>
                    {id === 'status' ? (
                      <span className="px-2 py-0.5 rounded bg-gray-700 text-white text-[11px] font-semibold">open</span>
                    ) : id === 'contact' ? (
                      <span className="flex items-center gap-1.5 text-white font-medium">
                        <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[8px] font-bold flex items-center justify-center select-none">JS</span>
                        <span className="truncate">John Smith</span>
                      </span>
                    ) : (
                      <span className="text-white font-medium text-right truncate">{f.plainValue}</span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-start ml-6">
              <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-gray-900" />
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Default / Unlabeled preview ──────────────────────────────────────────
  const rowClass = 'flex items-center justify-between gap-2';
  const spacing = 'space-y-1';

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 max-w-[260px]">
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-gray-900 text-sm">Opportunity Name</span>
        <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">JD</span>
      </div>
      <div className={spacing}>
        {previewFields.filter(id => id !== 'opportunityName').map(id => {
          const f = previewData[id];
          if (!f) return null;
          if (id === 'smartTags') {
            return <div key={id} className="flex flex-wrap gap-1 mb-1">{f.value}</div>;
          }
          return (
            <div key={id} className={rowClass}>
              {layout !== 'unlabeled' && <span className="text-gray-500 text-xs shrink-0">{f.label}:</span>}
              <span className="text-gray-800 text-xs truncate">{f.value}</span>
            </div>
          );
        })}
      </div>
      {previewActions.length > 0 && (
        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-100 flex-wrap">
          {previewActions.map(id => {
            const action = ALL_QUICK_ACTIONS.find(a => a.id === id);
            if (!action) return null;
            if (id === 'appointment') {
              return (
                <span key={id} className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">
                  <Calendar className="w-3 h-3" />Sep 6th, 1:00 am
                </span>
              );
            }
            return (
              <span key={id} className="p-1 rounded bg-gray-100 text-gray-500">{action.icon}</span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CustomizeCardPanel({
  isOpen,
  onClose,
  layout,
  visibleFields,
  fieldOrder,
  visibleActions,
  actionOrder,
  onSave,
}: CustomizeCardPanelProps) {
  const [activeTab, setActiveTab] = useState<'fields' | 'quickActions'>('fields');
  const [selectedLayout, setSelectedLayout] = useState<'default' | 'compact' | 'unlabeled'>(layout);
  const [selectedFields, setSelectedFields] = useState<string[]>(visibleFields);
  const [orderedFields, setOrderedFields] = useState<string[]>(fieldOrder);
  const [selectedActions, setSelectedActions] = useState<string[]>(
    visibleActions?.length ? visibleActions : DEFAULT_VISIBLE_ACTIONS
  );
  const [orderedActions, setOrderedActions] = useState<string[]>(
    actionOrder?.length ? actionOrder : ALL_QUICK_ACTIONS.map(a => a.id)
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['otherDetails']));
  const [draggedField, setDraggedField] = useState<string | null>(null);
  const [draggedAction, setDraggedAction] = useState<string | null>(null);

  // Sync local state whenever the panel opens or the parent props change (e.g. after async settings load)
  useEffect(() => {
    if (!isOpen) return;
    setSelectedLayout(layout);
    setSelectedFields(visibleFields);
    setOrderedFields(fieldOrder);
    setSelectedActions(visibleActions?.length ? visibleActions : DEFAULT_VISIBLE_ACTIONS);
    setOrderedActions(actionOrder?.length ? actionOrder : ALL_QUICK_ACTIONS.map(a => a.id));
  }, [isOpen, layout, visibleFields, fieldOrder, visibleActions, actionOrder]);

  if (!isOpen) return null;

  const toggleField = (fieldId: string) => {
    const field = ALL_FIELDS.find(f => f.id === fieldId);
    if (field?.locked) return;
    if (selectedFields.includes(fieldId)) {
      setSelectedFields(selectedFields.filter(id => id !== fieldId));
      setOrderedFields(orderedFields.filter(id => id !== fieldId));
    } else {
      setSelectedFields([...selectedFields, fieldId]);
      setOrderedFields([...orderedFields, fieldId]);
    }
  };

  const handleFieldDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedField || draggedField === targetId) return;
    const from = orderedFields.indexOf(draggedField);
    const to = orderedFields.indexOf(targetId);
    if (from === -1 || to === -1) return;
    const next = [...orderedFields];
    next.splice(from, 1);
    next.splice(to, 0, draggedField);
    setOrderedFields(next);
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const s = new Set(prev);
      s.has(cat) ? s.delete(cat) : s.add(cat);
      return s;
    });
  };

  const getVisibleOrderedFields = () =>
    orderedFields
      .filter(id => selectedFields.includes(id))
      .map(id => ALL_FIELDS.find(f => f.id === id))
      .filter((f): f is Field => f !== undefined);

  const toggleAction = (actionId: string) => {
    if (selectedActions.includes(actionId)) {
      setSelectedActions(selectedActions.filter(id => id !== actionId));
    } else {
      setSelectedActions([...selectedActions, actionId]);
    }
  };

  const handleActionDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedAction || draggedAction === targetId) return;
    const from = orderedActions.indexOf(draggedAction);
    const to = orderedActions.indexOf(targetId);
    if (from === -1 || to === -1) return;
    const next = [...orderedActions];
    next.splice(from, 1);
    next.splice(to, 0, draggedAction);
    setOrderedActions(next);
  };

  const handleApply = () => {
    onSave(selectedLayout, selectedFields, orderedFields, selectedActions, orderedActions);
    onClose();
  };

  const mainFields = ALL_FIELDS.filter(f => f.category === 'main');
  const categorisedFields: Record<string, Field[]> = {
    otherDetails:       ALL_FIELDS.filter(f => f.category === 'otherDetails'),
    contactDetails:     ALL_FIELDS.filter(f => f.category === 'contactDetails'),
    opportunityDetails: ALL_FIELDS.filter(f => f.category === 'opportunityDetails'),
  };
  const catLabels: Record<string, string> = {
    otherDetails: 'Other Details',
    contactDetails: 'Primary Contact Details',
    opportunityDetails: 'Opportunity Details',
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-end">
      <div className="bg-white h-full w-full max-w-xl flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">Customise Card</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* Card Preview */}
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <p className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">Card Preview</p>
            <CardPreview
              layout={selectedLayout}
              visibleFields={selectedFields}
              fieldOrder={orderedFields}
              visibleActions={selectedActions}
              actionOrder={orderedActions}
            />
          </div>

          {/* Card Layout */}
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Card Layout</h3>
            <div className="flex gap-6">
              {(['default', 'compact', 'unlabeled'] as const).map(l => (
                <label key={l} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="layout"
                    checked={selectedLayout === l}
                    onChange={() => setSelectedLayout(l)}
                    className="w-4 h-4 text-blue-600 accent-blue-600"
                  />
                  <span className="text-sm text-gray-700 capitalize">{l}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="px-6 border-b border-gray-200 shrink-0">
            <div className="flex gap-6">
              <button
                onClick={() => setActiveTab('fields')}
                className={`pb-3 pt-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'fields'
                    ? 'text-blue-600 border-blue-600'
                    : 'text-gray-500 border-transparent hover:text-gray-700'
                }`}
              >
                Fields ({selectedFields.length} out of {ALL_FIELDS.length})
              </button>
              <button
                onClick={() => setActiveTab('quickActions')}
                className={`pb-3 pt-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'quickActions'
                    ? 'text-blue-600 border-blue-600'
                    : 'text-gray-500 border-transparent hover:text-gray-700'
                }`}
              >
                Quick actions
              </button>
            </div>
          </div>

          {/* ── Fields Tab ── */}
          {activeTab === 'fields' && (
            <div>
              <div className="px-6 py-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search fields"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Active/visible draggable fields */}
              <div className="px-6 pb-4">
                <div className="space-y-0.5">
                  {getVisibleOrderedFields().map(field => (
                    <div
                      key={field.id}
                      draggable={!field.locked}
                      onDragStart={() => { if (!field.locked) setDraggedField(field.id); }}
                      onDragOver={e => handleFieldDragOver(e, field.id)}
                      onDragEnd={() => setDraggedField(null)}
                      className={`flex items-center gap-2 px-2 py-2 rounded hover:bg-gray-50 ${
                        draggedField === field.id ? 'opacity-40' : ''
                      } ${field.locked ? 'cursor-not-allowed' : 'cursor-move'}`}
                    >
                      <GripVertical className={`w-4 h-4 ${field.locked ? 'text-gray-200' : 'text-gray-400'}`} />
                      <input
                        type="checkbox"
                        checked={selectedFields.includes(field.id)}
                        onChange={() => toggleField(field.id)}
                        disabled={field.locked}
                        className="w-4 h-4 text-blue-600 rounded accent-blue-600"
                      />
                      <span className="text-sm text-gray-700 flex-1">{field.label}</span>
                      {field.locked && <Lock className="w-3.5 h-3.5 text-gray-300" />}
                    </div>
                  ))}
                </div>
              </div>

              {/* Add fields section */}
              <div className="px-6 pb-6">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Add fields</h4>

                {/* Unselected main fields */}
                {mainFields
                  .filter(f => !selectedFields.includes(f.id) && f.label.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(field => (
                    <div key={field.id} className="mb-0.5">
                      <label className="flex items-center gap-2 px-2 py-2 rounded hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={() => toggleField(field.id)}
                          className="w-4 h-4 text-blue-600 rounded accent-blue-600"
                        />
                        <span className="text-sm text-gray-700">{field.label}</span>
                      </label>
                    </div>
                  ))}

                {/* Expandable category sections */}
                {Object.keys(categorisedFields).map(cat => {
                  const fields = categorisedFields[cat].filter(f =>
                    f.label.toLowerCase().includes(searchQuery.toLowerCase())
                  );
                  if (fields.length === 0) return null;
                  return (
                    <div key={cat} className="mb-2">
                      <button
                        onClick={() => toggleCategory(cat)}
                        className="flex items-center gap-2 w-full text-left py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                      >
                        <span className={`text-gray-400 text-xs transition-transform inline-block ${expandedCategories.has(cat) ? 'rotate-90' : ''}`}>▶</span>
                        {catLabels[cat]}
                      </button>
                      {expandedCategories.has(cat) && (
                        <div className="ml-5 space-y-0.5">
                          {fields.map(field => (
                            <label key={field.id} className="flex items-center gap-2 px-2 py-2 rounded hover:bg-gray-50 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedFields.includes(field.id)}
                                onChange={() => toggleField(field.id)}
                                className="w-4 h-4 text-blue-600 rounded accent-blue-600"
                              />
                              <span className="text-sm text-gray-700">{field.label}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Quick Actions Tab ── */}
          {activeTab === 'quickActions' && (
            <div className="px-6 py-4">
              <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                Count for each action will be shown in the card wherever applicable.
              </p>
              <div className="space-y-0.5">
                {orderedActions.map(actionId => {
                  const action = ALL_QUICK_ACTIONS.find(a => a.id === actionId);
                  if (!action) return null;
                  const checked = selectedActions.includes(actionId);
                  return (
                    <div
                      key={actionId}
                      draggable
                      onDragStart={() => setDraggedAction(actionId)}
                      onDragOver={e => handleActionDragOver(e, actionId)}
                      onDragEnd={() => setDraggedAction(null)}
                      className={`flex items-center gap-3 px-2 py-2.5 rounded hover:bg-gray-50 cursor-move select-none ${
                        draggedAction === actionId ? 'opacity-40' : ''
                      }`}
                    >
                      <GripVertical className="w-4 h-4 text-gray-400 shrink-0" />
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAction(actionId)}
                        className="w-4 h-4 text-blue-600 rounded accent-blue-600 shrink-0 cursor-pointer"
                      />
                      <span className="text-sm text-gray-700 flex-1">{action.label}</span>
                      <span className="text-gray-400 shrink-0">{action.icon}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
