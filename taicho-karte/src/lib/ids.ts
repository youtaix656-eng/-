export function newId(at: number = Date.now()): string {
  return `${at.toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}
