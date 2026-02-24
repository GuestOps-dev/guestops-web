"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type PropertyOption = { id: string; name: string };

type WorkspaceContextType = {
  allowedPropertyIds: string[];
  propertyOptions: PropertyOption[];
  selectedPropertyId: string;
  setSelectedPropertyId: (id: string) => void;
};

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

const STORAGE_KEY = "guestops:selectedPropertyId";

export function PropertyWorkspaceProvider({
  allowedPropertyIds,
  propertyOptions,
  children,
}: {
  allowedPropertyIds: string[];
  propertyOptions: PropertyOption[];
  children: React.ReactNode;
}) {
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("all");

  // Load saved selection and validate
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);

    const normalized =
      saved && saved !== "all" && allowedPropertyIds.includes(saved)
        ? saved
        : "all";

    setSelectedPropertyId(normalized);

    if (saved !== normalized) {
      localStorage.setItem(STORAGE_KEY, normalized);
    }
  }, [allowedPropertyIds.join(",")]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, selectedPropertyId);
  }, [selectedPropertyId]);

  const value = useMemo(
    () => ({
      allowedPropertyIds,
      propertyOptions,
      selectedPropertyId,
      setSelectedPropertyId,
    }),
    [allowedPropertyIds, propertyOptions, selectedPropertyId]
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function usePropertyWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("usePropertyWorkspace must be used inside provider");
  return ctx;
}