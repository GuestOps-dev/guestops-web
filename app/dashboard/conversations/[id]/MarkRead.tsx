"use client";

import { useEffect } from "react";

export default function MarkRead({ conversationId }: { conversationId: string }) {
  useEffect(() => {
    fetch(`/api/conversations/${conversationId}/read`, {
      method: "POST",
    }).catch((err) => {
      console.error("MarkRead fetch error:", err);
    });
  }, [conversationId]);

  return null;
}