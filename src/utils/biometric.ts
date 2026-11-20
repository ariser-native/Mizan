export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.credentials !== 'undefined'
  );
}

export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): ArrayBuffer {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function registerBiometricCredential(userLabel = 'Mizan Vault'): Promise<{
  ok: true;
  credentialId: string;
} | {
  ok: false;
  error: string;
}> {
  if (!isWebAuthnSupported()) {
    return {
      ok: false,
      error: 'WebAuthn biometrics are unavailable in this browser. Use a 4-digit Privacy PIN instead.',
    };
  }

  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    const userId = new Uint8Array(16);
    crypto.getRandomValues(userId);

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'Mizan Financial Ledger' },
        user: {
          id: userId,
          name: userLabel,
          displayName: userLabel,
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },
          { alg: -257, type: 'public-key' },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
        },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;

    if (!credential) {
      return { ok: false, error: 'Biometric registration was cancelled.' };
    }

    return { ok: true, credentialId: toBase64Url(credential.rawId) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Biometric enrollment failed.';
    return {
      ok: false,
      error: `Device biometric prompt unavailable (${msg}). Please use a Privacy PIN.`,
    };
  }
}

export async function verifyBiometricCredential(credentialId: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  if (!isWebAuthnSupported()) {
    return { ok: false, error: 'WebAuthn is not supported in this browser.' };
  }

  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [
          {
            id: fromBase64Url(credentialId),
            type: 'public-key',
          },
        ],
        userVerification: 'required',
        timeout: 60000,
      },
    });

    return { ok: Boolean(assertion) };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Biometric verification failed.',
    };
  }
}

export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`mizan_pin_salt_v1:${pin}`);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', data);
    return toBase64Url(digest);
  }
  // Deterministic fallback for non-secure contexts
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = (hash * 31 + data[i]) >>> 0;
  }
  return `fb_${hash.toString(16)}`;
}

export async function verifyPin(pin: string, expectedHash: string): Promise<boolean> {
  const computed = await hashPin(pin);
  return computed === expectedHash;
}
