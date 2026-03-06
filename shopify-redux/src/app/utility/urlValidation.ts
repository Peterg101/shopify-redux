const ALLOWED_PROTOCOLS = ['https:'];
const DEV_ALLOWED_PROTOCOLS = ['http:', 'https:'];

export function isValidRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const allowedProtocols = process.env.NODE_ENV === 'development'
      ? DEV_ALLOWED_PROTOCOLS
      : ALLOWED_PROTOCOLS;
    return allowedProtocols.includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function safeRedirect(url: string): void {
  if (isValidRedirectUrl(url)) {
    window.location.href = url;
  } else {
    console.error('Blocked redirect to unsafe URL:', url);
  }
}
