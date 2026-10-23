type CieloDevice = { externalDeviceId: string; providerName: string; deviceType: string | null; modelName: string | null; healthStatus: "online" | "offline" | "unknown" };

const BASE_URL = "https://api.smartcielo.com/openapi/v1";

function collectDevices(value: unknown, result: Record<string, unknown>[]) {
  if (Array.isArray(value)) { for (const item of value) collectDevices(item, result); return; }
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  if (typeof record.mac_address === "string" || typeof record.device_id === "string") { result.push(record); return; }
  for (const child of Object.values(record)) collectDevices(child, result);
}

export async function listCieloDevices(): Promise<CieloDevice[]> {
  const apiKey = process.env.CIELOWIGLE_API;
  if (!apiKey) throw new Error("Cielo API key is not configured");
  const auth = await fetch(`${BASE_URL}/authenticate`, { method: "POST", headers: { "x-api-key": apiKey }, cache: "no-store" });
  const authBody = await auth.json().catch(() => null);
  if (!auth.ok) throw new Error(`Cielo authentication failed (${auth.status})`);
  const token = authBody?.data?.access_token;
  if (typeof token !== "string" || !token) throw new Error("Cielo returned an invalid authentication response");
  const response = await fetch(`${BASE_URL}/devices/?cached_appliance_ids=[]`, { headers: { "x-api-key": apiKey, Authorization: token }, cache: "no-store" });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Cielo device discovery failed (${response.status})`);
  const raw: Record<string, unknown>[] = [];
  collectDevices(body?.data, raw);
  const byId = new Map<string, CieloDevice>();
  for (const device of raw) {
    const externalDeviceId = typeof device.mac_address === "string" ? device.mac_address : typeof device.device_id === "string" ? device.device_id : null;
    if (!externalDeviceId) continue;
    const connection = device.connection_status as Record<string, unknown> | undefined;
    const alive = connection?.is_alive;
    byId.set(externalDeviceId, {
      externalDeviceId,
      providerName: typeof device.device_name === "string" && device.device_name.trim() ? device.device_name.trim() : externalDeviceId,
      deviceType: typeof device.device_type === "string" ? device.device_type : "Cielo controller",
      modelName: typeof device.model === "string" ? device.model : typeof device.product_name === "string" ? device.product_name : null,
      healthStatus: alive === true ? "online" : alive === false ? "offline" : "unknown",
    });
  }
  return [...byId.values()];
}
