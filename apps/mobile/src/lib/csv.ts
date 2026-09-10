export function escapeCsvCell(value: unknown): string {
    const text = value == null ? '' : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv<T extends Record<string, unknown>>(rows: T[]): string {
    if (rows.length === 0) return '';
    const headers = Object.keys(rows[0]);
    const lines = [headers.map(escapeCsvCell).join(',')];
    for (const row of rows) {
        lines.push(headers.map((header) => escapeCsvCell(row[header])).join(','));
    }
    return `\uFEFF${lines.join('\r\n')}\r\n`;
}
