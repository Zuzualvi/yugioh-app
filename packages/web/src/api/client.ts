/**
 * Base API client — thin fetch wrapper following Spec-13 error shape.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.headers ?? {}),
      ...(init?.body && typeof init.body === "string" && !init.headers
        ? { "Content-Type": "application/json" }
        : {}),
    },
  });

  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get("content-type") ?? "";

  if (!res.ok) {
    if (contentType.includes("application/json")) {
      const body = (await res.json()) as { error: { code: string; message: string } };
      throw new ApiError(res.status, body.error.code, body.error.message);
    }
    throw new ApiError(res.status, "unknown_error", res.statusText);
  }

  if (contentType.includes("text/plain")) {
    return (await res.text()) as unknown as T;
  }

  return res.json() as Promise<T>;
}

export function get<T>(path: string): Promise<T> {
  return request<T>(path);
}

export function post<T>(path: string, body?: unknown, contentType?: string): Promise<T> {
  if (contentType === "text/plain") {
    return request<T>(path, {
      method: "POST",
      body: body as string,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return request<T>(path, {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
  });
}

export function put<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "PUT",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
  });
}

export function del<T>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" });
}
