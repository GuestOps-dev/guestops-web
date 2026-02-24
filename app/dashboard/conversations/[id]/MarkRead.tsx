"use client";

import { useEffect, useMemo } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

export default function MarkRead({
  conversationId,
  propertyId,
}: {
  conversationId: string;
  propertyId: string;
}) {
  const sb = useMemo(() => getSupabaseBrowserClient(), []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        if (!conversationId || !propertyId) return;

        const { data, error } = await sb.auth.getSession();
        if (error || !data.session?.access_token) return;

        const token = data.session.access_token;

        const res = await fetch(`/api/conversations/${conversationId}/read`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ property_id: propertyId }),
        });

        if (!res.ok) {
          // don’t spam UI; just log for now
          const text = await res.text().catch(() => "");
          console.error("MarkRead failed:", res.status, text);
        }
      } catch (e) {
        console.error("MarkRead error:", e);
      }
    }

    run();

    return () => {
      cancelled = true;
      void cancelled;
    };
  }, [sb, conversationId, propertyId]);

  return null;
}