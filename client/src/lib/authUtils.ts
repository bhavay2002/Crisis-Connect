export function isUnauthorizedError(error: Error): boolean {
  return error.message.startsWith("401:");
}
