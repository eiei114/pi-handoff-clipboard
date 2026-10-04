export function pushUnique(
  target: string[],
  seen: Set<string>,
  value: string | undefined,
  normalize: (value: string) => string = (candidate) => candidate,
): void {
  if (!value) {
    return;
  }

  const normalized = normalize(value);
  if (!normalized || seen.has(normalized)) {
    return;
  }

  seen.add(normalized);
  target.push(normalized);
}
