import React, { useState, useMemo } from 'react';
import {
  MapPin,
  FileSpreadsheet,
  Plus,
  Search,
  Upload,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  Layers,
  Check,
  X,
  Loader2,
} from 'lucide-react';
import { GlassButton } from '@/components/GlassButton';
import { GlassInput } from '@/components/GlassInput';
import {
  useStates,
  useDistricts,
  useBlocks,
  useCreateState,
  useCreateDistrict,
  useCreateBlock,
  useImportLocationExcel,
} from '../hooks/useLocations';
import { ImportSummary } from '../types';

export const AdminLocationManager: React.FC = () => {
  const [selectedStateId, setSelectedStateId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDistrictId, setExpandedDistrictId] = useState<string | null>(null);

  // Modals state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAddStateModalOpen, setIsAddStateModalOpen] = useState(false);
  const [isAddDistrictModalOpen, setIsAddDistrictModalOpen] = useState(false);
  const [isAddBlockModalOpen, setIsAddBlockModalOpen] = useState(false);

  // Form states
  const [newStateName, setNewStateName] = useState('');
  const [newStateCode, setNewStateCode] = useState('');
  const [newDistrictName, setNewDistrictName] = useState('');
  const [newDistrictCode, setNewDistrictCode] = useState('');
  const [targetDistrictIdForBlock, setTargetDistrictIdForBlock] = useState('');
  const [newBlockName, setNewBlockName] = useState('');
  const [newBlockCode, setNewBlockCode] = useState('');

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importStateName, setImportStateName] = useState('Rajasthan');
  const [importStateCode, setImportStateCode] = useState('RJ');
  const [importResult, setImportResult] = useState<ImportSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Queries
  const { data: states = [], isLoading: isLoadingStates } = useStates(true);

  // Set default selected state
  React.useEffect(() => {
    if (!selectedStateId && states.length > 0) {
      const defaultState = states.find((s) => s.name.toLowerCase() === 'rajasthan') || states[0];
      setSelectedStateId(defaultState.id);
    }
  }, [states, selectedStateId]);

  const { data: districts = [], isLoading: isLoadingDistricts } = useDistricts(selectedStateId, true);

  const selectedState = useMemo(() => {
    return states.find((s) => s.id === selectedStateId);
  }, [states, selectedStateId]);

  // Fetch blocks for expanded district
  const { data: expandedBlocks = [], isLoading: isLoadingExpandedBlocks } = useBlocks({
    districtIds: expandedDistrictId ? [expandedDistrictId] : [],
    all: true,
  });

  // Filtered districts
  const filteredDistricts = useMemo(() => {
    if (!searchQuery.trim()) return districts;
    const q = searchQuery.toLowerCase().trim();
    return districts.filter((d) => d.name.toLowerCase().includes(q));
  }, [districts, searchQuery]);

  // Mutations
  const createStateMutation = useCreateState();
  const createDistrictMutation = useCreateDistrict();
  const createBlockMutation = useCreateBlock();
  const importExcelMutation = useImportLocationExcel();

  // Handlers
  const handleCreateState = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStateName.trim()) return;
    try {
      const created = await createStateMutation.mutateAsync({
        name: newStateName.trim(),
        code: newStateCode.trim() || undefined,
        is_active: true,
      });
      setSelectedStateId(created.id);
      setNewStateName('');
      setNewStateCode('');
      setIsAddStateModalOpen(false);
    } catch {
      // error handled by react-query
    }
  };

  const handleCreateDistrict = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDistrictName.trim() || !selectedStateId) return;
    try {
      await createDistrictMutation.mutateAsync({
        stateId: selectedStateId,
        payload: {
          name: newDistrictName.trim(),
          code: newDistrictCode.trim() || undefined,
          is_active: true,
        },
      });
      setNewDistrictName('');
      setNewDistrictCode('');
      setIsAddDistrictModalOpen(false);
    } catch {
      // error handled by react-query
    }
  };

  const handleCreateBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlockName.trim() || !targetDistrictIdForBlock) return;
    try {
      await createBlockMutation.mutateAsync({
        districtId: targetDistrictIdForBlock,
        payload: {
          name: newBlockName.trim(),
          code: newBlockCode.trim() || undefined,
          is_active: true,
        },
      });
      setNewBlockName('');
      setNewBlockCode('');
      setIsAddBlockModalOpen(false);
    } catch {
      // error handled by react-query
    }
  };

  const handleRunImport = async (dryRun: boolean) => {
    if (!importFile) {
      setImportError('Please select an Excel file (.xlsx) to import.');
      return;
    }
    setImportError(null);
    const formData = new FormData();
    formData.append('file', importFile);
    formData.append('state_name', importStateName.trim() || 'Rajasthan');
    formData.append('state_code', importStateCode.trim() || 'RJ');
    if (dryRun) {
      formData.append('dry_run', 'true');
    }

    try {
      const summary = await importExcelMutation.mutateAsync(formData);
      setImportResult(summary);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to process Excel import. Please check file formatting.';
      setImportError(msg);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner and Actions */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-indigo-600" />
            <span>Location Master & Territory Management</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Maintain database-backed administrative States, Districts, and Blocks for candidate allocations.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <GlassButton
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setImportResult(null);
              setImportError(null);
              setIsImportModalOpen(true);
            }}
            leftIcon={<Upload className="w-3.5 h-3.5 text-indigo-700" />}
          >
            Import Excel Workbook
          </GlassButton>

          <GlassButton
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setIsAddDistrictModalOpen(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Add District
          </GlassButton>
        </div>
      </div>

      {/* Explorer Controls: State Selector & Search */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* State Selector */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Active State / Circle
          </label>
          <div className="flex items-center gap-2">
            <select
              value={selectedStateId}
              onChange={(e) => {
                setSelectedStateId(e.target.value);
                setExpandedDistrictId(null);
              }}
              className="w-full h-9 px-3 rounded-xl border border-slate-200 text-xs font-semibold bg-white text-slate-800 outline-none focus:border-indigo-500"
              disabled={isLoadingStates}
            >
              {states.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name} {st.code ? `(${st.code})` : ''} — {st.districts_count || 0} Districts
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setIsAddStateModalOpen(true)}
              className="p-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-600 transition-colors"
              title="Add New State"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search District */}
        <div className="sm:col-span-2 space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Search Districts in {selectedState?.name || 'State'}
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by district name..."
              className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 text-xs bg-white text-slate-800 outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Overview Stat Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
          <span className="text-[11px] text-slate-400 block font-medium">Selected State</span>
          <span className="text-sm font-bold text-slate-800">{selectedState?.name || '—'}</span>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
          <span className="text-[11px] text-slate-400 block font-medium">Total Districts</span>
          <span className="text-sm font-bold text-slate-800">{districts.length}</span>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
          <span className="text-[11px] text-slate-400 block font-medium">Total Blocks</span>
          <span className="text-sm font-bold text-slate-800">
            {districts.reduce((acc, d) => acc + (d.blocks_count || 0), 0)}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/70">
          <span className="text-[11px] text-emerald-700 block font-medium">Master Status</span>
          <span className="text-sm font-bold text-emerald-800">Verified & Active</span>
        </div>
      </div>

      {/* Districts & Blocks List */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
        <div className="p-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>
              Districts & Blocks ({filteredDistricts.length} {filteredDistricts.length === 1 ? 'district' : 'districts'})
            </span>
          </div>
          <span className="text-[11px] font-normal text-slate-500">
            Click district to view & manage mapped blocks
          </span>
        </div>

        {isLoadingDistricts ? (
          <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
            <span>Loading district records...</span>
          </div>
        ) : filteredDistricts.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No districts found. Click &quot;Add District&quot; or &quot;Import Excel Workbook&quot; to populate.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
            {filteredDistricts.map((district) => {
              const isExpanded = expandedDistrictId === district.id;
              return (
                <div key={district.id} className="transition-colors">
                  {/* District Row Header */}
                  <div
                    onClick={() => setExpandedDistrictId(isExpanded ? null : district.id)}
                    className="p-3 flex items-center justify-between hover:bg-slate-50/80 cursor-pointer text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-indigo-600 shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span className="font-semibold text-slate-900">{district.name}</span>
                      {district.code && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                          {district.code}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[11px] font-medium text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        {district.blocks_count || 0} blocks
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTargetDistrictIdForBlock(district.id);
                          setIsAddBlockModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-indigo-700 font-semibold px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Block</span>
                      </button>
                    </div>
                  </div>

                  {/* Expanded Blocks List */}
                  {isExpanded && (
                    <div className="bg-slate-50/50 p-3 pl-9 border-t border-slate-100 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-semibold text-slate-700">
                          Mapped Blocks in {district.name}:
                        </span>
                        <span>{expandedBlocks.length} total blocks</span>
                      </div>

                      {isLoadingExpandedBlocks ? (
                        <div className="py-3 text-xs text-slate-400 flex items-center gap-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                          <span>Loading blocks...</span>
                        </div>
                      ) : expandedBlocks.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No blocks recorded for this district.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {expandedBlocks.map((blk) => (
                            <span
                              key={blk.id}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-xs font-medium text-slate-800 shadow-2xs"
                            >
                              <span>{blk.name}</span>
                              {blk.code && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  ({blk.code})
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL 1: EXCEL IMPORTER */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Import Location Master from Excel
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                Upload an Excel workbook containing <strong>District Summary</strong> and/or{' '}
                <strong>Block Mapping</strong> sheets (such as <code>Rajasthan_Districts_and_Blocks.xlsx</code>)
                or standard <code>District, Block</code> columns.
              </p>

              {/* File Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Select Excel File (.xlsx, .xls) *
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-800 hover:file:bg-indigo-100 cursor-pointer border border-slate-200 rounded-xl p-1"
                />
              </div>

              {/* State Name & Code */}
              <div className="grid grid-cols-2 gap-3">
                <GlassInput
                  label="State / Territory Name *"
                  value={importStateName}
                  onChange={(e) => setImportStateName(e.target.value)}
                  placeholder="e.g. Rajasthan"
                />
                <GlassInput
                  label="State Code"
                  value={importStateCode}
                  onChange={(e) => setImportStateCode(e.target.value)}
                  placeholder="e.g. RJ"
                />
              </div>

              {/* Import Error Message */}
              {importError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-rose-700 font-medium">{importError}</p>
                </div>
              )}

              {/* Import Results Summary Card */}
              {importResult && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>
                      {importResult.dry_run ? 'Dry Run Validation Results' : 'Import Complete!'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-emerald-800 pt-1">
                    <div>
                      <span className="text-slate-500 block">Total Districts:</span>
                      <strong>{importResult.total_districts}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Total Blocks:</span>
                      <strong>{importResult.total_blocks}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Created New Districts:</span>
                      <strong className="text-emerald-700">{importResult.created_districts}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Created New Blocks:</span>
                      <strong className="text-emerald-700">{importResult.created_blocks}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Skipped (Existing) Districts:</span>
                      <span>{importResult.skipped_districts}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Skipped (Existing) Blocks:</span>
                      <span>{importResult.skipped_blocks}</span>
                    </div>
                  </div>

                  {importResult.errors && importResult.errors.length > 0 && (
                    <div className="pt-2 border-t border-emerald-200/60 text-[11px] text-amber-800">
                      <span className="font-bold">Warnings:</span>
                      <ul className="list-disc list-inside">
                        {importResult.errors.slice(0, 4).map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <GlassButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsImportModalOpen(false)}
              >
                Close
              </GlassButton>

              <div className="flex items-center gap-2">
                <GlassButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  isLoading={importExcelMutation.isPending}
                  onClick={() => handleRunImport(true)}
                >
                  Preview Validation
                </GlassButton>

                <GlassButton
                  type="button"
                  variant="primary"
                  size="sm"
                  isLoading={importExcelMutation.isPending}
                  onClick={() => handleRunImport(false)}
                  leftIcon={<Check className="w-3.5 h-3.5" />}
                >
                  Confirm & Import Data
                </GlassButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD STATE */}
      {isAddStateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateState}
            className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Add State / Territory</h3>
              <button
                type="button"
                onClick={() => setIsAddStateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <GlassInput
              label="State Name *"
              value={newStateName}
              onChange={(e) => setNewStateName(e.target.value)}
              placeholder="e.g. Gujarat"
              required
            />

            <GlassInput
              label="State Code"
              value={newStateCode}
              onChange={(e) => setNewStateCode(e.target.value)}
              placeholder="e.g. GJ"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <GlassButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsAddStateModalOpen(false)}
              >
                Cancel
              </GlassButton>
              <GlassButton
                type="submit"
                variant="primary"
                size="sm"
                isLoading={createStateMutation.isPending}
              >
                Save State
              </GlassButton>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: ADD DISTRICT */}
      {isAddDistrictModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateDistrict}
            className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Add District to {selectedState?.name || 'State'}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddDistrictModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <GlassInput
              label="District Name *"
              value={newDistrictName}
              onChange={(e) => setNewDistrictName(e.target.value)}
              placeholder="e.g. Bikaner"
              required
            />

            <GlassInput
              label="District Code"
              value={newDistrictCode}
              onChange={(e) => setNewDistrictCode(e.target.value)}
              placeholder="e.g. BIK"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <GlassButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsAddDistrictModalOpen(false)}
              >
                Cancel
              </GlassButton>
              <GlassButton
                type="submit"
                variant="primary"
                size="sm"
                isLoading={createDistrictMutation.isPending}
              >
                Save District
              </GlassButton>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 4: ADD BLOCK */}
      {isAddBlockModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateBlock}
            className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Add Block</h3>
              <button
                type="button"
                onClick={() => setIsAddBlockModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Target District *</label>
              <select
                value={targetDistrictIdForBlock}
                onChange={(e) => setTargetDistrictIdForBlock(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-slate-200 text-xs font-semibold bg-white text-slate-800 outline-none"
                required
              >
                <option value="">Select district...</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <GlassInput
              label="Block Name *"
              value={newBlockName}
              onChange={(e) => setNewBlockName(e.target.value)}
              placeholder="e.g. Central Block"
              required
            />

            <GlassInput
              label="Block Code"
              value={newBlockCode}
              onChange={(e) => setNewBlockCode(e.target.value)}
              placeholder="e.g. BLK-01"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <GlassButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsAddBlockModalOpen(false)}
              >
                Cancel
              </GlassButton>
              <GlassButton
                type="submit"
                variant="primary"
                size="sm"
                isLoading={createBlockMutation.isPending}
              >
                Save Block
              </GlassButton>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
