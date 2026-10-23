import { Plus, Search } from "lucide-react";
import { Select } from "./Select.jsx";

export function Toolbar({ search, setSearch, placeholder, statusOptions, statusExtras, statusFilter, setStatusFilter, extraFilter, onNew, newLabel, extraActions }) {
  return (
    <div className="toolbar">
      <div className="search-wrap">
        <Search size={15} className="search-icon" />
        <input
          className="search-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={placeholder}
        />
      </div>
      {statusOptions && (
        <Select
          className="select-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Todos os status</option>
          {(statusExtras || []).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
          {statusOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
      )}
      {extraFilter}
      {onNew && (
        <button className="btn-primary" onClick={onNew}>
          <Plus size={15} strokeWidth={2.4} />
          {newLabel}
        </button>
      )}
      {extraActions}
    </div>
  );
}

