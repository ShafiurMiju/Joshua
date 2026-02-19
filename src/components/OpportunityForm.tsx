'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Loader2, ChevronDown, ChevronUp, Trash2, Search, Check } from 'lucide-react';

const AVATAR_COLOURS = [
  'bg-red-100 text-red-700', 'bg-orange-100 text-orange-700',
  'bg-amber-100 text-amber-700', 'bg-green-100 text-green-700',
  'bg-teal-100 text-teal-700', 'bg-blue-100 text-blue-700',
  'bg-indigo-100 text-indigo-700', 'bg-purple-100 text-purple-700',
  'bg-pink-100 text-pink-700', 'bg-rose-100 text-rose-700',
];
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.substring(0, 2).toUpperCase();
}
function avatarColour(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLOURS[Math.abs(hash) % AVATAR_COLOURS.length];
}

interface PipelineStage {
  id: string;
  name: string;
  position: number;
}

interface Pipeline {
  ghlId: string;
  name: string;
  stages: PipelineStage[];
}

interface OpportunityFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  initialData?: Record<string, unknown> | null;
  mode: 'create' | 'edit';
  pipelines: Pipeline[];
  currentPipelineId?: string;
  locationId?: string;
  onDelete?: () => void;
  isSubmitting?: boolean;
  users?: Array<{ id: string; name: string; email: string; profilePhoto: string }>;
  allTags?: string[];
}

