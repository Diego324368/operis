export const digits = (s: string) => s.replace(/\D/g, '');
/** Máscara simples de telefone brasileiro: (11) 98765-4321 / (11) 3456-7890 */
export function maskPhone(v: string) {
  const d = digits(v).slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
export const whatsappLink = (phone: string) => `https://wa.me/${digits(phone).length <= 11 ? '55' : ''}${digits(phone)}`;
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
export const fmtMinutes = (m: number) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
