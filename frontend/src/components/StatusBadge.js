import React from "react";

const STYLES = {
  OK: "status-ok",
  A1: "status-a1",
  A2: "status-a2",
  Parado: "status-parado",
  "Sem diag.": "status-semdiag",
};

export default function StatusBadge({ status, className = "" }) {
  const s = STYLES[status] || "status-ok";
  return (
    <span
      data-testid={`status-badge-${status}`}
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold font-mono ${s} ${className}`}
    >
      {status}
    </span>
  );
}
