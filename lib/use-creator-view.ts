"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "creator-view-enabled";

export function useCreatorView(owner: boolean) {
  const [creatorView, setCreatorView] = useState(owner);

  useEffect(() => {
    if (!owner) {
      setCreatorView(false);
      return;
    }

    const stored = window.localStorage.getItem(STORAGE_KEY);
    setCreatorView(stored ? stored === "true" : true);
  }, [owner]);

  function updateCreatorView(enabled: boolean) {
    setCreatorView(enabled);
    if (owner) {
      window.localStorage.setItem(STORAGE_KEY, String(enabled));
    }
  }

  return [creatorView, updateCreatorView] as const;
}