export default function OpportunityForm({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  mode,
  pipelines,
  currentPipelineId,
  locationId,
  onDelete,
  isSubmitting = false,
  users = [],
  allTags = [],
}: OpportunityFormProps) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [showContactDetails, setShowContactDetails] = useState(true);
  const [contacts, setContacts] = useState<Array<{ id: string; name: string; email: string; phone: string }>>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [showStageDropdown, setShowStageDropdown] = useState(false);
  const [stageSearch, setStageSearch] = useState('');
  const [showPipelineDropdown, setShowPipelineDropdown] = useState(false);
  const [pipelineSearch, setPipelineSearch] = useState('');
  const [showOwnerDropdown, setShowOwnerDropdown] = useState(false);
  const [ownerSearch, setOwnerSearch] = useState('');
  const [showAdditionalDropdown, setShowAdditionalDropdown] = useState(false);
  const [additionalSearch, setAdditionalSearch] = useState('');
  const [additionalContacts, setAdditionalContacts] = useState<Array<{ id: string; name: string; email: string; phone: string }>>([]);
  const [showContactsPanel, setShowContactsPanel] = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 });
  const overflowBadgeRef = useRef<HTMLSpanElement>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const [locationTags, setLocationTags] = useState<string[]>([]);
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const stageDropdownRef = useRef<HTMLDivElement>(null);
  const pipelineDropdownRef = useRef<HTMLDivElement>(null);
  const ownerDropdownRef = useRef<HTMLDivElement>(null);
  const additionalDropdownRef = useRef<HTMLDivElement>(null);
  const [selectedFollowers, setSelectedFollowers] = useState<Array<{ id: string; name: string; email: string; profilePhoto: string }>>([]);
  const [showFollowersDropdown, setShowFollowersDropdown] = useState(false);
  const [followerSearch, setFollowerSearch] = useState('');
  const followersDropdownRef = useRef<HTMLDivElement>(null);
  const overflowFollowerRef = useRef<HTMLSpanElement>(null);
  const [showFollowersPanel, setShowFollowersPanel] = useState(false);
  const [followerPanelPos, setFollowerPanelPos] = useState({ top: 0, left: 0 });
  const [customFieldDefs, setCustomFieldDefs] = useState<Array<{
    id: string; name: string; fieldKey: string; dataType: string;
    placeholder?: string; picklistOptions?: string[];
    isRequired?: boolean; parentId?: string; parentName?: string;
  }>>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string | string[]>>({});
  const [loadingCustomFields, setLoadingCustomFields] = useState(false);
  const [customFieldFolders, setCustomFieldFolders] = useState<Array<{ id: string; name: string; position: number; standard?: boolean }>>([]);

  // Compute folder-aware helpers
  const standardFolderId = customFieldFolders.find((f) => f.name === 'Opportunity Details')?.id || '';
  const sidebarFolders = customFieldFolders.filter((f) => f.name !== 'Opportunity Details');
  // Fields that belong in the main Opportunity Details tab:
  // - fields with no parentId
  // - fields whose parentId matches the standard "Opportunity Details" folder
  // - fields whose parentId doesn't match ANY known folder (orphaned)
  const knownFolderIds = new Set(customFieldFolders.map((f) => f.id));
  const detailsTabFields = customFieldDefs.filter(
    (cf) => !cf.parentId || cf.parentId === standardFolderId || !knownFolderIds.has(cf.parentId)
  );
  const [formData, setFormData] = useState({
    name: '',
    monetaryValue: 0,
    pipelineId: currentPipelineId || '',
    pipelineStageId: '',
    status: 'open',
    contactId: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    source: '',
    assignedTo: '',
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: (initialData.name as string) || '',
        monetaryValue: (initialData.monetaryValue as number) || 0,
        pipelineId: (initialData.pipelineId as string) || currentPipelineId || '',
        pipelineStageId: (initialData.pipelineStageId as string) || '',
        status: (initialData.status as string) || 'open',
        contactId: (initialData.contactId as string) || '',
        contactName: (initialData.contact as Record<string,unknown>)?.name as string || '',
        contactEmail: (initialData.contact as Record<string,unknown>)?.email as string || '',
        contactPhone: (initialData.contact as Record<string,unknown>)?.phone as string || '',
        source: (initialData.source as string) || '',
        assignedTo: (initialData.assignedTo as string) || '',
      });
    } else {
      const defaultPipeline = pipelines.find((p) => p.ghlId === currentPipelineId) || pipelines[0];
      setFormData({
        name: '',
        monetaryValue: 0,
        pipelineId: defaultPipeline?.ghlId || '',
        pipelineStageId: defaultPipeline?.stages[0]?.id || '',
        status: 'open',
        contactId: '',
        contactName: '',
        contactEmail: '',
        contactPhone: '',
        source: '',
        assignedTo: '',
      });
    }
  }, [initialData, pipelines, currentPipelineId]);

  // Sync selectedTags from initialData
  useEffect(() => {
    if (initialData) {
      setSelectedTags(((initialData.contact as Record<string,unknown>)?.tags as string[]) || []);
    } else {
      setSelectedTags([]);
    }
  }, [initialData, isOpen]);

  // Sync additionalContacts from initialData (cross-ref with contacts list)
  useEffect(() => {
    if (initialData) {
      const ids = (initialData.additionalContacts as string[]) || [];
      if (ids.length === 0) {
        setAdditionalContacts([]);
        return;
      }
      // Map each saved ID to its contact object; fall back to a placeholder if not yet in list
      const resolved = ids.map((id) => {
        const found = contacts.find((c) => c.id === id);
        return found || { id, name: id, email: '', phone: '' };
      });
      setAdditionalContacts(resolved);
    } else {
      setAdditionalContacts([]);
    }
  }, [initialData, isOpen, contacts]);

  // Sync selectedFollowers from initialData (cross-ref with users list)
  useEffect(() => {
    if (initialData && users.length > 0) {
      const followerIds = ((initialData.followers as Array<string | { userId?: string; id?: string }>) || []).map(
        (f) => (typeof f === 'string' ? f : f.userId || f.id || '')
      ).filter(Boolean);
      const matched = followerIds
        .map((id) => users.find((u) => u.id === id))
        .filter((u): u is typeof users[number] => !!u);
      setSelectedFollowers(matched);
    } else if (!initialData) {
      setSelectedFollowers([]);
    }
  }, [initialData, isOpen, users]);

  // Fetch location tags when modal opens
  useEffect(() => {
    if (isOpen && locationId) {
      fetch(`/api/location/${locationId}/tags`)
        .then(r => r.json())
        .then(d => setLocationTags(d.tags || []))
        .catch(() => setLocationTags([]));
    }
  }, [isOpen, locationId]);

  // Fetch custom field definitions when modal opens
  useEffect(() => {
    if (isOpen && locationId) {
      const fetchCustomFields = async () => {
        setLoadingCustomFields(true);
        try {
          const res = await fetch(`/api/location/${locationId}/custom-fields?model=opportunity`);
          const data = await res.json();
          setCustomFieldDefs(data.customFields || []);
          setCustomFieldFolders(data.folders || []);
        } catch (err) {
          console.error('Failed to fetch custom fields:', err);
        } finally {
          setLoadingCustomFields(false);
        }
      };
      fetchCustomFields();
    }
  }, [isOpen, locationId]);

  // Initialize custom field values from initialData
  useEffect(() => {
    if (initialData && customFieldDefs.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const savedFields = (initialData.customFields as Array<Record<string, any>>) || [];
      const values: Record<string, string | string[]> = {};
      for (const def of customFieldDefs) {
        const saved = savedFields.find(
          (f) => f.id === def.id || f.key === def.fieldKey
        );
        if (saved) {
          // GHL stores values in different formats depending on how they were synced:
          // Synced from GHL search: { id, fieldValueString, fieldValueArray, type }
          // Saved from our form:    { id, key, field_value }
          const val =
            saved.field_value ??
            saved.fieldValueArray ??
            saved.fieldValueString ??
            '';
          values[def.id] = val as string | string[];
        } else {
          values[def.id] =
            def.dataType === 'CHECKBOX' ||
            def.dataType === 'LIST' ||
            def.dataType === 'MULTIPLE_OPTIONS'
              ? []
              : '';
        }
      }
      setCustomFieldValues(values);
    } else if (!initialData) {
      setCustomFieldValues({});
    }
  }, [initialData, customFieldDefs]);

  // Fetch contacts when modal opens
  useEffect(() => {
    if (isOpen && locationId) {
      const fetchContacts = async () => {
        setLoadingContacts(true);
        try {
          const res = await fetch(`/api/location/${locationId}/contacts`);
          const data = await res.json();
          let contactsList = data.contacts || [];
          
          // Use initialData to get contact info (formData may not be set yet)
          const currentContactName = (initialData?.contact as Record<string,unknown>)?.name as string || '';
          const currentContactId = initialData?.contactId as string || '';
          const currentContactEmail = (initialData?.contact as Record<string,unknown>)?.email as string || '';
          const currentContactPhone = (initialData?.contact as Record<string,unknown>)?.phone as string || '';
          
          // If we have initial contact data, ensure it's in the list
          if (currentContactName || currentContactId) {
            let matchedContact: { id: string; name: string; email: string; phone: string } | null = null;
            
            // Try to find matching contact by ID first
            if (currentContactId) {
              const found = contactsList.find((c: { id: string }) => c.id === currentContactId);
              matchedContact = found || null;
              
              // If found by ID, update formData with complete contact info from API
              if (matchedContact) {
                setFormData((prev) => ({
                  ...prev,
                  contactId: matchedContact!.id,
                  contactName: matchedContact!.name,
                  contactEmail: matchedContact!.email,
                  contactPhone: matchedContact!.phone,
                }));
              }
            }
            
            // Try to match by email or phone if no ID match
            if (!matchedContact && currentContactEmail) {
              const found = contactsList.find((c: { email: string }) => c.email === currentContactEmail);
              matchedContact = found || null;
              
              if (matchedContact) {
                setFormData((prev) => ({
                  ...prev,
                  contactId: matchedContact!.id,
                  contactName: matchedContact!.name,
                  contactEmail: matchedContact!.email,
                  contactPhone: matchedContact!.phone,
                }));
              }
            }
            if (!matchedContact && currentContactPhone) {
              const found = contactsList.find((c: { phone: string }) => c.phone === currentContactPhone);
              matchedContact = found || null;
              
              if (matchedContact) {
                setFormData((prev) => ({
                  ...prev,
                  contactId: matchedContact!.id,
                  contactName: matchedContact!.name,
                  contactEmail: matchedContact!.email,
                  contactPhone: matchedContact!.phone,
                }));
              }
            }
            
            if (!matchedContact && currentContactName) {
              // Contact not in list, add it
              const contactId = currentContactId || `temp_${Date.now()}`;
              contactsList = [
                {
                  id: contactId,
                  name: currentContactName,
                  email: currentContactEmail || '',
                  phone: currentContactPhone || '',
                },
                ...contactsList,
              ];
              
              // Update formData if no contactId was present
              if (!currentContactId) {
                setFormData((prev) => ({
                  ...prev,
                  contactId: contactId,
                }));
              }
            }
          }
          
          setContacts(contactsList);

          // Ensure any saved additionalContacts IDs not in the fetched list are injected
          // This handles pagination gaps where the contacts API doesn't return all contacts
          const savedAdditionalIds = (initialData?.additionalContacts as string[]) || [];
          if (savedAdditionalIds.length > 0) {
            const missingIds = savedAdditionalIds.filter(
              (id) => !contactsList.find((c: { id: string }) => c.id === id)
            );
            if (missingIds.length > 0) {
              const placeholders = missingIds.map((id) => ({
                id,
                name: `Contact (${id.slice(0, 8)}…)`,
                email: '',
                phone: '',
              }));
              setContacts((prev) => {
                const existingIds = new Set(prev.map((c) => c.id));
                return [...prev, ...placeholders.filter((p) => !existingIds.has(p.id))];
              });
            }
          }
        } catch (error) {
          console.error('Error fetching contacts:', error);
        } finally {
          setLoadingContacts(false);
        }
      };
      fetchContacts();
    }
  }, [isOpen, locationId, initialData]);

  const selectedPipeline = pipelines.find((p) => p.ghlId === formData.pipelineId);
  const stages = selectedPipeline?.stages || [];

  const handleChange = (field: string, value: string | number) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'pipelineId') {
        const pipeline = pipelines.find((p) => p.ghlId === value);
        updated.pipelineStageId = pipeline?.stages[0]?.id || '';
      }
      return updated;
    });
  };

  const handleContactChange = (contactId: string) => {
    const selectedContact = contacts.find((c) => c.id === contactId);
    if (selectedContact) {
      setFormData((prev) => ({
        ...prev,
        contactId: selectedContact.id,
        contactName: selectedContact.name,
        contactEmail: selectedContact.email,
        contactPhone: selectedContact.phone,
      }));
      setShowContactDropdown(false);
      setContactSearch('');
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowContactDropdown(false);
      }
      if (stageDropdownRef.current && !stageDropdownRef.current.contains(event.target as Node)) {
        setShowStageDropdown(false);
      }
      if (pipelineDropdownRef.current && !pipelineDropdownRef.current.contains(event.target as Node)) {
        setShowPipelineDropdown(false);
      }
      if (ownerDropdownRef.current && !ownerDropdownRef.current.contains(event.target as Node)) {
        setShowOwnerDropdown(false);
      }
      if (additionalDropdownRef.current && !additionalDropdownRef.current.contains(event.target as Node)) {
        setShowAdditionalDropdown(false);
      }
      if (followersDropdownRef.current && !followersDropdownRef.current.contains(event.target as Node)) {
        setShowFollowersDropdown(false);
      }
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(event.target as Node)) {
        setShowTagDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter contacts based on search
  const filteredContacts = contacts.filter((contact) =>
    contact.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
    contact.email.toLowerCase().includes(contactSearch.toLowerCase()) ||
    contact.phone.includes(contactSearch)
  );

  // Filter stages based on search
  const filteredStages = stages.filter((stage) =>
    stage.name.toLowerCase().includes(stageSearch.toLowerCase())
  );

  const filteredPipelines = pipelines.filter((pipeline) =>
    pipeline.name.toLowerCase().includes(pipelineSearch.toLowerCase())
  );

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(ownerSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(ownerSearch.toLowerCase())
  );

  const selectedUser = users.find((u) => u.id === formData.assignedTo);

  const selectedPipelineName = pipelines.find((p) => p.ghlId === formData.pipelineId)?.name || 'Select Pipeline';
  const selectedStageName = stages.find((s) => s.id === formData.pipelineStageId)?.name || 'Select Stage';

  // ── Reusable custom field input renderer ─────────────────────────────
  const renderCustomFieldInput = (cf: typeof customFieldDefs[number]) => {
    const val = customFieldValues[cf.id];
    const handleCFChange = (newVal: string | string[]) =>
      setCustomFieldValues((prev) => ({ ...prev, [cf.id]: newVal }));

    switch (cf.dataType) {
      case 'LARGE_TEXT':
      case 'TEXT':
        return (
          <div key={cf.id} className={cf.dataType === 'LARGE_TEXT' ? 'col-span-2' : ''}>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{cf.name}</label>
            {cf.dataType === 'LARGE_TEXT' ? (
              <textarea
                value={(val as string) || ''}
                onChange={(e) => handleCFChange(e.target.value)}
                placeholder={cf.placeholder || ''}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900 resize-y min-h-[80px]"
              />
            ) : (
              <input
                type="text"
                value={(val as string) || ''}
                onChange={(e) => handleCFChange(e.target.value)}
                placeholder={cf.placeholder || ''}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900"
              />
            )}
          </div>
        );

      case 'NUMERICAL':
      case 'MONETARY':
        return (
          <div key={cf.id}>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{cf.name}</label>
            <input
              type="number"
              value={(val as string) || ''}
              onChange={(e) => handleCFChange(e.target.value)}
              placeholder={cf.placeholder || ''}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900"
              step="any"
            />
          </div>
        );

      case 'PHONE':
        return (
          <div key={cf.id}>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{cf.name}</label>
            <input
              type="tel"
              value={(val as string) || ''}
              onChange={(e) => handleCFChange(e.target.value)}
              placeholder={cf.placeholder || ''}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900"
            />
          </div>
        );

      case 'DATE':
        return (
          <div key={cf.id}>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{cf.name}</label>
            <input
              type="date"
              value={(val as string) || ''}
              onChange={(e) => handleCFChange(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900"
            />
          </div>
        );

      case 'SINGLE_OPTIONS':
      case 'RADIO':
        return (
          <div key={cf.id}>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{cf.name}</label>
            <select
              value={(val as string) || ''}
              onChange={(e) => handleCFChange(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900"
            >
              <option value="">Select...</option>
              {(cf.picklistOptions || []).map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        );

      case 'MULTIPLE_OPTIONS':
      case 'CHECKBOX':
      case 'LIST': {
        const selectedArr = Array.isArray(val) ? val : [];
        return (
          <div key={cf.id} className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{cf.name}</label>
            <div className="flex flex-wrap gap-2">
              {(cf.picklistOptions || []).map((opt) => {
                const isSelected = selectedArr.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      handleCFChange(
                        isSelected
                          ? selectedArr.filter((v) => v !== opt)
                          : [...selectedArr, opt]
                      );
                    }}
                    className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                      isSelected
                        ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        );
      }

      case 'TEXTBOX_LIST': {
        const listVal = Array.isArray(val) ? val : (val ? [val as string] : ['']);
        return (
          <div key={cf.id} className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{cf.name}</label>
            <div className="space-y-2">
              {listVal.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => {
                      const updated = [...listVal];
                      updated[idx] = e.target.value;
                      handleCFChange(updated);
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900"
                  />
                  {listVal.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleCFChange(listVal.filter((_, i) => i !== idx))}
                      className="text-gray-400 hover:text-red-500"
                    >&times;</button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => handleCFChange([...listVal, ''])}
                className="text-sm text-blue-600 hover:text-blue-700"
              >+ Add item</button>
            </div>
          </div>
        );
      }

      // Fallback: treat as text
      default:
        return (
          <div key={cf.id}>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{cf.name}</label>
            <input
              type="text"
              value={(typeof val === 'string' ? val : '') || ''}
              onChange={(e) => handleCFChange(e.target.value)}
              placeholder={cf.placeholder || ''}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900"
            />
          </div>
        );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || isSubmitting) return;
    setLoading(true);
    try {
      await onSubmit({
        ...formData,
        contactTags: selectedTags,
        followers: selectedFollowers.map(f => f.id),
        customFields: customFieldDefs
          .filter((def) => {
            const val = customFieldValues[def.id];
            return val !== undefined && val !== '' && !(Array.isArray(val) && val.length === 0);
          })
          .map((def) => ({
            id: def.id,
            key: def.fieldKey,
            field_value: customFieldValues[def.id],
          })),
        ...(mode === 'edit' ? { additionalContacts: additionalContacts.map(c => c.id) } : {}),
      });
      onClose();
    } catch (error) {
      console.error('Form submit error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {mode === 'create' ? 'Add Opportunity' : `Edit "${formData.name}"`}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left Sidebar */}
          <div className="w-56 border-r border-gray-200 bg-gray-50 overflow-y-auto">
            <div className="p-3 space-y-1">
              <button
                onClick={() => setActiveTab('details')}
                className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                  activeTab === 'details'
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Opportunity Details
              </button>
              {/* Custom field folders as sidebar tabs (exclude the standard "Opportunity Details" folder) */}
              {sidebarFolders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => setActiveTab(`folder-${folder.id}`)}
                  className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                    activeTab === `folder-${folder.id}`
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {folder.name}
                </button>
              ))}
              {/* Ungrouped custom fields tab (fields with no folder) */}
              {customFieldDefs.some((cf) => !cf.parentId) && customFieldDefs.filter((cf) => !cf.parentId).length > 0 && sidebarFolders.length > 0 && (
                <button
                  onClick={() => setActiveTab('custom-fields')}
                  className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                    activeTab === 'custom-fields'
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Custom Fields
                </button>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto">
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {activeTab === 'details' && (
                <>
                  {/* Contact Details Section */}
                  <div className="border border-gray-200 rounded-lg overflow-visible">
                    <button
                      type="button"
                      onClick={() => setShowContactDetails(!showContactDetails)}
                      className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <span className="text-sm font-semibold text-gray-900">Contact details</span>
                      {showContactDetails ? (
                        <ChevronUp className="w-4 h-4 text-gray-600" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-600" />
                      )}
                    </button>
                    
                    {showContactDetails && (
                      <div className="p-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="relative" ref={dropdownRef}>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                              Primary Contact Name <span className="text-red-500">*</span>
                            </label>
                            <button
                              type="button"
                              onClick={() => !loadingContacts && setShowContactDropdown(!showContactDropdown)}
                              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-left bg-white hover:bg-gray-50 transition-colors flex items-center justify-between"
                              disabled={loadingContacts}
                            >
                              <span className={formData.contactName ? 'text-gray-900' : 'text-gray-400'}>
                                {loadingContacts ? 'Loading contacts...' : (formData.contactName || 'Select a contact')}
                              </span>
                              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showContactDropdown ? 'rotate-180' : ''}`} />
                            </button>
                            
                            {showContactDropdown && (
                              <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl">
                                <div className="p-2.5 border-b border-gray-100 bg-gray-50 rounded-t-lg">
                                  <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                      type="text"
                                      value={contactSearch}
                                      onChange={(e) => setContactSearch(e.target.value)}
                                      placeholder="Search by name, email, or phone..."
                                      className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                                      onClick={(e) => e.stopPropagation()}
                                      autoFocus
                                    />
                                  </div>
                                </div>
                                <div className="max-h-72 overflow-y-auto">
                                  {filteredContacts.length === 0 ? (
                                    <div className="px-4 py-8 text-center text-sm text-gray-500">
                                      {contactSearch ? (
                                        <>
                                          <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                          <p>No contacts found matching "{contactSearch}"</p>
                                        </>
                                      ) : (
                                        <p>No contacts available</p>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="py-1">
                                      {filteredContacts.map((contact) => (
                                        <button
                                          key={contact.id}
                                          type="button"
                                          onClick={() => handleContactChange(contact.id)}
                                          className="w-full px-3 py-2.5 text-left hover:bg-blue-50 transition-colors flex items-start justify-between gap-3 border-b border-gray-50 last:border-0"
                                        >
                                          <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-gray-900 mb-0.5">{contact.name}</div>
                                            {contact.email && (
                                              <div className="text-xs text-gray-500 truncate mb-0.5">{contact.email}</div>
                                            )}
                                            {contact.phone && (
                                              <div className="text-xs text-gray-500">{contact.phone}</div>
                                            )}
                                          </div>
                                          {formData.contactId === contact.id && (
                                            <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                                          )}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                              Primary Email
                            </label>
                            <input
                              type="email"
                              value={formData.contactEmail}
                              onChange={(e) => handleChange('contactEmail', e.target.value)}
                              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900 bg-white"
                              placeholder="email@example.com"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                              Primary Phone
                            </label>
                            <input
                              type="tel"
                              value={formData.contactPhone}
                              onChange={(e) => handleChange('contactPhone', e.target.value)}
                              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900 bg-white"
                              placeholder="+1234567890"
                            />
                          </div>
                          {mode === 'edit' ? (
                            <div className="relative" ref={additionalDropdownRef}>
                              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Additional Contacts <span className="text-gray-500 text-xs">(Max: 10)</span>
                              </label>
                            <button
                              type="button"
                              onClick={() => setShowAdditionalDropdown(!showAdditionalDropdown)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-left bg-white hover:bg-gray-50 transition-colors flex items-center gap-2 min-w-0"
                            >
                              {additionalContacts.length > 0 ? (() => {
                                const MAX_SHOW = 2;
                                const visible = additionalContacts.slice(0, MAX_SHOW);
                                const overflow = additionalContacts.length - MAX_SHOW;
                                return (
                                  <span className="flex items-center gap-1.5 flex-1 min-w-0">
                                    {visible.map(c => (
                                      <span key={c.id} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 max-w-[130px] shrink-0">
                                        <span className={`w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center shrink-0 ${avatarColour(c.name)}`}>
                                          {getInitials(c.name)}
                                        </span>
                                        <span className="text-xs text-gray-700 truncate font-medium">{c.name.split(' ')[0]}</span>
                                      </span>
                                    ))}
                                    {overflow > 0 && (
                                      <span
                                        ref={overflowBadgeRef}
                                        className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-medium cursor-default transition-colors shrink-0"
                                        onMouseEnter={e => {
                                          e.stopPropagation();
                                          const rect = overflowBadgeRef.current?.getBoundingClientRect();
                                          if (rect) setPanelPos({ top: rect.bottom + 8, left: rect.left });
                                          setShowContactsPanel(true);
                                        }}
                                        onMouseLeave={() => setShowContactsPanel(false)}
                                        onClick={e => e.stopPropagation()}
                                      >
                                        +{overflow}
                                      </span>
                                    )}
                                  </span>
                                );
                              })() : (
                                <span className="text-gray-400 flex-1">Add additional contacts</span>
                              )}
                              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ml-auto ${showAdditionalDropdown ? 'rotate-180' : ''}`} />
                            </button>

                            {showContactsPanel && additionalContacts.length > 0 && (
                              <div
                                style={{ position: 'fixed', top: panelPos.top, left: panelPos.left, zIndex: 9999, minWidth: '240px', maxWidth: '300px' }}
                                className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-2xl"
                                onMouseEnter={() => setShowContactsPanel(true)}
                                onMouseLeave={() => setShowContactsPanel(false)}
                              >
                                <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">All Contacts ({additionalContacts.length})</span>
                                </div>
                                <div className="p-1.5 flex flex-col gap-0.5">
                                  {additionalContacts.map(c => (
                                    <div key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50">
                                      <span className={`w-7 h-7 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${avatarColour(c.name)}`}>
                                        {getInitials(c.name)}
                                      </span>
                                      <div className="flex flex-col min-w-0 flex-1">
                                        <span className="text-xs font-medium text-gray-800 truncate">{c.name}</span>
                                        {c.email && <span className="text-[10px] text-gray-400 truncate">{c.email}</span>}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => setAdditionalContacts(prev => prev.filter(x => x.id !== c.id))}
                                        className="text-gray-300 hover:text-red-500 transition-colors text-sm leading-none shrink-0"
                                      >&times;</button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {showAdditionalDropdown && (
                              <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl">
                                <div className="p-2.5 border-b border-gray-100 bg-gray-50 rounded-t-lg">
                                  <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                      type="text"
                                      value={additionalSearch}
                                      onChange={(e) => setAdditionalSearch(e.target.value)}
                                      placeholder="Search by name, email, or phone..."
                                      className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                                      onClick={(e) => e.stopPropagation()}
                                      autoFocus
                                    />
                                  </div>
                                  {additionalContacts.length >= 10 && (
                                    <p className="text-xs text-orange-600 mt-1.5 px-1">Maximum of 10 contacts reached</p>
                                  )}
                                </div>
                                <div className="max-h-60 overflow-y-auto">
                                  {contacts
                                    .filter(c =>
                                      c.id !== formData.contactId &&
                                      (c.name.toLowerCase().includes(additionalSearch.toLowerCase()) ||
                                       c.email.toLowerCase().includes(additionalSearch.toLowerCase()) ||
                                       c.phone.includes(additionalSearch))
                                    )
                                    .map((contact) => {
                                      const isSelected = additionalContacts.some(x => x.id === contact.id);
                                      const maxReached = !isSelected && additionalContacts.length >= 10;
                                      return (
                                        <button
                                          key={contact.id}
                                          type="button"
                                          disabled={maxReached}
                                          onClick={() => {
                                            if (isSelected) {
                                              setAdditionalContacts(prev => prev.filter(x => x.id !== contact.id));
                                            } else if (!maxReached) {
                                              setAdditionalContacts(prev => [...prev, contact]);
                                            }
                                          }}
                                          className={`w-full px-3 py-2.5 text-left flex items-start justify-between gap-3 border-b border-gray-50 last:border-0 transition-colors ${
                                            isSelected ? 'bg-blue-50' :
                                            maxReached ? 'opacity-40 cursor-not-allowed' :
                                            'hover:bg-blue-50'
                                          }`}
                                        >
                                          <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-gray-900">{contact.name}</div>
                                            {contact.email && <div className="text-xs text-gray-500 truncate">{contact.email}</div>}
                                            {contact.phone && <div className="text-xs text-gray-500">{contact.phone}</div>}
                                          </div>
                                          {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />}
                                        </button>
                                      );
                                    })}
                                </div>
                              </div>
                            )}
                            </div>
                          ) : (
                            <div />
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Opportunity Details Section */}
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 mb-4">Opportunity Details</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Opportunity Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => handleChange('name', e.target.value)}
                          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900"
                          required
                          placeholder="Enter opportunity name"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="relative" ref={pipelineDropdownRef}>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Pipeline</label>
                          <button
                            type="button"
                            onClick={() => setShowPipelineDropdown(!showPipelineDropdown)}
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-left bg-white hover:bg-gray-50 transition-colors flex items-center justify-between"
                          >
                            <span className={formData.pipelineId ? 'text-gray-900' : 'text-gray-400'}>
                              {selectedPipelineName}
                            </span>
                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showPipelineDropdown ? 'rotate-180' : ''}`} />
                          </button>
                          
                          {showPipelineDropdown && (
                            <div className="absolute z-100 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl">
                              <div className="p-2.5 border-b border-gray-100 bg-gray-50 rounded-t-lg">
                                <div className="relative">
                                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                  <input
                                    type="text"
                                    value={pipelineSearch}
                                    onChange={(e) => setPipelineSearch(e.target.value)}
                                    placeholder="Search pipelines..."
                                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                                    onClick={(e) => e.stopPropagation()}
                                    autoFocus
                                  />
                                </div>
                              </div>
                              <div className="max-h-72 overflow-y-auto">
                                {filteredPipelines.length === 0 ? (
                                  <div className="px-4 py-8 text-center text-sm text-gray-500">
                                    {pipelineSearch ? (
                                      <>
                                        <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                        <p>No pipelines found matching "{pipelineSearch}"</p>
                                      </>
                                    ) : (
                                      <p>No pipelines available</p>
                                    )}
                                  </div>
                                ) : (
                                  <div className="py-1">
                                    {filteredPipelines.map((pipeline) => (
                                      <button
                                        key={pipeline.ghlId}
                                        type="button"
                                        onClick={() => {
                                          handleChange('pipelineId', pipeline.ghlId);
                                          setShowPipelineDropdown(false);
                                          setPipelineSearch('');
                                        }}
                                        className="w-full px-3 py-2.5 text-left hover:bg-blue-50 transition-colors flex items-center justify-between gap-3 border-b border-gray-50 last:border-0"
                                      >
                                        <span className="text-sm font-medium text-gray-900">{pipeline.name}</span>
                                        {formData.pipelineId === pipeline.ghlId && (
                                          <Check className="w-4 h-4 text-blue-600 shrink-0" />
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="relative" ref={stageDropdownRef}>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Stage</label>
                          <button
                            type="button"
                            onClick={() => setShowStageDropdown(!showStageDropdown)}
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-left bg-white hover:bg-gray-50 transition-colors flex items-center justify-between"
                          >
                            <span className={formData.pipelineStageId ? 'text-gray-900' : 'text-gray-400'}>
                              {selectedStageName}
                            </span>
                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showStageDropdown ? 'rotate-180' : ''}`} />
                          </button>
                          
                          {showStageDropdown && (
                            <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl">
                              <div className="p-2.5 border-b border-gray-100 bg-gray-50 rounded-t-lg">
                                <div className="relative">
                                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                  <input
                                    type="text"
                                    value={stageSearch}
                                    onChange={(e) => setStageSearch(e.target.value)}
                                    placeholder="Search stages..."
                                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                                    onClick={(e) => e.stopPropagation()}
                                    autoFocus
                                  />
                                </div>
                              </div>
                              <div className="max-h-72 overflow-y-auto">
                                {filteredStages.length === 0 ? (
                                  <div className="px-4 py-8 text-center text-sm text-gray-500">
                                    {stageSearch ? (
                                      <>
                                        <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                        <p>No stages found matching "{stageSearch}"</p>
                                      </>
                                    ) : (
                                      <p>No stages available</p>
                                    )}
                                  </div>
                                ) : (
                                  <div className="py-1">
                                    {filteredStages.map((stage) => (
                                      <button
                                        key={stage.id}
                                        type="button"
                                        onClick={() => {
                                          handleChange('pipelineStageId', stage.id);
                                          setShowStageDropdown(false);
                                          setStageSearch('');
                                        }}
                                        className="w-full px-3 py-2.5 text-left hover:bg-blue-50 transition-colors flex items-center justify-between gap-3 border-b border-gray-50 last:border-0"
                                      >
                                        <span className="text-sm font-medium text-gray-900">{stage.name}</span>
                                        {formData.pipelineStageId === stage.id && (
                                          <Check className="w-4 h-4 text-blue-600 shrink-0" />
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                          <select
                            value={formData.status}
                            onChange={(e) => handleChange('status', e.target.value)}
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900"
                          >
                            <option value="open">Open</option>
                            <option value="won">Won</option>
                            <option value="lost">Lost</option>
                            <option value="abandoned">Abandoned</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Opportunity Value</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">A$</span>
                            <input
                              type="number"
                              value={formData.monetaryValue}
                              onChange={(e) => handleChange('monetaryValue', parseFloat(e.target.value) || 0)}
                              className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900"
                              min={0}
                              step={0.01}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="relative col-span-1" ref={ownerDropdownRef}>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Owner</label>
                          {users.length === 0 ? (
                            <select
                              value={formData.assignedTo}
                              onChange={(e) => handleChange('assignedTo', e.target.value)}
                              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900"
                            >
                              <option value="">Unassigned</option>
                            </select>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => setShowOwnerDropdown(!showOwnerDropdown)}
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-left bg-white hover:bg-gray-50 transition-colors flex items-center justify-between"
                              >
                                <span className={formData.assignedTo ? 'text-gray-900' : 'text-gray-400'}>
                                  {selectedUser ? selectedUser.name : 'Unassigned'}
                                </span>
                                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showOwnerDropdown ? 'rotate-180' : ''}`} />
                              </button>
                              {showOwnerDropdown && (
                                <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl">
                                  <div className="p-2.5 border-b border-gray-100 bg-gray-50 rounded-t-lg">
                                    <div className="relative">
                                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                      <input
                                        type="text"
                                        value={ownerSearch}
                                        onChange={(e) => setOwnerSearch(e.target.value)}
                                        placeholder="Search users..."
                                        className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                                        onClick={(e) => e.stopPropagation()}
                                        autoFocus
                                      />
                                    </div>
                                  </div>
                                  <div className="max-h-60 overflow-y-auto py-1">
                                    {/* Unassigned option */}
                                    <button
                                      type="button"
                                      onClick={() => { handleChange('assignedTo', ''); setShowOwnerDropdown(false); setOwnerSearch(''); }}
                                      className="w-full px-3 py-2.5 text-left hover:bg-blue-50 transition-colors flex items-center justify-between gap-3 border-b border-gray-50"
                                    >
                                      <span className="text-sm text-gray-500 italic">Unassigned</span>
                                      {!formData.assignedTo && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                                    </button>
                                    {filteredUsers.map((user) => (
                                      <button
                                        key={user.id}
                                        type="button"
                                        onClick={() => { handleChange('assignedTo', user.id); setShowOwnerDropdown(false); setOwnerSearch(''); }}
                                        className="w-full px-3 py-2.5 text-left hover:bg-blue-50 transition-colors flex items-center justify-between gap-3 border-b border-gray-50 last:border-0"
                                      >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                          {user.profilePhoto ? (
                                            <img src={user.profilePhoto} alt={user.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
                                          ) : (
                                            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold shrink-0">
                                              {user.name.charAt(0).toUpperCase()}
                                            </div>
                                          )}
                                          <div className="min-w-0">
                                            <div className="text-sm font-medium text-gray-900 truncate">{user.name}</div>
                                            {user.email && <div className="text-xs text-gray-500 truncate">{user.email}</div>}
                                          </div>
                                        </div>
                                        {formData.assignedTo === user.id && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                                      </button>
                                    ))}
                                    {filteredUsers.length === 0 && ownerSearch && (
                                      <div className="px-4 py-6 text-center text-sm text-gray-500">No users found</div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        <div className="relative col-span-1" ref={followersDropdownRef}>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Followers</label>
                        <button
                          type="button"
                          onClick={() => setShowFollowersDropdown(!showFollowersDropdown)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-left bg-white hover:bg-gray-50 transition-colors flex items-center gap-2 min-w-0"
                        >
                          {selectedFollowers.length > 0 ? (() => {
                            const MAX_SHOW = 2;
                            const visible = selectedFollowers.slice(0, MAX_SHOW);
                            const overflow = selectedFollowers.length - MAX_SHOW;
                            return (
                              <span className="flex items-center gap-1.5 flex-1 min-w-0">
                                {visible.map(f => (
                                  <span key={f.id} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 max-w-[130px] shrink-0">
                                    {f.profilePhoto ? (
                                      <img src={f.profilePhoto} alt={f.name} className="w-5 h-5 rounded-full object-cover shrink-0" />
                                    ) : (
                                      <span className={`w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center shrink-0 ${avatarColour(f.name)}`}>
                                        {getInitials(f.name)}
                                      </span>
                                    )}
                                    <span className="text-xs text-gray-700 truncate font-medium">{f.name.split(' ')[0]}</span>
                                  </span>
                                ))}
                                {overflow > 0 && (
                                  <span
                                    ref={overflowFollowerRef}
                                    className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-medium cursor-default transition-colors shrink-0"
                                    onMouseEnter={e => {
                                      e.stopPropagation();
                                      const rect = overflowFollowerRef.current?.getBoundingClientRect();
                                      if (rect) setFollowerPanelPos({ top: rect.bottom + 8, left: rect.left });
                                      setShowFollowersPanel(true);
                                    }}
                                    onMouseLeave={() => setShowFollowersPanel(false)}
                                    onClick={e => e.stopPropagation()}
                                  >
                                    +{overflow}
                                  </span>
                                )}
                              </span>
                            );
                          })() : (
                            <span className="text-gray-400 flex-1">Add followers</span>
                          )}
                          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ml-auto ${showFollowersDropdown ? 'rotate-180' : ''}`} />
                        </button>

                        {showFollowersPanel && selectedFollowers.length > 0 && (
                          <div
                            style={{ position: 'fixed', top: followerPanelPos.top, left: followerPanelPos.left, zIndex: 9999, minWidth: '240px', maxWidth: '300px' }}
                            className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-2xl"
                            onMouseEnter={() => setShowFollowersPanel(true)}
                            onMouseLeave={() => setShowFollowersPanel(false)}
                          >
                            <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">All Followers ({selectedFollowers.length})</span>
                            </div>
                            <div className="p-1.5 flex flex-col gap-0.5">
                              {selectedFollowers.map(f => (
                                <div key={f.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50">
                                  {f.profilePhoto ? (
                                    <img src={f.profilePhoto} alt={f.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
                                  ) : (
                                    <span className={`w-7 h-7 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${avatarColour(f.name)}`}>
                                      {getInitials(f.name)}
                                    </span>
                                  )}
                                  <div className="flex flex-col min-w-0 flex-1">
                                    <span className="text-xs font-medium text-gray-800 truncate">{f.name}</span>
                                    {f.email && <span className="text-[10px] text-gray-400 truncate">{f.email}</span>}
                                  </div>
                                  <button type="button" onClick={() => setSelectedFollowers(prev => prev.filter(x => x.id !== f.id))} className="text-gray-300 hover:text-red-500 transition-colors text-sm leading-none shrink-0">&times;</button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {showFollowersDropdown && (
                          <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl">
                            <div className="p-2.5 border-b border-gray-100 bg-gray-50 rounded-t-lg">
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                  type="text"
                                  value={followerSearch}
                                  onChange={e => setFollowerSearch(e.target.value)}
                                  placeholder="Search users..."
                                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                                  onClick={e => e.stopPropagation()}
                                  autoFocus
                                />
                              </div>
                            </div>
                            <div className="max-h-60 overflow-y-auto py-1">
                              {users
                                .filter(u => u.name.toLowerCase().includes(followerSearch.toLowerCase()) || u.email.toLowerCase().includes(followerSearch.toLowerCase()))
                                .map(u => {
                                  const isSelected = selectedFollowers.some(f => f.id === u.id);
                                  return (
                                    <button
                                      key={u.id}
                                      type="button"
                                      onClick={() => setSelectedFollowers(prev => isSelected ? prev.filter(f => f.id !== u.id) : [...prev, u])}
                                      className={`w-full px-3 py-2.5 text-left transition-colors flex items-center justify-between gap-3 border-b border-gray-50 last:border-0 ${
                                        isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        {u.profilePhoto ? (
                                          <img src={u.profilePhoto} alt={u.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
                                        ) : (
                                          <span className={`w-7 h-7 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${avatarColour(u.name)}`}>
                                            {getInitials(u.name)}
                                          </span>
                                        )}
                                        <div className="min-w-0">
                                          <div className="text-sm font-medium text-gray-900 truncate">{u.name}</div>
                                          {u.email && <div className="text-xs text-gray-500 truncate">{u.email}</div>}
                                        </div>
                                      </div>
                                      {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                                    </button>
                                  );
                                })}
                              {users.filter(u => u.name.toLowerCase().includes(followerSearch.toLowerCase()) || u.email.toLowerCase().includes(followerSearch.toLowerCase())).length === 0 && (
                                <div className="px-4 py-6 text-center text-sm text-gray-500">No users found</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      </div>

                      {/* Tags */}
                      <div className="relative" ref={tagDropdownRef}>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Tags</label>
                          <div
                            className={`w-full min-h-[42px] px-3 py-1.5 border rounded-lg bg-white cursor-text flex flex-wrap gap-1.5 items-center transition-colors ${
                              showTagDropdown ? 'border-blue-500 ring-2 ring-blue-500' : 'border-gray-300 hover:border-gray-400'
                            }`}
                            onClick={() => setShowTagDropdown(true)}
                          >
                            {selectedTags.map(tag => (
                              <span key={tag} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md bg-gray-100 border border-gray-200 text-xs text-gray-700 font-medium">
                                {tag}
                                <button
                                  type="button"
                                  onClick={e => { e.stopPropagation(); setSelectedTags(prev => prev.filter(t => t !== tag)); }}
                                  className="text-gray-400 hover:text-red-500 transition-colors leading-none"
                                >&times;</button>
                              </span>
                            ))}
                            <ChevronDown className={`w-4 h-4 text-gray-400 ml-auto shrink-0 transition-transform ${showTagDropdown ? 'rotate-180' : ''}`} />
                          </div>

                          {showTagDropdown && (() => {
                            const lowerSearch = tagSearch.toLowerCase().trim();
                            const allKnown = Array.from(new Set([...locationTags, ...selectedTags]));
                            const filtered = allKnown.filter(t => t.toLowerCase().includes(lowerSearch));
                            const canCreate = lowerSearch && !allKnown.some(t => t.toLowerCase() === lowerSearch);
                            return (
                              <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl">
                                <div className="p-2.5 border-b border-gray-100 bg-gray-50 rounded-t-lg">
                                  <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                      type="text"
                                      value={tagSearch}
                                      onChange={e => setTagSearch(e.target.value)}
                                      placeholder="Search / create tags"
                                      className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                                      onClick={e => e.stopPropagation()}
                                      autoFocus
                                    />
                                  </div>
                                </div>
                                <div className="max-h-56 overflow-y-auto py-1">
                                  {canCreate && (
                                    <button
                                      type="button"
                                      onClick={() => { setSelectedTags(prev => [...prev, tagSearch.trim()]); setTagSearch(''); }}
                                      className="w-full px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                                    >
                                      <span className="text-blue-400 font-bold">+</span> Create &ldquo;{tagSearch.trim()}&rdquo;
                                    </button>
                                  )}
                                  {filtered.length === 0 && !canCreate && (
                                    <div className="px-4 py-6 text-center text-sm text-gray-400">No tags found</div>
                                  )}
                                  {filtered.map(tag => {
                                    const selected = selectedTags.includes(tag);
                                    return (
                                      <button
                                        key={tag}
                                        type="button"
                                        onClick={() => setSelectedTags(prev => selected ? prev.filter(t => t !== tag) : [...prev, tag])}
                                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between gap-2"
                                      >
                                        <span className="text-gray-800">{tag}</span>
                                        {selected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                    </div>

                  {/* Custom Fields shown inline in Opportunity Details tab */}
                  {detailsTabFields.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-gray-900 mt-5">Custom Fields</h3>
                      <div className="grid grid-cols-2 gap-4">
                        {loadingCustomFields ? (
                          <div className="col-span-2 flex items-center justify-center py-4">
                            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                            <span className="ml-2 text-sm text-gray-500">Loading custom fields...</span>
                          </div>
                        ) : (
                          detailsTabFields.map((cf) => renderCustomFieldInput(cf))
                        )}
                      </div>
                    </div>
                  )}

                  </div>
                </>
              )}

              {/* Folder tab panels – one per non-standard custom field folder */}
              {sidebarFolders.map((folder) => {
                if (activeTab !== `folder-${folder.id}`) return null;
                const folderFields = customFieldDefs.filter((cf) => cf.parentId === folder.id);
                return (
                  <div key={folder.id} className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-900">{folder.name}</h3>
                    {folderFields.length === 0 ? (
                      <p className="text-sm text-gray-500">No custom fields in this folder.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        {folderFields.map((cf) => renderCustomFieldInput(cf))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Ungrouped custom fields tab (only shown when folders exist) */}
              {activeTab === 'custom-fields' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-900">Custom Fields</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {customFieldDefs
                      .filter((cf) => !cf.parentId)
                      .map((cf) => renderCustomFieldInput(cf))}
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1 text-xs text-gray-600">
              {mode === 'edit' && initialData && initialData.createdAt ? (
                <>
                  <div>
                    Created on:{' '}
                    {new Date(initialData.createdAt as string).toLocaleString('en-AU', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                      timeZoneName: 'short',
                    })}
                  </div>
                  {initialData.internalSource && (initialData.internalSource as Record<string, unknown>).type ? (
                    <div className="flex items-center gap-4">
                      <span>Source: {String((initialData.internalSource as Record<string, unknown>).type)}</span>
                      {(initialData.internalSource as Record<string, unknown>).channel ? (
                        <span>Channel: {String((initialData.internalSource as Record<string, unknown>).channel)}</span>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              {mode === 'edit' && onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || isSubmitting || !formData.name}
                onClick={handleSubmit}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors text-sm"
              >
                {(loading || isSubmitting) ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {mode === 'create' ? 'Creating...' : 'Updating...'}
                  </>
                ) : (
                  mode === 'create' ? 'Create' : 'Update'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}