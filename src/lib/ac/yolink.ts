type YoLinkDevice = {
  deviceId: string;
  name?: string;
  type?: string;
  modelName?: string;
  parentDeviceId?: string | null;
};

function credentials() {
  const uaid = process.env.YOLINK_UAID;
  const secret = process.env.YOLINK_UAC_SECRET;
  if (!uaid || !secret) throw new Error("YoLink credentials are not configured on the server");
  return { uaid, secret };
}

async function accessToken() {
  const { uaid, secret } = credentials();
  const body = new URLSearchParams({ grant_type: "client_credentials", client_id: uaid, client_secret: secret });
  const response = await fetch("https://api.yosmart.com/open/yolink/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.access_token) throw new Error("YoLink did not issue an access token");
  return String(payload.access_token);
}

export async function listYoLinkDevices(): Promise<YoLinkDevice[]> {
  const token = await accessToken();
  const response = await fetch("https://api.yosmart.com/open/yolink/v2/api", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ method: "Home.getDeviceList", time: Date.now() }), cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.code !== "000000" || !Array.isArray(payload?.data?.devices)) throw new Error(payload?.desc ?? "YoLink device discovery failed");
  return payload.data.devices.filter((device: any): device is YoLinkDevice => typeof device?.deviceId === "string");
}
