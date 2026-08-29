export function extractRegisterToken(request: Request, bodyToken?: string | null): string {
  const header = request.headers.get("x-register-token")?.trim() ?? "";
  if (header) return header;
  return bodyToken?.trim() ?? "";
}
