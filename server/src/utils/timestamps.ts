export function toIsoTimestamp(value: string | Date) {
  return value instanceof Date ? value.toISOString() : value;
}
