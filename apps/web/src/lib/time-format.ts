export function formatOperatorDateTime(value?: string | null) {
  if (!value) {
    return "n/a";
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZoneName: "short",
    year: "numeric",
  });
}

export function formatOperatorTime(value?: string | null) {
  if (!value) {
    return "n/a";
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
}
