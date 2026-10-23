import { TAB_PERMISSION_META, permissionLabel } from "../../lib/permissions.js";

export function PermissionsEditor({ value = {}, onChange }) {
  const setLevel = (key, level) => {
    onChange({ ...value, [key]: level });
  };
  return (
    <div className="permissions-grid">
      {TAB_PERMISSION_META.map((tab) => {
        const level = value[tab.key] || "none";
        return (
          <div key={tab.key} className="permission-row">
            <span className="permission-tab-label">{tab.label}</span>
            <div className="permission-options">
              {["none", "view", "edit"].map((opt) => (
                <button
                  type="button"
                  key={opt}
                  className={`permission-chip ${level === opt ? "active" : ""}`}
                  onClick={() => setLevel(tab.key, opt)}
                >
                  {permissionLabel(opt)}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

