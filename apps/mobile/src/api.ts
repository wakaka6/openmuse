import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const STORAGE_KEY = "openmuse.serverUrl";

/** Build-time default baked into the app bundle. */
export const defaultApiUrl = (
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === "android" ? "http://10.0.2.2:8787" : "http://localhost:8787")
).replace(/\/$/, "");

let apiUrl = defaultApiUrl;

/** Loads the user-configured server address saved on this device. */
export async function loadServerUrl() {
  const saved = await AsyncStorage.getItem(STORAGE_KEY);
  if (saved) apiUrl = saved;
  return apiUrl;
}

/** The server address every request is sent to; may differ from the build default. */
export function getApiUrl() {
  return apiUrl;
}

/** Normalizes user input into a usable URL, defaulting to http. */
export function normalizeServerUrl(input: string) {
  const trimmed = input.trim().replace(/\/+$/, "");
  if (!trimmed) throw new Error("Enter your OpenMuse server address.");
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  const parsed = new URL(withScheme);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
    throw new Error("Server address must use http or https.");
  return parsed.origin + (parsed.pathname === "/" ? "" : parsed.pathname);
}

/** Persists the server address on this device; reconnect after calling this. */
export async function setServerUrl(input: string) {
  apiUrl = normalizeServerUrl(input);
  if (apiUrl === defaultApiUrl) await AsyncStorage.removeItem(STORAGE_KEY);
  else await AsyncStorage.setItem(STORAGE_KEY, apiUrl);
  return apiUrl;
}

export class MuseApi {
  constructor(readonly token: string) {}
  async request<T>(path: string, body?: unknown, method?: string): Promise<T> {
    const response = await fetch(`${apiUrl}${path}`, {
      method: method ?? (body === undefined ? "GET" : "POST"),
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...(body === undefined || body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok)
      throw new Error(
        typeof payload.error === "string" ? payload.error : `Request failed (${response.status})`,
      );
    return payload;
  }
  url(path: string) {
    return path.startsWith("http") ? path : `${apiUrl}${path}`;
  }
}

export async function createSession(
  accessKey?: string,
): Promise<{ token: string; mode: "sample" | "live" }> {
  const response = await fetch(`${apiUrl}/api/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessKey }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Could not open your workspace.");
  return payload;
}
