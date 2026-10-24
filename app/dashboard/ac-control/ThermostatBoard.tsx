"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type Thermostat = { id: string; property_name: string; provider_name: string; friendly_name: string | null; health_status: "online" | "offline" | "unknown"; power: "on" | "off" | "unknown"; mode: string | null; setPoint: number | null; currentTemperature: number | null; temperatureUnit: "F" | "C" | null };
type Action = "on" | "off" | "cool" | "set_point";
type Feedback = { phase: "processing" | "success" | "error"; title: string; detail: string };

const button: React.CSSProperties = { border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", minHeight: 40, background: "#fff", fontWeight: 700, cursor: "pointer" };
const label = (action: Action, point: string) => action === "set_point" ? `Setting ${point}°` : action === "on" ? "Turning on" : action === "off" ? "Turning off" : "Setting cool mode";

export default function ThermostatBoard() {
  const sb = useMemo(() => getSupabaseBrowserClient(), []);
  const [devices, setDevices] = useState<Thermostat[]>([]); const [selected, setSelected] = useState<string[]>([]); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState<string | null>(null); const [error, setError] = useState<string | null>(null); const [setPoint, setSetPoint] = useState("72"); const [feedback, setFeedback] = useState<Feedback | null>(null); const [cardsOnly, setCardsOnly] = useState(false);
  const token = useCallback(async () => { const { data } = await sb.auth.getSession(); if (!data.session?.access_token) throw new Error("Please sign in again."); return data.session.access_token; }, [sb]);
  const load = useCallback(async () => { setLoading(true); try { const response = await fetch("/api/ac/thermostats", { cache: "no-store", headers: { Authorization: `Bearer ${await token()}` } }); const data = await response.json(); if (!response.ok) throw new Error(data?.error ?? "Unable to load thermostats."); setDevices(data.thermostats ?? []); } catch (caught: any) { setError(caught?.message ?? "Unable to load thermostats."); } finally { setLoading(false); } }, [token]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { document.body.classList.toggle("ac-cards-only", cardsOnly); return () => document.body.classList.remove("ac-cards-only"); }, [cardsOnly]);

  async function command(ids: string[], action: Action, subject?: string) {
    if (busy) return;
    const actionable = ids.filter((id) => devices.find((device) => device.id === id)?.health_status === "online");
    if (!actionable.length) { setError("Choose at least one online thermostat."); return; }
    const target = subject ?? `${actionable.length} selected thermostat${actionable.length === 1 ? "" : "s"}`;
    setBusy(action); setError(null); setFeedback({ phase: "processing", title: `${label(action, setPoint)} ${target}…`, detail: "Sending the request to Cielo. Please wait." });
    try {
      for (const id of actionable) {
        const response = await fetch("/api/ac/thermostats", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` }, body: JSON.stringify({ device_id: id, action, set_point: action === "set_point" ? Number(setPoint) : undefined }) });
        const data = await response.json(); if (!response.ok) throw new Error(data?.error ?? "Thermostat command failed.");
      }
      await load();
      setFeedback({ phase: "success", title: `Request accepted for ${target}`, detail: "Cielo accepted the request. The refreshed card state is the latest reported device state; acceptance alone is not a physical-device confirmation." });
    } catch (caught: any) { setFeedback({ phase: "error", title: `Could not complete request for ${target}`, detail: caught?.message ?? "Cielo did not accept the request." }); }
    finally { setBusy(null); }
  }

  const grouped = devices.reduce<Record<string, Thermostat[]>>((all, device) => { (all[device.property_name] ??= []).push(device); return all; }, {});
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id]);
  return <section className="ac-thermostat-section" style={{ marginBottom: 16 }}>
    <div className="ac-thermostat-toolbar" style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
      <label className="ac-cards-toggle"><input type="checkbox" checked={cardsOnly} onChange={(event) => setCardsOnly(event.target.checked)} /> Cards only</label>
      {!cardsOnly ? <><button type="button" onClick={() => void load()} disabled={loading || busy !== null} style={button}>Refresh</button>
      <div className="ac-bulk-controls" style={{ padding: 8, border: "1px solid #dbe4ee", borderRadius: 10, background: "#f8fafc", display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" onClick={() => setSelected(selected.length === devices.length ? [] : devices.map((device) => device.id))} style={button}>{selected.length === devices.length && devices.length ? "Clear" : "Select all"}</button><button type="button" onClick={() => void command(selected, "on")} disabled={!selected.length || busy !== null} style={button}>On selected</button><button type="button" onClick={() => void command(selected, "off")} disabled={!selected.length || busy !== null} style={{ ...button, color: "#b91c1c" }}>Off selected</button><button type="button" onClick={() => void command(selected, "cool")} disabled={!selected.length || busy !== null} style={button}>Cool</button><input aria-label="Bulk temperature" value={setPoint} onChange={(event) => setSetPoint(event.target.value)} type="number" min="60" max="86" style={{ ...button, width: 68 }} /><button type="button" onClick={() => void command(selected, "set_point")} disabled={!selected.length || busy !== null} style={button}>Set °</button>
      </div></> : null}
    </div>
    {error ? <p role="alert" style={{ color: "#b91c1c", margin: "8px 0" }}>{error}</p> : null}{loading ? <p style={{ margin: "10px 0" }}>Loading thermostats…</p> : null}
    {Object.entries(grouped).map(([home, thermostats]) => <section key={home} style={{ marginTop: 12 }}><h3 style={{ fontSize: 14, margin: "0 0 7px", color: "#334155" }}>{home}</h3><div className="ac-thermostat-grid">{thermostats.map((device) => { const offline = device.health_status !== "online"; const checked = selected.includes(device.id); const name = device.friendly_name ?? device.provider_name; return <article className="ac-thermostat-card" key={device.id} style={{ border: `1px solid ${checked ? "#93c5fd" : "#dbe4ee"}`, borderRadius: 12, padding: 12, background: "#fff" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}><label className="ac-card-label" style={{ display: "flex", gap: 7, minWidth: 0 }}><input aria-label={`Select ${name}`} type="checkbox" checked={checked} onChange={() => toggle(device.id)} /><strong>{name}</strong></label><span className="ac-device-health" style={{ color: offline ? "#b91c1c" : "#166534", fontSize: 12, fontWeight: 700 }}>{device.health_status}</span></div><p className="ac-device-state" style={{ margin: "8px 0 4px", fontSize: 13, color: "#475569" }}>{device.power === "unknown" ? "State unavailable" : `${device.power === "on" ? "On" : "Off"}${device.mode ? ` · ${device.mode}` : ""}`}</p><p className="ac-device-temperature" style={{ margin: "0 0 8px", fontSize: 13 }}>{device.currentTemperature !== null ? `Room ${device.currentTemperature}°${device.temperatureUnit ?? ""}` : "Room temperature unavailable"}{device.setPoint !== null ? ` · Set ${device.setPoint}°${device.temperatureUnit ?? ""}` : ""}</p><div className="ac-card-actions" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><button type="button" disabled={offline || busy !== null} onClick={() => void command([device.id], "on", name)} style={button}>On</button><button type="button" disabled={offline || busy !== null} onClick={() => void command([device.id], "off", name)} style={button}>Off</button><button type="button" disabled={offline || busy !== null} onClick={() => void command([device.id], "cool", name)} style={button}>Cool</button></div></article>; })}</div></section>)}
    {feedback ? <div className="ac-feedback-backdrop" role="presentation"><div className="ac-feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="ac-feedback-title">{feedback.phase === "processing" ? <span className="ac-airflow" aria-label="Request in progress">✺</span> : <span className={`ac-feedback-icon ${feedback.phase}`} aria-hidden="true">{feedback.phase === "success" ? "✓" : "!"}</span>}<h2 id="ac-feedback-title">{feedback.title}</h2><p>{feedback.detail}</p>{feedback.phase !== "processing" ? <button type="button" autoFocus onClick={() => setFeedback(null)} style={{ ...button, background: "#0f4c81", color: "#fff", borderColor: "#0f4c81", minWidth: 106 }}>Continue</button> : null}</div></div> : null}
  </section>;
}
