export function formatFecha(valor: string) {
  return new Date(valor).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function porcentaje(parte: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((parte / total) * 100)}%`;
}
