import { EMPTY_FILTERS, FILTER_CATEGORIES, FILTER_STATUSES, hasActiveFilters } from "../filters";

// Category and status selects for the admin inbox. Changing either refetches
// from the API; "Clear filters" restores the unfiltered list.
export function InboxFilters({ filters, onChange, disabled = false }) {
  const active = hasActiveFilters(filters);
  const update = (field) => (event) => onChange({ ...filters, [field]: event.target.value });
  return (
    <div className="inbox-filters" role="group" aria-label="Filter feedback">
      <label className="filter-field">
        <span>Category</span>
        <select value={filters.category} onChange={update("category")} disabled={disabled} aria-label="Filter by category">
          <option value="">All categories</option>
          {FILTER_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
      </label>
      <label className="filter-field">
        <span>Status</span>
        <select value={filters.status} onChange={update("status")} disabled={disabled} aria-label="Filter by status">
          <option value="">All statuses</option>
          {FILTER_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
      </label>
      {active && (
        <button type="button" className="text-button" onClick={() => onChange({ ...EMPTY_FILTERS })} disabled={disabled}>
          Clear filters
        </button>
      )}
    </div>
  );
}
