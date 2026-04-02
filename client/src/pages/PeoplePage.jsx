import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, apiUpload } from '../api.js';
import { GENDER_OPTIONS, LOCATION_SUGGESTIONS, MAIN_REASON_OPTIONS } from '../constants/options.js';
import { deletePersonMutation, updatePersonMutation } from '../utils/offlineData.js';
import { downloadFile } from '../utils/downloads.js';
import { buildPersonDisplayName } from '../utils/people.js';
import { normalizePermissions } from '../utils/permissions.js';
import ToastStack from '../components/common/ToastStack.jsx';
import ConfirmDialog from '../components/common/ConfirmDialog.jsx';
import CustomDropdown from '../components/common/CustomDropdown.jsx';
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
    surname: '',
    otherNames: '',
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
  const resolvedPermissions = normalizePermissions(permissions);
  const canEdit = resolvedPermissions.generalRegistration.edit;
  const canDelete = resolvedPermissions.generalRegistration.delete;
  const canImport = resolvedPermissions.generalRegistration.import;
  const canExport = resolvedPermissions.generalRegistration.export;
  const canCreate = resolvedPermissions.generalRegistration.create;

  function buildPersonDetailFromRow(person) {
    if (!person) return null;
    return {
      ...person,
      first_name: person.first_name || '',
      last_name: person.last_name || '',
      age: person.age ?? '',
      gender: person.gender || '',
      phone: person.phone || '',
      occupation: person.occupation || '',
      registration_source: person.registration_source || '',
      reason_for_coming: person.reason_for_coming || '',
      address_line1: person.address_line1 || '',
      email: person.email || '',
      program_year: person.program_year || programYear,
      registration_date: person.registration_date || new Date().toISOString()
    };
  }

  function showToast(text, type = 'success') {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 2800);
  }

  function hydrateEditForm(person) {
    setEditForm({
      surname: person.last_name || '',
      otherNames: person.first_name || person.other_names || '',
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
    const { showLoading = true, fallbackPerson = null } = options;
    const localFallback = buildPersonDetailFromRow(
      fallbackPerson || people.find((item) => item.id === personId)
    );

    if (showLoading) {
      setLoadingDetails(true);
    }
    setDetailsError(null);

    if (String(personId).startsWith('local-person:') && localFallback) {
      setPersonDetails(localFallback);
      hydrateEditForm(localFallback);
      if (showLoading) {
        setLoadingDetails(false);
      }
      return localFallback;
    }

    try {
      const res = await apiFetch(`/api/people/${personId}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const message = data.message || 'Unable to load person details.';

        if (localFallback) {
          setPersonDetails(localFallback);
          hydrateEditForm(localFallback);
        } else {
          setDetailsError(message);
          showToast(message, 'error');
        }

        if (showLoading) {
          setLoadingDetails(false);
        }
        return localFallback;
      }

      const data = await res.json();
      setPersonDetails(data);
      hydrateEditForm(data);

      if (showLoading) {
        setLoadingDetails(false);
      }

      return data;
    } catch {
      if (localFallback) {
        setPersonDetails(localFallback);
        hydrateEditForm(localFallback);
      } else {
        setDetailsError('Unable to load person details.');
      }

      if (showLoading) {
        setLoadingDetails(false);
      }

      return localFallback;
    }
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

    const payload = {
      firstName: editForm.otherNames,
      lastName: editForm.surname,
      otherNames: editForm.otherNames,
      age: editForm.age ? Number(editForm.age) : null,
      gender: editForm.gender || null,
      phone: editForm.phone || null,
      email: editForm.email || null,
      occupation: editForm.occupation || null,
      registrationSource: editForm.registrationSource || null,
      reasonForComing: editForm.reasonForComing || null,
      addressLine1: editForm.addressLine1 || null,
      programYear: editForm.programYear ? Number(editForm.programYear) : null,
      expectedUpdatedAt: personDetails.updated_at || undefined
    };

    const result = await updatePersonMutation(personDetails.id, payload, personDetails);

    if (!result.ok) {
      const data = await result.response?.json().catch(() => ({}));
      const message = data.message || 'Failed to save changes.';
      if (data.code === 'stale_record') {
        await fetchPersonDetails(personDetails.id, { showLoading: false });
        setEditing(false);
        setSaving(false);
        showToast(message, 'error');
        return;
      }

      setDetailsError(message);
      showToast(message, 'error');
      setSaving(false);
      return;
    }

    const optimisticDetails = result.queued
      ? buildPersonDetailFromRow({
        ...personDetails,
        first_name: payload.firstName,
        last_name: payload.lastName,
        other_names: payload.otherNames,
        age: payload.age,
        gender: payload.gender,
        phone: payload.phone,
        email: payload.email,
        occupation: payload.occupation,
        registration_source: payload.registrationSource,
        reason_for_coming: payload.reasonForComing,
        address_line1: payload.addressLine1,
        program_year: payload.programYear
      })
      : buildPersonDetailFromRow(await result.response.json());

    setPersonDetails(optimisticDetails);
    hydrateEditForm(optimisticDetails);
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

    const result = await deletePersonMutation(personDetails.id);

    if (!result.ok) {
      const data = await result.response?.json().catch(() => ({}));
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
      const fullName = buildPersonDisplayName(person).toLowerCase();
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
      const result = await deletePersonMutation(personId);

      if (result.ok) {
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
    try {
      const result = await downloadFile(path, filename);
      if (result.cancelled) return;
      if (successText) {
        showToast(successText);
      }
    } catch (error) {
      showToast(error.message || 'Download failed. Please try again.', 'error');
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
    try {
      const params = new URLSearchParams();
      if (filters.name) params.set('name', filters.name);
      if (filters.sex) params.set('gender', filters.sex);
      if (filters.location) params.set('location', filters.location);
      if (filters.reason) params.set('reason', filters.reason);
      if (programYear) params.set('year', programYear);

      const query = params.toString() ? `?${params.toString()}` : '';
      await downloadBlob(`/api/people/export${query}`, 'ewccomm25-registrations.xlsx', 'Export downloaded.');
    } finally {
      setExporting(false);
    }
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

    try {
      const res = await apiUpload('/api/people/import', formData);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.message || 'Import failed. Please check the sheet format.', 'error');
        return;
      }

      const data = await res.json().catch(() => ({}));
      const duplicateText = data.duplicates ? `, duplicates ${data.duplicates}` : '';
      showToast(`Imported ${data.inserted || 0} rows${data.skipped ? `, skipped ${data.skipped}` : ''}${duplicateText}.`);
      await onRefresh();
    } catch (error) {
      showToast(error.message || 'Import failed. Please check your connection and sheet format.', 'error');
    } finally {
      setImporting(false);
      event.target.value = '';
    }
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
            <CustomDropdown
              options={yearOptions.map((year) => ({ label: String(year), value: year }))}
              value={programYear}
              onChange={(nextValue) => onYearChange(Number(nextValue))}
              searchable
            />
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
            <CustomDropdown
              options={[{ label: 'All', value: '' }, ...GENDER_OPTIONS]}
              value={filters.sex}
              onChange={(nextValue) => updateFilter('sex', nextValue)}
              searchable
            />
          </label>
          <label>
            Location
            <CustomDropdown
              options={LOCATION_SUGGESTIONS}
              value={filters.location}
              onChange={(nextValue) => updateFilter('location', nextValue)}
              placeholder="Type or choose location"
              allowCustom
            />
          </label>
          <label>
            Main Reason
            <CustomDropdown
              options={[{ label: 'All', value: '' }, ...MAIN_REASON_OPTIONS]}
              value={filters.reason}
              onChange={(nextValue) => updateFilter('reason', nextValue)}
              searchable
            />
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
          message={`Delete ${buildPersonDisplayName(personDetails) || 'this record'} permanently?`}
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
