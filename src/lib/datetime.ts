export function formatTime12h(value: string | number | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';

  // 12-hour clock, no seconds, include AM/PM (locale will decide spacing/case).
  return d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDate(value: string | number | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString();
}

export function formatDateTime12hTimeFirst(value: string | number | Date): string {
  const time = formatTime12h(value);
  const date = formatDate(value);
  if (!time) return date;
  if (!date) return time;
  return `${time} • ${date}`;
}
