"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type PropertyOption = { id: string; name: string };

type MembershipRow = {
  property_id: string;
  property_name?: string | null;
};

type WorkspaceContextType = {
  allowedPropertyIds: string[];
  propertyOptions: PropertyOption[];
  selectedPropertyId: string;
  setSelectedPropertyId: (id: string) => void;

  loadingMemberships: boolean;
  membershipsError: string | null;
};

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

const STORAGE_KEY = "guestops:selectedPropertyId";

async function getAccessToken() {
  const sb = getSupabaseBrowserClient();
  const { data, error } = await sb.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error("No Supabase session");
  }
  return data.session.access_token;
}

export function PropertyWorkspaceProvider({
  children,

  /**
   * Optional overrides (useful for tests / server-provided defaults).
   * If omitted, provider will fetch memberships on mount.
   */
  allowedPropertyIds: allowedOverride,
  propertyOptions: optionsOverride,
}: {
  allowedPropertyIds?: string[];
  propertyOptions?: PropertyOption[];
  children: React.ReactNode;
}) {
  const [allowedPropertyIds, setAllowedPropertyIds] = useState<string[]>(
    allowedOverride ?? []
  );
  const [propertyOptions, setPropertyOptions] = useState<PropertyOption[]>(
    optionsOverride ?? []
  );

  const [loadingMemberships, setLoadingMemberships] = useState(false);
  const [membershipsError, setMembershipsError] = useState<string | null>(null);

  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("all");

  // Load memberships (unless overrides provided)
  useEffect(() => {
    let cancelled = false;

    async function loadMemberships() {
      // If caller provided data, don’t fetch.
      if (allowedOverride && optionsOverride) return;

      setLoadingMemberships(true);
      setMembershipsError(null);

      try {
        const token = await getAccessToken();
        const res = await fetch("/api/me/memberships", {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });

        const text = await res.text();
        if (!res.ok) {
          throw new Error(`Failed to load memberships: ${res.status} ${text}`);
        }

        const json = text ? JSON.parse(text) : {};
        const memberships = (json?.memberships ?? []) as MembershipRow[];

        const allowed = Array.from(
          new Set(
            memberships
              .map((m) => (m?.property_id ? String(m.property_id) : ""))
              .filter(Boolean)
          )
        );

        const opts: PropertyOption[] = memberships
          .map((m) => ({
            id: String(m.property_id),
            name: (m.property_name ?? "").trim() || String(m.property_id),
          }))
          // de-dupe by id
          .filter(
            (o, idx, arr) => arr.findIndex((x) => x.id === o.id) === idx
          );

        if (!cancelled) {
          setAllowedPropertyIds(allowed);
          setPropertyOptions(opts);
        }
      } catch (e: any) {
        if (!cancelled) {
          setMembershipsError(e?.message ?? "Failed to load memberships");
          setAllowedPropertyIds([]);
          setPropertyOptions([]);
        }
      } finally {
        if (!cancelled) setLoadingMemberships(false);
      }
    }

    void loadMemberships();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load saved selection and validate against allowedPropertyIds
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
      loadingMemberships,
      membershipsError,
    }),
    [
      allowedPropertyIds,
      propertyOptions,
      selectedPropertyId,
      loadingMemberships,
      membershipsError,
    ]
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