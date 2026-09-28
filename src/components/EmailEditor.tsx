"use client";

import { useRef, useState } from "react";
import { useEditor, useEditorState, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { VARIABLES } from "@/lib/personalize";

// HTML que el editor visual no sabe representar y simplificaría al cargarlo.
const HTML_COMPLEJO = /<(table|div|span|img|style|font|center|td)\b|\sstyle=/i;

type Props = {
  value: string;
  onChange: (html: string) => void;
  minHeight?: number;
};

function Boton({
  activo,
  onClick,
  titulo,
  children,
}: {
  activo?: boolean;
  onClick: () => void;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      aria-pressed={activo}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`min-w-8 rounded-md px-2 py-1 text-sm transition-colors ${
        activo ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:bg-surface hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function BarraFormato({ editor }: { editor: Editor }) {
  const estado = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      negrita: e.isActive("bold"),
      cursiva: e.isActive("italic"),
      subrayado: e.isActive("underline"),
      titulo: e.isActive("heading", { level: 2 }),
      vinetas: e.isActive("bulletList"),
      numerada: e.isActive("orderedList"),
      enlace: e.isActive("link"),
    }),
  });

  function editarEnlace() {
    const actual = editor.getAttributes("link").href ?? "";
    const url = window.prompt("Dirección del enlace (dejá vacío para quitarlo):", actual);
    if (url === null) return;
    if (url.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    const href = /^(https?:|mailto:)/i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  }

  return (
    <>
      <Boton titulo="Negrita" activo={estado.negrita} onClick={() => editor.chain().focus().toggleBold().run()}>
        <b>B</b>
      </Boton>
      <Boton titulo="Cursiva" activo={estado.cursiva} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <i>I</i>
      </Boton>
      <Boton titulo="Subrayado" activo={estado.subrayado} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <u>S</u>
      </Boton>
      <Boton titulo="Título" activo={estado.titulo} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        T
      </Boton>
      <Boton titulo="Lista con viñetas" activo={estado.vinetas} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        •≡
      </Boton>
      <Boton titulo="Lista numerada" activo={estado.numerada} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        1.
      </Boton>
      <Boton titulo="Enlace" activo={estado.enlace} onClick={editarEnlace}>
        <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true" className="inline">
          <path d="M3.9 12a3.1 3.1 0 0 1 3.1-3.1h4V7H7a5 5 0 0 0 0 10h4v-1.9H7A3.1 3.1 0 0 1 3.9 12zM8 13h8v-2H8v2zm9-6h-4v1.9h4a3.1 3.1 0 0 1 0 6.2h-4V17h4a5 5 0 0 0 0-10z" />
        </svg>
      </Boton>
    </>
  );
}

export default function EmailEditor({ value, onChange, minHeight = 220 }: Props) {
  const [modoHtml, setModoHtml] = useState(() => HTML_COMPLEJO.test(value));
  const areaHtml = useRef<HTMLTextAreaElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
    ],
    content: modoHtml ? "" : value,
    editorProps: { attributes: { class: "editor-contenido", style: `min-height:${minHeight}px` } },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? "" : e.getHTML()),
  });

  function insertarVariable(clave: string) {
    const texto = `{{${clave}}}`;
    if (!modoHtml) {
      editor?.chain().focus().insertContent(texto).run();
      return;
    }
    const area = areaHtml.current;
    const inicio = area?.selectionStart ?? value.length;
    const fin = area?.selectionEnd ?? value.length;
    onChange(value.slice(0, inicio) + texto + value.slice(fin));
    requestAnimationFrame(() => {
      area?.focus();
      area?.setSelectionRange(inicio + texto.length, inicio + texto.length);
    });
  }

  function cambiarModo() {
    if (!modoHtml) {
      setModoHtml(true);
      return;
    }
    if (
      HTML_COMPLEJO.test(value) &&
      !window.confirm(
        "Este HTML tiene elementos (tablas, estilos, imágenes…) que el editor visual va a simplificar o quitar. ¿Pasar igual al editor visual?"
      )
    ) {
      return;
    }
    editor?.commands.setContent(value, { emitUpdate: true });
    setModoHtml(false);
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface focus-within:outline-2 focus-within:outline-series-1">
      <div className="flex flex-wrap items-center gap-1 border-b border-line bg-surface-2 px-2 py-1.5">
        {!modoHtml && editor && <BarraFormato editor={editor} />}
        <select
          aria-label="Insertar variable"
          className="ml-auto rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink-2"
          value=""
          onChange={(e) => e.target.value && insertarVariable(e.target.value)}
        >
          <option value="">+ Variable</option>
          {VARIABLES.map((v) => (
            <option key={v.clave} value={v.clave}>
              {`{{${v.clave}}}`} · {v.descripcion}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={cambiarModo}
          className="rounded-md px-2 py-1 text-sm text-ink-2 hover:bg-surface hover:text-ink"
        >
          {modoHtml ? "Editor visual" : "</> HTML"}
        </button>
      </div>

      {modoHtml ? (
        <textarea
          ref={areaHtml}
          className="block w-full resize-y bg-surface px-3 py-2 font-mono text-sm text-ink outline-none"
          style={{ minHeight }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
        />
      ) : (
        <EditorContent editor={editor} />
      )}
    </div>
  );
}
