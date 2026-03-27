import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, getStoredTokens } from '../api.js';
import { GENDER_OPTIONS, MAIN_REASON_OPTIONS } from '../constants/options.js';
import { splitFullName } from '../utils/people.js';
import { normalizePermissions } from '../utils/permissions.js';
import ToastStack from '../components/common/ToastStack.jsx';
import ConfirmDialog from '../components/common/ConfirmDialog.jsx';
import PeopleTable from '../components/people/PeopleTable.jsx';
import PeopleDetailsModal from '../components/people/PeopleDetailsModal.jsx';

export default function PeoplePage({
  people,
  onRefresh,
  programYear,
  yearOptions,
  onYearChange,
  onNew,
  permissions
}) {
  const [filters, setFilters] = useState({
    name: '',
    sex: '',
    location: '',
    reason: ''
  });
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  const [personDetails, setPersonDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedPeopleIds, setSelectedPeopleIds] = useState([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: '',
    age: '',
    gender: '',
    phone: '',
    occupation: '',
    registrationSource: '',
    reasonForComing: '',
    addressLine1: '',
    email: '',
    programYear
  });

  const fileInputRef = useRef(null);
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:4000';
  const resolvedPermissions = normalizePermissions(permissions);
  const canEdit = resolvedPermissions.generalRegistration.edit;
  const canDelete = resolvedPermissions.generalRegistration.delete;
  const canImport = resolvedPermissions.generalRegistration.import;
  const canExport = resolvedPermissions.generalRegistration.export;
  const canCreate = resolvedPermissions.generalRegistration.create;

  function showToast(text, type = 'success') {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 2800);
  }

  function hydrateEditForm(person) {
    setEditForm({
      fullName: `${person.first_name || ''} ${person.last_name || ''}`.trim(),
      age: person.age || '',
      gender: person.gender || '',
      phone: person.phone || '',
      occupation: person.occupation || '',
      registrationSource: person.registration_source || '',
      reasonForComing: person.reason_for_coming || '',
      addressLine1: person.address_line1 || '',
      email: person.email || '',
      programYear: person.program_year || programYear
    });
  }

  async function fetchPersonDetails(personId, options = {}) {
    const { showLoading = true } = options;

    if (showLoading) {
      setLoadingDetails(true);
    }
    setDetailsError(null);

    const res = await apiFetch(`/api/people/${personId}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const message = data.message || 'Unable to load person details.';
      setDetailsError(message);
      showToast(message, 'error');
      if (showLoading) {
        setLoadingDetails(false);
      }
      return null;
    }

    const data = await res.json();
    setPersonDetails(data);
    hydrateEditForm(data);

    if (showLoading) {
      setLoadingDetails(false);
    }

    return data;
  }

  async function openPersonDetails(personId) {
    setSelectedPersonId(personId);
    setEditing(false);
    await fetchPersonDetails(personId);
  }

  function closePersonDetails() {
    setSelectedPersonId(null);
    setPersonDetails(null);
    setLoadingDetails(false);
    setDetailsError(null);
    setEditing(false);
    setShowDeleteConfirm(false);
  }

  async function handleSaveDetails(event) {
    event.preventDefault();
    if (!personDetails) return;
    if (!canEdit) {
      showToast('You do not have permission to edit records.', 'error');
      return;
    }

    setSaving(true);
    setDetailsError(null);

    const { firstName, lastName } = splitFullName(editForm.fullName);
    const payload = {
      firstName,
      lastName,
      age: editForm.age ? Number(editForm.age) : null,
      gender: editForm.gender || null,
      phone: editForm.phone || null,
      email: editForm.email || null,
      occupation: editForm.occupation || null,
      registrationSource: editForm.registrationSource || null,
      reasonForComing: editForm.reasonForComing || null,
      addressLine1: editForm.addressLine1 || null,
      programYear: editForm.programYear ? Number(editForm.programYear) : null
    };

    const res = await apiFetch(`/api/people/${personDetails.id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const message = data.message || 'Failed to save changes.';
      setDetailsError(message);
      showToast(message, 'error');
      setSaving(false);
      return;
    }

    await fetchPersonDetails(personDetails.id, { showLoading: false });
    setSaving(false);
    setEditing(false);
    showToast('Information updated.');
    await onRefresh();
  }

  async function confirmDeletePerson() {
    if (!personDetails) return;
    if (!canDelete) {
      showToast('You do not have permission to delete records.', 'error');
      return;
    }

    setDeleting(true);
    setDetailsError(null);

    const res = await apiFetch(`/api/people/${personDetails.id}`, {
      method: 'DELETE'
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const message = data.message || 'Failed to delete person.';
      setDetailsError(message);
      showToast(message, 'error');
      setDeleting(false);
      return;
    }

    setDeleting(false);
    setShowDeleteConfirm(false);
    setSelectedPeopleIds((prev) => prev.filter((id) => id !== personDetails.id));
    closePersonDetails();
    showToast('Person deleted successfully.');
    await onRefresh();
  }

  function updateFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  const filteredPeople = useMemo(() => {
    return people.filter((person) => {
      const fullName = `${person.first_name || ''} ${person.last_name || ''}`.trim().toLowerCase();
      const sex = String(person.gender || '').toLowerCase();
      const location = `${person.address_line1 || ''} ${person.city || ''} ${person.region || ''}`.toLowerCase();
      const reason = String(person.reason_for_coming || '').toLowerCase();

      const nameMatch = !filters.name || fullName.includes(filters.name.toLowerCase().trim());
      const sexMatch = !filters.sex || sex === filters.sex.toLowerCase();
      const locationMatch = !filters.location || location.includes(filters.location.toLowerCase().trim());
      const reasonMatch = !filters.reason || reason === filters.reason.toLowerCase();

      return nameMatch && sexMatch && locationMatch && reasonMatch;
    });
  }, [people, filters]);

  useEffect(() => {
    const visibleIds = new Set(filteredPeople.map((person) => person.id));
    setSelectedPeopleIds((prev) => prev.filter((id) => visibleIds.has(id)));
  }, [filteredPeople]);

  function toggleSelectPerson(personId) {
    if (!canDelete) return;

    setSelectedPeopleIds((prev) => (
      prev.includes(personId)
        ? prev.filter((id) => id !== personId)
        : [...prev, personId]
    ));
  }

  function toggleSelectAllPeople(event) {
    if (!canDelete) return;

    const visibleIds = filteredPeople.map((person) => person.id);
    setSelectedPeopleIds(event.target.checked ? visibleIds : []);
  }

  async function confirmBulkDeletePeople() {
    if (!canDelete || !selectedPeopleIds.length) {
      setShowBulkDeleteConfirm(false);
      return;
    }

    const idsToDelete = [...selectedPeopleIds];
    let deletedCount = 0;
    const failedIds = [];

    setBulkDeleting(true);

    for (const personId of idsToDelete) {
      const res = await apiFetch(`/api/people/${personId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        deletedCount += 1;
      } else {
        failedIds.push(personId);
      }
    }

    setBulkDeleting(false);
    setShowBulkDeleteConfirm(false);
    setSelectedPeopleIds(failedIds);

    if (deletedCount > 0) {
      showToast(`Deleted ${deletedCount} registration${deletedCount === 1 ? '' : 's'}.`);
      await onRefresh();
    }

    if (failedIds.length > 0) {
      showToast(
        `Failed to delete ${failedIds.length} registration${failedIds.length === 1 ? '' : 's'}.`,
        'error'
      );
    }
  }

  async function downloadBlob(path, filename, successText) {
    const res = await apiFetch(path);
    if (!res.ok) {
      showToast('Download failed. Please try again.', 'error');
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);

    if (successText) {
      showToast(successText);
    }
  }

  async function handleTemplateDownload() {
    await downloadBlob('/api/people/template', 'ewccomm25-registration-template.xlsx', 'Template downloaded.');
  }

  async function handleExport() {
    if (!canExport) {
      showToast('You do not have permission to export records.', 'error');
      return;
    }

    setExporting(true);

    const params = new URLSearchParams();
    if (filters.name) params.set('name', filters.name);
    if (filters.sex) params.set('gender', filters.sex);
    if (filters.location) params.set('location', filters.location);
    if (filters.reason) params.set('reason', filters.reason);
    if (programYear) params.set('year', programYear);

    const query = params.toString() ? `?${params.toString()}` : '';
    await downloadBlob(`/api/people/export${query}`, 'ewccomm25-registrations.xlsx', 'Export downloaded.');

    setExporting(false);
  }

  async function handleImport(event) {
    if (!canImport) {
      showToast('You do not have permission to import records.', 'error');
      event.target.value = '';
      return;
    }

    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);

    const formData = new FormData();
    formData.append('file', file);
    if (programYear) {
      formData.append('year', programYear);
    }

    const { accessToken } = getStoredTokens();
    const res = await fetch(`${apiBase}/api/people/import`, {
      method: 'POST',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      body: formData
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(data.message || 'Import failed. Please check the sheet format.', 'error');
      setImporting(false);
      event.target.value = '';
      return;
    }

    const data = await res.json().catch(() => ({}));
    const duplicateText = data.duplicates ? `, duplicates ${data.duplicates}` : '';
    showToast(`Imported ${data.inserted || 0} rows${data.skipped ? `, skipped ${data.skipped}` : ''}${duplicateText}.`);
    setImporting(false);
    event.target.value = '';
    await onRefresh();
  }

  return (
    <section className="page">
      <div className="panel">
        <div className="panel-header">
          <div className="panel-header-lead">
            {canCreate && (
              <button className="primary header-new-button" onClick={() => onNew?.()}>
                New General Registration
              </button>
            )}
          </div>
          <div className="panel-actions">
            <button className="ghost" onClick={handleTemplateDownload}>Download Template</button>
            {canDelete && selectedPeopleIds.length > 0 && (
              <button
                className="danger"
                onClick={() => setShowBulkDeleteConfirm(true)}
                disabled={bulkDeleting}
              >
                {bulkDeleting
                  ? 'Deleting...'
                  : `Delete Selected (${selectedPeopleIds.length})`}
              </button>
            )}
            {canImport && (
              <>
                <button
                  className="ghost"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                >
                  {importing ? 'Importing...' : 'Import Sheet'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleImport}
                  style={{ display: 'none' }}
                />
              </>
            )}
            {canExport && (
              <button className="primary" onClick={handleExport} disabled={exporting}>
                {exporting ? 'Exporting...' : 'Export'}
              </button>
            )}
          </div>
        </div>

        <div className="filter-grid">
          <label>
            Year
            <select
              value={programYear}
              onChange={(event) => onYearChange(Number(event.target.value))}
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </label>
          <label>
            Name
            <input
              value={filters.name}
              onChange={(event) => updateFilter('name', event.target.value)}
              placeholder="Filter by name"
            />
          </label>
          <label>
            Sex
            <select
              value={filters.sex}
              onChange={(event) => updateFilter('sex', event.target.value)}
            >
              <option value="">All</option>
              {GENDER_OPTIONS.map((gender) => (
                <option key={gender} value={gender}>{gender}</option>
              ))}
            </select>
          </label>
          <label>
            Location / Address
            <input
              value={filters.location}
              onChange={(event) => updateFilter('location', event.target.value)}
              placeholder="Search location"
            />
          </label>
          <label>
            Main Reason
            <select
              value={filters.reason}
              onChange={(event) => updateFilter('reason', event.target.value)}
            >
              <option value="">All</option>
              {MAIN_REASON_OPTIONS.map((reason) => (
                <option key={reason} value={reason}>{reason}</option>
              ))}
            </select>
          </label>
        </div>

        <PeopleTable
          people={filteredPeople}
          onView={openPersonDetails}
          canDelete={canDelete}
          selectedIds={selectedPeopleIds}
          onToggleSelect={toggleSelectPerson}
          onToggleSelectAll={toggleSelectAllPeople}
        />
      </div>

      <ToastStack
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((toast) => toast.id !== id))}
      />

      {selectedPersonId && (
        <PeopleDetailsModal
          person={personDetails}
          loading={loadingDetails}
          error={detailsError}
          editing={editing}
          form={editForm}
          yearOptions={yearOptions}
          onFormChange={(key, value) => setEditForm((prev) => ({ ...prev, [key]: value }))}
          onStartEdit={() => {
            if (!canEdit) return;
            if (personDetails) hydrateEditForm(personDetails);
            setEditing(true);
          }}
          onCancelEdit={() => {
            if (personDetails) hydrateEditForm(personDetails);
            setEditing(false);
            setDetailsError(null);
          }}
          onSave={handleSaveDetails}
          onDelete={() => {
            if (!canDelete) return;
            setShowDeleteConfirm(true);
          }}
          onClose={closePersonDetails}
          saving={saving}
          deleting={deleting}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}

      {showDeleteConfirm && personDetails && canDelete && (
        <ConfirmDialog
          title="Delete Person"
          message={`Delete ${personDetails.first_name || ''} ${personDetails.last_name || ''} permanently?`}
          confirmLabel={deleting ? 'Deleting...' : 'Delete'}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={confirmDeletePerson}
          danger
          busy={deleting}
        />
      )}

      {showBulkDeleteConfirm && canDelete && (
        <ConfirmDialog
          title="Delete Selected Registrations"
          message={`Delete ${selectedPeopleIds.length} selected registration${selectedPeopleIds.length === 1 ? '' : 's'} permanently?`}
          confirmLabel={bulkDeleting ? 'Deleting...' : 'Delete Selected'}
          onCancel={() => setShowBulkDeleteConfirm(false)}
          onConfirm={confirmBulkDeletePeople}
          danger
          busy={bulkDeleting}
        />
      )}
    </section>
  );
}
