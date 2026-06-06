"use client";

import { Crown, UserRound } from "lucide-react";

export default function CreatorViewToggle({
  enabled,
  onChange
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <div className="creator-toggle">
      <div>
        {enabled ? <Crown size={16} /> : <UserRound size={16} />}
        <span>{enabled ? "Creator view" : "Customer view"}</span>
      </div>
      <button
        type="button"
        className={enabled ? "toggle-switch on" : "toggle-switch"}
        aria-pressed={enabled}
        onClick={() => onChange(!enabled)}
        title="Toggle creator view"
      >
        <span />
      </button>
    </div>
  );
}

