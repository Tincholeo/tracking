"use client";

import { use, useState } from "react";

export default function Baja({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [estado, setEstado] = useState<"inicial" | "enviando" | "listo" | "error">("inicial");

  async function confirmar() {
    setEstado("enviando");
    const res = await fetch(`/api/unsubscribe/${id}`, { method: "POST" });
    setEstado(res.ok ? "listo" : "error");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-4">
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-6 text-center">
        {estado === "listo" ? (
          <>
            <h1 className="text-lg font-semibold text-ink">Te diste de baja</h1>
            <p className="mt-2 text-sm text-ink-2">No vas a recibir más correos nuestros.</p>
          </>
        ) : estado === "error" ? (
          <>
            <h1 className="text-lg font-semibold text-ink">No pudimos procesar la baja</h1>
            <p className="mt-2 text-sm text-ink-2">El enlace no es válido o venció. Respondé el correo pidiendo la baja y lo hacemos a mano.</p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-ink">¿Dejar de recibir correos?</h1>
            <p className="mt-2 text-sm text-ink-2">Confirmá y no te vamos a escribir más.</p>
            <button
              onClick={confirmar}
              disabled={estado === "enviando"}
              className="mt-5 w-full rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-page disabled:opacity-50"
            >
              {estado === "enviando" ? "Procesando…" : "Confirmar baja"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
