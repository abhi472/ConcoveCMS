import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useSyncRetryContext,
  type SyncHistoryRecord,
} from '../context/SyncRetryContext'
import { useTenantContext } from '../context/TenantContext'

interface CorrectionGroup {
  rootId: string
  rootRecord: SyncHistoryRecord | null
  children: SyncHistoryRecord[]
}

type CorrectionFilter = 'ALL' | 'ORIGINAL' | 'CORRECTION'

function formatRecordedAt(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function matchesSearch(value: string, searchTerm: string) {
  return value.toLowerCase().includes(searchTerm.toLowerCase())
}

function getFailureCategory(message: string) {
  const normalizedMessage = message.toLowerCase()

  if (normalizedMessage.includes('tenant')) {
    return {
      label: 'Tenant Mismatch',
      className: 'bg-amber-100 text-amber-800',
    }
  }

  if (
    normalizedMessage.includes('required') ||
    normalizedMessage.includes('invalid') ||
    normalizedMessage.includes('must be')
  ) {
    return {
      label: 'Validation',
      className: 'bg-sky-100 text-sky-800',
    }
  }

  return {
    label: 'Sync Failure',
    className: 'bg-slate-200 text-slate-700',
  }
}

function SyncMonitorPage() {
  const navigate = useNavigate()
  const { clearTenantSyncData, failedRecords, syncHistory } = useSyncRetryContext()
  const { selectedTenantId, selectedTenantName } = useTenantContext()
  const [correctionFilter, setCorrectionFilter] = useState<CorrectionFilter>('ALL')
  const [searchTerm, setSearchTerm] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

  const tenantFailedRecords = useMemo(
    () => failedRecords.filter((record) => record.tenant_id === selectedTenantId),
    [failedRecords, selectedTenantId],
  )
  const tenantSuccessfulRecords = useMemo(
    () =>
      syncHistory.filter(
        (record) => record.tenant_id === selectedTenantId && record.sync_status === 'SUCCESS',
      ),
    [selectedTenantId, syncHistory],
  )
  const successfulRecordMap = useMemo(
    () => new Map(tenantSuccessfulRecords.map((record) => [record.client_transaction_id, record])),
    [tenantSuccessfulRecords],
  )
  const correctionGroups = useMemo(() => {
    const groups = new Map<string, CorrectionGroup>()

    tenantSuccessfulRecords.forEach((record) => {
      const parentId = record.transaction.correction_of_transaction_id

      if (!parentId) {
        const existingGroup = groups.get(record.client_transaction_id)

        groups.set(record.client_transaction_id, {
          rootId: record.client_transaction_id,
          rootRecord: record,
          children: existingGroup?.children ?? [],
        })
        return
      }

      const existingGroup = groups.get(parentId)

      groups.set(parentId, {
        rootId: parentId,
        rootRecord: existingGroup?.rootRecord ?? successfulRecordMap.get(parentId) ?? null,
        children: [...(existingGroup?.children ?? []), record].sort((a, b) =>
          b.recorded_at.localeCompare(a.recorded_at),
        ),
      })
    })

    return Array.from(groups.values()).sort((a, b) => {
      const aDate = a.rootRecord?.recorded_at ?? a.children[0]?.recorded_at ?? ''
      const bDate = b.rootRecord?.recorded_at ?? b.children[0]?.recorded_at ?? ''
      return bDate.localeCompare(aDate)
    })
  }, [successfulRecordMap, tenantSuccessfulRecords])
  const visibleCorrectionGroups = useMemo(() => {
    const filteredGroups =
      correctionFilter === 'ALL'
        ? correctionGroups
        : correctionFilter === 'ORIGINAL'
          ? correctionGroups.filter((group) => group.rootRecord !== null)
          : correctionGroups.filter((group) => group.children.length > 0)

    if (!searchTerm.trim()) {
      return filteredGroups
    }

    return filteredGroups.filter((group) => {
      const searchSpace = [
        group.rootId,
        group.rootRecord?.message ?? '',
        group.rootRecord?.transaction.correction_reason ?? '',
        ...group.children.flatMap((child) => [
          child.client_transaction_id,
          child.message,
          child.transaction.correction_reason ?? '',
        ]),
      ].join(' ')

      return matchesSearch(searchSpace, searchTerm)
    })
  }, [correctionFilter, correctionGroups, searchTerm])
  const visibleFailedRecords = useMemo(() => {
    if (!searchTerm.trim()) {
      return tenantFailedRecords
    }

    return tenantFailedRecords.filter((record) =>
      matchesSearch(
        [
          record.client_transaction_id,
          record.message,
          record.transaction.correction_of_transaction_id ?? '',
          record.transaction.correction_reason ?? '',
        ].join(' '),
        searchTerm,
      ),
    )
  }, [searchTerm, tenantFailedRecords])
  const tenantMismatchCount = useMemo(
    () => tenantFailedRecords.filter((record) => getFailureCategory(record.message).label === 'Tenant Mismatch').length,
    [tenantFailedRecords],
  )
  const summaryCards = useMemo(
    () => [
      {
        label: 'Failed Rows',
        value: tenantFailedRecords.length,
        tone: 'text-rose-700 bg-rose-50 border-rose-200',
      },
      {
        label: 'Correction Chains',
        value: correctionGroups.length,
        tone: 'text-slate-700 bg-slate-50 border-slate-200',
      },
      {
        label: 'Tenant Mismatch',
        value: tenantMismatchCount,
        tone: 'text-amber-800 bg-amber-50 border-amber-200',
      },
    ],
    [correctionGroups.length, tenantFailedRecords.length, tenantMismatchCount],
  )

  const handleClearLocalHistory = () => {
    const confirmed = window.confirm(
      `Clear local Sync Monitor history for ${selectedTenantName}? This removes cached failed retries and correction history for the active tenant only.`,
    )

    if (!confirmed) {
      return
    }

    clearTenantSyncData(selectedTenantId)
    setCollapsedGroups({})
    setSearchTerm('')
  }

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold text-slate-900">Sync Monitor</h2>
        <p className="mt-1 text-sm text-slate-600">
          Track HTTP 207 multi-status outcomes and retry failed records from operations batches.
        </p>
        <div className="mt-3 max-w-md">
          <label className="space-y-0.5 text-sm font-medium text-slate-700">
            <span>Search Monitor</span>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by transaction ID, message, or correction reason"
              className="w-full rounded-md border border-slate-300 px-3 py-1"
            />
          </label>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {summaryCards.map((card) => (
            <div key={card.label} className={`rounded-lg border px-4 py-3 ${card.tone}`}>
              <p className="text-xs font-semibold uppercase tracking-wide">{card.label}</p>
              <p className="mt-1 font-mono text-2xl font-semibold">{card.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <button
            type="button"
            onClick={handleClearLocalHistory}
            className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700"
          >
            Clear Local History For {selectedTenantName}
          </button>
        </div>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Batch Queue Status</h3>
        <p className="mt-2 text-sm text-slate-600">
          Use the Operations page to submit a transaction batch. Failed records can be reviewed and retried with corrected tenant/entity mappings.
        </p>
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                  <th className="px-2 py-1 text-left font-semibold text-slate-700">client_transaction_id</th>
                  <th className="px-2 py-1 text-left font-semibold text-slate-700">Status</th>
                  <th className="px-2 py-1 text-left font-semibold text-slate-700">Recorded</th>
                  <th className="px-2 py-1 text-left font-semibold text-slate-700">Message</th>
                  <th className="px-2 py-1 text-left font-semibold text-slate-700">Lineage</th>
                  <th className="px-2 py-1 text-left font-semibold text-slate-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleFailedRecords.map((record) => {
                const failureCategory = getFailureCategory(record.message)

                return (
                  <tr key={record.client_transaction_id} className="border-t border-slate-100">
                    <td className="px-3 py-3 font-mono text-xs text-slate-700">{record.client_transaction_id}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700">
                          FAILED
                        </span>
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${failureCategory.className}`}
                        >
                          {failureCategory.label}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600">
                      {formatRecordedAt(record.failed_at)}
                    </td>
                    <td className="px-3 py-3 text-slate-700">{record.message}</td>
                    <td className="px-3 py-3 text-xs text-slate-600">
                      {record.transaction.correction_of_transaction_id ? (
                        <div className="space-y-1">
                          <p>
                            Correction of{' '}
                            <span className="font-mono text-slate-700">
                              {record.transaction.correction_of_transaction_id}
                            </span>
                          </p>
                          {successfulRecordMap.has(record.transaction.correction_of_transaction_id) ? (
                            <button
                              type="button"
                              onClick={() =>
                                navigate(
                                  `/operations?correction=${record.transaction.correction_of_transaction_id}`,
                                )
                              }
                              className="text-xs font-semibold text-slate-700 underline-offset-2 hover:underline"
                            >
                              Open parent record
                            </button>
                          ) : null}
                          {record.transaction.correction_reason ? (
                            <p className="rounded bg-slate-100 px-2 py-1 text-slate-700">
                              Reason: {record.transaction.correction_reason}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-slate-500">Original failed submission</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => navigate(`/operations?retry=${record.client_transaction_id}`)}
                        className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700"
                      >
                        Fix & Retry
                      </button>
                    </td>
                  </tr>
                )
              })}
              {visibleFailedRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                    No failed records match the current search. Adjust the search term or run "Commit to Ledger" in Operations.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Immutable Correction Trail</h3>
        <p className="mt-2 text-sm text-slate-600">
          Successful ledger writes stay immutable. Use Correction to generate a compensating entry instead of editing the original record.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(['ALL', 'ORIGINAL', 'CORRECTION'] as const).map((filterValue) => (
            <button
              key={filterValue}
              type="button"
              onClick={() => setCorrectionFilter(filterValue)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                correctionFilter === filterValue
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {filterValue === 'ALL'
                ? 'All Chains'
                : filterValue === 'ORIGINAL'
                  ? 'Original Roots'
                  : 'Correction Chains'}
            </button>
          ))}
        </div>
        <div className="mt-4 space-y-4">
          {visibleCorrectionGroups.map((group) => {
            const correctionCount = group.children.length
            const isCollapsed = collapsedGroups[group.rootId] ?? false

            return (
              <article
                key={group.rootId}
                className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {group.rootRecord ? 'Original Ledger Entry' : 'Correction Chain Root Missing'}
                    </p>
                    <p className="font-mono text-xs text-slate-700">{group.rootId}</p>
                    <p className="text-xs text-slate-500">
                      Recorded{' '}
                      {formatRecordedAt(
                        group.rootRecord?.recorded_at ?? group.children[0]?.recorded_at ?? new Date().toISOString(),
                      )}
                    </p>
                    <p className="text-sm text-slate-700">
                      {group.rootRecord?.message ?? 'Original successful record is not available in local history, but compensating entries were captured.'}
                    </p>
                    {group.rootRecord?.transaction.correction_reason ? (
                      <p className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
                        Reason: {group.rootRecord.transaction.correction_reason}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">
                      {correctionCount} correction{correctionCount === 1 ? '' : 's'}
                    </span>
                    {group.children.length > 0 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setCollapsedGroups((current) => ({
                            ...current,
                            [group.rootId]: !isCollapsed,
                          }))
                        }
                        className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600"
                      >
                        {isCollapsed ? 'Expand Chain' : 'Collapse Chain'}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => navigate(`/operations?correction=${group.rootId}`)}
                      className="rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700"
                    >
                      Correction
                    </button>
                  </div>
                </div>

                {group.children.length > 0 && !isCollapsed ? (
                  <div className="space-y-3 px-4 py-4">
                    {group.children.map((child) => (
                      <div
                        key={child.client_transaction_id}
                        className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                              Compensating Entry
                            </p>
                            <p className="font-mono text-xs text-slate-700">
                              {child.client_transaction_id}
                            </p>
                            <p className="text-xs text-amber-800">
                              Recorded {formatRecordedAt(child.recorded_at)}
                            </p>
                            <p className="text-sm text-slate-700">{child.message}</p>
                            {child.transaction.correction_reason ? (
                              <p className="rounded bg-white px-2 py-1 text-xs text-slate-700">
                                Reason: {child.transaction.correction_reason}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => navigate(`/operations?correction=${child.client_transaction_id}`)}
                              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                            >
                              Correction
                            </button>
                            <button
                              type="button"
                              onClick={() => navigate(`/operations?correction=${group.rootId}`)}
                              className="rounded-md border border-amber-300 bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800"
                            >
                              Open Parent
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            )
          })}

          {visibleCorrectionGroups.length === 0 ? (
            <div className="rounded-lg border border-slate-200 px-3 py-8 text-center text-slate-500">
              No correction chains match the current filter or search. Commit a transaction or change the filters to view immutable history.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}

export default SyncMonitorPage