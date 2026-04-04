import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, apiUpload } from '../api.js';
import { NHIS_SITUATION_CASE_OPTIONS, getNhisDefaultAmount } from '../constants/options.js';
import { deleteNhisMutation, updateNhisMutation } from '../utils/offlineData.js';
import { downloadFile } from '../utils/downloads.js';
import { buildFullName, buildNhisDisplayName, splitNameFields } from '../utils/people.js';
import { normalizePermissions } from '../utils/permissions.js';
import ToastStack from '../components/common/ToastStack.jsx';
import ConfirmDialog from '../components/common/ConfirmDialog.jsx';
import CustomDropdown from '../components/common/CustomDropdown.jsx';
import Pagination from '../components/common/Pagination.jsx';
import NhisTable from '../components/nhis/NhisTable.jsx';
import NhisDetailsModal from '../components/nhis/NhisDetailsModal.jsx';

export default function NhisRegistrationPage({
  records,
  pagination,
  onRefresh,
  programYear,
  yearOptions,
  onYearChange,
  onNew,
  permissions,
  onPageChange
}) {
  const [filters, setFilters] = useState({
    name: '',
    situation: ''
  });
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [recordDetails, setRecordDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedRecordIds, setSelectedRecordIds] = useState([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [editForm, setEditForm] = useState({
    surname: '',
    otherNames: '',
    situationCase: '',
    amount: '',
    programYear
  });

  const fileInputRef = useRef(null);
  const resolvedPermissions = normalizePermissions(permissions);
  const canEdit = resolvedPermissions.nhisRegistration.edit;
  const canDelete = resolvedPermissions.nhisRegistration.delete;
  const canImport = resolvedPermissions.nhisRegistration.import;
  const canExport = resolvedPermissions.nhisRegistration.export;
  const canCreate = resolvedPermissions.nhisRegistration.create;

  function formatCurrency(amount) {
    const value = Number(amount || 0);
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  function buildRecordDetailFromRow(record) {
    if (!record) return null;
    return {
      ...record,
      full_name: record.full_name || '',
      situation_case: record.situation_case || '',
      amount: record.amount ?? '',
      program_year: record.program_year || programYear,
      registration_date: record.registration_date || new Date().toISOString()
    };
  }

  function showToast(text, type = 'success') {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 2800);
  }

  function hydrateEditForm(record) {
    const { surname, otherNames } = splitNameFields(record.full_name || '');
    setEditForm({
      surname,
      otherNames,
      situationCase: record.situation_case || '',
      amount: record.amount ?? '',
      programYear: record.program_year || programYear
    });
  }

  async function fetchRecordDetails(recordId, options = {}) {
    const { showLoading = true, fallbackRecord = null } = options;
    const localFallback = buildRecordDetailFromRow(
      fallbackRecord || records.find((item) => item.id === recordId)
    );

    if (showLoading) {
      setLoadingDetails(true);
    }
    setDetailsError(null);

    if (String(recordId).startsWith('local-nhis:') && localFallback) {
      setRecordDetails(localFallback);
      hydrateEditForm(localFallback);
      if (showLoading) {
        setLoadingDetails(false);
      }
      return localFallback;
    }

    try {
      const res = await apiFetch(`/api/nhis/${recordId}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const message = data.message || 'Unable to load NHIS record details.';

        if (localFallback) {
          setRecordDetails(localFallback);
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
      setRecordDetails(data);
      hydrateEditForm(data);

      if (showLoading) {
        setLoadingDetails(false);
      }

      return data;
    } catch {
      if (localFallback) {
        setRecordDetails(localFallback);
        hydrateEditForm(localFallback);
      } else {
        setDetailsError('Unable to load NHIS record details.');
      }

      if (showLoading) {
        setLoadingDetails(false);
      }

      return localFallback;
    }
  }

  async function openRecordDetails(recordId) {
    setSelectedRecordId(recordId);
    setEditing(false);
    await fetchRecordDetails(recordId);
  }

  function closeRecordDetails() {
    setSelectedRecordId(null);
    setRecordDetails(null);
    setLoadingDetails(false);
    setDetailsError(null);
    setEditing(false);
    setShowDeleteConfirm(false);
  }

  async function handleSaveDetails(event) {
    event.preventDefault();
    if (!recordDetails) return;
    if (!canEdit) {
      showToast('You do not have permission to edit records.', 'error');
      return;
    }

    setSaving(true);
    setDetailsError(null);

    const payload = {
      fullName: buildFullName(editForm.otherNames, editForm.surname),
      situationCase: editForm.situationCase || null,
      amount: editForm.amount,
      programYear: editForm.programYear ? Number(editForm.programYear) : null,
      expectedUpdatedAt: recordDetails.updated_at || undefined
    };

    const result = await updateNhisMutation(recordDetails.id, payload, recordDetails);

    if (!result.ok) {
      const data = await result.response?.json().catch(() => ({}));
      const message = data.message || 'Failed to save changes.';
      if (data.code === 'stale_record') {
        await fetchRecordDetails(recordDetails.id, { showLoading: false });
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
      ? buildRecordDetailFromRow({
        ...recordDetails,
        full_name: payload.fullName,
        surname: editForm.surname,
        other_names: editForm.otherNames,
        situation_case: payload.situationCase,
        amount: payload.amount,
        program_year: payload.programYear
      })
      : buildRecordDetailFromRow(await result.response.json());

    setRecordDetails(optimisticDetails);
    hydrateEditForm(optimisticDetails);
    setSaving(false);
    setEditing(false);
    showToast('Information updated.');
    await onRefresh();
  }

  async function confirmDeleteRecord() {
    if (!recordDetails) return;
    if (!canDelete) {
      showToast('You do not have permission to delete records.', 'error');
      return;
    }

    setDeleting(true);
    setDetailsError(null);

    const result = await deleteNhisMutation(recordDetails.id);

    if (!result.ok) {
      const data = await result.response?.json().catch(() => ({}));
      const message = data.message || 'Failed to delete record.';
      setDetailsError(message);
      showToast(message, 'error');
      setDeleting(false);
      return;
    }

    setDeleting(false);
    setShowDeleteConfirm(false);
    setSelectedRecordIds((prev) => prev.filter((id) => id !== recordDetails.id));
    closeRecordDetails();
    showToast('NHIS record deleted successfully.');
    await onRefresh();
  }

  function updateFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function updateEditForm(key, value) {
    if (key === 'situationCase') {
      const defaultAmount = getNhisDefaultAmount(value);
      setEditForm((prev) => ({
        ...prev,
        situationCase: value,
        amount: value ? String(defaultAmount ?? prev.amount ?? '') : ''
      }));
      return;
    }

    setEditForm((prev) => ({ ...prev, [key]: value }));
  }

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const name = buildNhisDisplayName(record).toLowerCase();
      const situation = String(record.situation_case || '').toLowerCase();

      const nameMatch = !filters.name || name.includes(filters.name.toLowerCase().trim());
      const situationMatch = !filters.situation || situation.includes(filters.situation.toLowerCase().trim());

      return nameMatch && situationMatch;
    });
  }, [records, filters]);

  const totalAmount = useMemo(
    () => filteredRecords.reduce((sum, record) => {
      const amount = Number(record.amount);
      return Number.isFinite(amount) ? sum + amount : sum;
    }, 0),
    [filteredRecords]
  );

  useEffect(() => {
    const visibleIds = new Set(filteredRecords.map((record) => record.id));
    setSelectedRecordIds((prev) => prev.filter((id) => visibleIds.has(id)));
  }, [filteredRecords]);

  function toggleSelectRecord(recordId) {
    if (!canDelete) return;

    setSelectedRecordIds((prev) => (
      prev.includes(recordId)
        ? prev.filter((id) => id !== recordId)
        : [...prev, recordId]
    ));
  }

  function toggleSelectAllRecords(event) {
    if (!canDelete) return;

    const visibleIds = filteredRecords.map((record) => record.id);
    setSelectedRecordIds(event.target.checked ? visibleIds : []);
  }

  async function confirmBulkDeleteRecords() {
    if (!canDelete || !selectedRecordIds.length) {
      setShowBulkDeleteConfirm(false);
      return;
    }

    const idsToDelete = [...selectedRecordIds];
    let deletedCount = 0;
    const failedIds = [];

    setBulkDeleting(true);

    for (const recordId of idsToDelete) {
      const result = await deleteNhisMutation(recordId);

      if (result.ok) {
        deletedCount += 1;
      } else {
        failedIds.push(recordId);
      }
    }

    setBulkDeleting(false);
    setShowBulkDeleteConfirm(false);
    setSelectedRecordIds(failedIds);

    if (deletedCount > 0) {
      showToast(`Deleted ${deletedCount} NHIS record${deletedCount === 1 ? '' : 's'}.`);
      await onRefresh();
    }

    if (failedIds.length > 0) {
      showToast(
        `Failed to delete ${failedIds.length} NHIS record${failedIds.length === 1 ? '' : 's'}.`,
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
    await downloadBlob('/api/nhis/template', 'ewccomm25-nhis-template.xlsx', 'Template downloaded.');
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
      if (filters.situation) params.set('situation', filters.situation);
      if (programYear) params.set('year', programYear);

      const query = params.toString() ? `?${params.toString()}` : '';
      await downloadBlob('/api/nhis/export' + query, 'ewccomm25-nhis-registrations.xlsx', 'Export downloaded.');
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
      const res = await apiUpload('/api/nhis/import', formData);

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
                New NHIS Registration
              </button>
            )}
            <div className="page-total-pill" title="Total amount for the current NHIS view">
              {formatCurrency(totalAmount)}
            </div>
          </div>
          <div className="panel-actions record-panel-actions">
            <div className="record-file-actions">
              <button className="ghost" onClick={handleTemplateDownload}>Download Template</button>
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
                <button className="ghost" onClick={handleExport} disabled={exporting}>
                  {exporting ? 'Exporting...' : 'Export'}
                </button>
              )}
            </div>
            {canDelete && selectedRecordIds.length > 0 && (
              <button
                className="danger"
                onClick={() => setShowBulkDeleteConfirm(true)}
                disabled={bulkDeleting}
              >
                {bulkDeleting
                  ? 'Deleting...'
                  : `Delete Selected (${selectedRecordIds.length})`}
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
            Situation/Case
            <CustomDropdown
              options={[{ label: 'All situations/cases', value: '' }, ...NHIS_SITUATION_CASE_OPTIONS]}
              value={filters.situation}
              onChange={(nextValue) => updateFilter('situation', nextValue)}
              searchable
              panelMinWidth={460}
            />
          </label>
        </div>

        <NhisTable
          records={filteredRecords}
          onView={openRecordDetails}
          canDelete={canDelete}
          selectedIds={selectedRecordIds}
          onToggleSelect={toggleSelectRecord}
          onToggleSelectAll={toggleSelectAllRecords}
        />

        <Pagination
          page={pagination?.page}
          pageSize={pagination?.pageSize}
          total={pagination?.total}
          totalPages={pagination?.totalPages}
          onPageChange={onPageChange}
        />
      </div>

      <ToastStack
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((toast) => toast.id !== id))}
      />

      {selectedRecordId && (
        <NhisDetailsModal
          record={recordDetails}
          loading={loadingDetails}
          error={detailsError}
          editing={editing}
          form={editForm}
          yearOptions={yearOptions}
          onFormChange={updateEditForm}
          onStartEdit={() => {
            if (!canEdit) return;
            if (recordDetails) hydrateEditForm(recordDetails);
            setEditing(true);
          }}
          onCancelEdit={() => {
            if (recordDetails) hydrateEditForm(recordDetails);
            setEditing(false);
            setDetailsError(null);
          }}
          onSave={handleSaveDetails}
          onDelete={() => {
            if (!canDelete) return;
            setShowDeleteConfirm(true);
          }}
          onClose={closeRecordDetails}
          saving={saving}
          deleting={deleting}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}

      {showDeleteConfirm && recordDetails && canDelete && (
        <ConfirmDialog
          title="Delete NHIS Record"
          message={`Delete ${buildNhisDisplayName(recordDetails) || 'this record'} permanently?`}
          confirmLabel={deleting ? 'Deleting...' : 'Delete'}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={confirmDeleteRecord}
          danger
          busy={deleting}
        />
      )}

      {showBulkDeleteConfirm && canDelete && (
        <ConfirmDialog
          title="Delete Selected NHIS Records"
          message={`Delete ${selectedRecordIds.length} selected NHIS record${selectedRecordIds.length === 1 ? '' : 's'} permanently?`}
          confirmLabel={bulkDeleting ? 'Deleting...' : 'Delete Selected'}
          onCancel={() => setShowBulkDeleteConfirm(false)}
          onConfirm={confirmBulkDeleteRecords}
          danger
          busy={bulkDeleting}
        />
      )}
    </section>
  );
}
