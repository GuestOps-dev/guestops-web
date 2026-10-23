import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { getSupabaseServiceClient } from "@/lib/supabaseServer";

type CieloDevice = { externalDeviceId: string; providerName: string; deviceType: string | null; modelName: string | null; healthStatus: "online" | "offline" | "unknown" };

const BASE_URL = "https://api.smartcielo.com/openapi/v1";

function collectDevices(value: unknown, result: Record<string, unknown>[]) {
  if (Array.isArray(value)) { for (const item of value) collectDevices(item, result); return; }
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  if (typeof record.mac_address === "string" || typeof record.device_id === "string") { result.push(record); return; }
  for (const child of Object.values(record)) collectDevices(child, result);
}

type StoredCredential = { encrypted_access_token: string };

function encryptionKey() {
  const rootSecret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!rootSecret) throw new Error("Cielo credential storage is not configured");
  // The database holds only opaque ciphertext. The key is derived at runtime
  // from an existing server-only secret and is never returned to the browser.
  return createHash("sha256").update(`guestops:cielo-access-token:${rootSecret}`).digest();
}

function encryptToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

function decryptToken(payload: string) {
  const buffer = Buffer.from(payload, "base64");
  if (buffer.length < 29) throw new Error("Stored Cielo credential is invalid");
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const ciphertext = buffer.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

async function storedToken(orgId: string) {
  const service = getSupabaseServiceClient();
  const { data, error } = await service
    .from("ac_provider_credentials")
    .select("encrypted_access_token")
    .eq("org_id", orgId)
    .eq("provider", "cielo")
    .maybeSingle<StoredCredential>();
  if (error) throw new Error(`Unable to read the Cielo connection: ${error.message}`);
  return data?.encrypted_access_token ? decryptToken(data.encrypted_access_token) : null;
}

async function exchangeApiKey(orgId: string) {
  // Vercel secrets are often pasted with surrounding whitespace or quotes.
  // Normalize only at the server boundary; the original secret is never logged.
  const apiKey = process.env.CIELOWIGLE_API?.trim().replace(/^['\"]|['\"]$/g, "");
  if (!apiKey) throw new Error("Cielo API key is not configured");
  const auth = await fetch(`${BASE_URL}/authenticate`, { method: "POST", headers: { "x-api-key": apiKey }, cache: "no-store" });
  const authBody = await auth.json().catch(() => null);
  if (!auth.ok) {
    const reason = [authBody?.message, authBody?.error, authBody?.detail].find((value) => typeof value === "string" && value.trim());
    throw new Error(`Cielo authentication failed (${auth.status})${reason ? `: ${reason}` : ""}`);
  }
  const token = authBody?.data?.access_token;
  if (typeof token !== "string" || !token) throw new Error("Cielo returned an invalid authentication response");
  const service = getSupabaseServiceClient();
  const { error } = await service.from("ac_provider_credentials").upsert({
    org_id: orgId,
    provider: "cielo",
    encrypted_access_token: encryptToken(token),
    updated_at: new Date().toISOString(),
  }, { onConflict: "org_id,provider" });
  if (error) throw new Error(`Cielo authenticated, but its access token could not be secured: ${error.message}`);
  return { apiKey, token };
}

export async function listCieloDevices(orgId: string): Promise<CieloDevice[]> {
  let token = await storedToken(orgId);
  let apiKey = process.env.CIELOWIGLE_API?.trim().replace(/^['\"]|['\"]$/g, "");
  if (!token) ({ apiKey, token } = await exchangeApiKey(orgId));
  if (!apiKey) throw new Error("Cielo API key is not configured");
  const response = await fetch(`${BASE_URL}/devices/?cached_appliance_ids=[]`, { headers: { "x-api-key": apiKey, Authorization: token }, cache: "no-store" });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("Cielo access token was rejected. Reconnect with a newly generated Cielo API key.");
    }
    throw new Error(`Cielo device discovery failed (${response.status})`);
  }
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
