const DEFAULT_PUBLIC_APP_URL = "https://guestopshq.com";

/**
 * Twilio signs the exact webhook URL. Do not reconstruct that URL from request
 * forwarding headers: those headers are outside the application trust boundary.
 */
export function getPublicAppBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const candidate = configured || DEFAULT_PUBLIC_APP_URL;

  try {
    return new URL(candidate).origin;
  } catch {
    return DEFAULT_PUBLIC_APP_URL;
  }
}

export function getTrustedTwilioWebhookUrl(req: Request): string {
  const requestUrl = new URL(req.url);
  return `${getPublicAppBaseUrl()}${requestUrl.pathname}${requestUrl.search}`;
}
