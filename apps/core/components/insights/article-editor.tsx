"use client";

import Link from "next/link";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExtension from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import {
  discardArticleAction,
  saveArticleContent,
  sendArticleToReviewAction,
  type ArticleSaveInput,
} from "@/app/(protected)/insights/actions";

export type EditorArticle = {
  id: string;
  title: string;
  excerpt: string | null;
  caseRef: string | null;
  langs: string[];
  status: "borrador" | "en_revision" | "publicado";
  content: Record<string, { title: string; subtitle?: string; body: JSONContent }>;
};

const LANGS = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "pt", label: "Português" },
];

const EMPTY_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

type Texts = Record<string, { title: string; subtitle: string }>;
type SaveStatus = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; at: string } | { kind: "error"; message: string };

/**
 * Editor de artículos al estilo de Medium: un lienzo centrado, título grande, texto con formato,
 * idiomas en pestañas y autoguardado. Escribir en un idioma nuevo lo añade al artículo.
 */
export function ArticleEditor({ article }: { article: EditorArticle }) {
  const published = article.status === "publicado";
  const [lang, setLang] = useState(article.langs[0] ?? "es");
  const [langs, setLangs] = useState<string[]>(article.langs.length ? article.langs : ["es"]);
  const [previewing, setPreviewing] = useState(false);
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });
  const [, setTick] = useState(0);
  const [excerpt, setExcerpt] = useState(article.excerpt ?? "");
  const [caseRef, setCaseRef] = useState(article.caseRef ?? "");
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);

  // Títulos y subtítulos viven en estado (se pintan). Una copia en ref la lee el autoguardado sin esperar un render.
  const initialTexts: Texts = Object.fromEntries(
    LANGS.map(({ value }) => [value, { title: article.content[value]?.title ?? "", subtitle: article.content[value]?.subtitle ?? "" }]),
  );
  const [texts, setTextsState] = useState<Texts>(initialTexts);
  const textsRef = useRef<Texts>(initialTexts);
  // El cuerpo de cada idioma se guarda en un ref: cambia con cada tecla y no debe re-renderizar el lienzo.
  const docs = useRef<Record<string, JSONContent>>(
    Object.fromEntries(LANGS.map(({ value }) => [value, article.content[value]?.body ?? EMPTY_DOC])),
  );
  const settings = useRef({ excerpt, caseRef });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeLang = useRef(lang);
  useEffect(() => {
    activeLang.current = lang;
  }, [lang]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      LinkExtension.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: "Cuenta tu historia…" }),
    ],
    content: article.content[article.langs[0] ?? "es"]?.body ?? EMPTY_DOC,
    editable: !published,
    immediatelyRender: false,
    onUpdate: ({ editor: instance }) => {
      docs.current[activeLang.current] = instance.getJSON();
      scheduleSave();
    },
    onTransaction: () => setTick((tick) => tick + 1),
  });

  const persist = useCallback(async (targetLang: string) => {
    const text = textsRef.current[targetLang];
    if (!text?.title.trim()) {
      setStatus({ kind: "error", message: "Escribe el título para guardar este idioma." });
      return;
    }
    setStatus({ kind: "saving" });
    const input: ArticleSaveInput = {
      id: article.id,
      lang: targetLang,
      title: text.title,
      subtitle: text.subtitle,
      body: docs.current[targetLang] as Record<string, unknown>,
      excerpt: settings.current.excerpt,
      caseRef: settings.current.caseRef,
    };
    const result = await saveArticleContent(input);
    setStatus(result.ok ? { kind: "saved", at: result.savedAt ?? new Date().toISOString() } : { kind: "error", message: result.message });
  }, [article.id]);

  // Autoguardado: espera 1,5 s sin cambios antes de guardar.
  function scheduleSave() {
    if (published) return;
    if (timer.current) clearTimeout(timer.current);
    setStatus({ kind: "saving" });
    timer.current = setTimeout(() => {
      timer.current = null;
      void persist(activeLang.current);
    }, 1500);
  }

  // Al salir de la página, guarda lo pendiente.
  useEffect(() => {
    const flush = () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
        void persist(activeLang.current);
      }
    };
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      flush();
    };
  }, [persist]);

  function switchLanguage(next: string) {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      void persist(activeLang.current);
    }
    setLang(next);
    if (!langs.includes(next)) setLangs((current) => [...current, next]);
    if (editor) editor.commands.setContent(docs.current[next] ?? EMPTY_DOC, { emitUpdate: false });
  }

  function setText(field: "title" | "subtitle", value: string) {
    const next: Texts = { ...textsRef.current, [lang]: { ...textsRef.current[lang], [field]: value } };
    textsRef.current = next;
    setTextsState(next);
    scheduleSave();
  }

  function setSetting(field: "excerpt" | "caseRef", value: string) {
    settings.current = { ...settings.current, [field]: value };
    if (field === "excerpt") setExcerpt(value);
    else setCaseRef(value);
    scheduleSave();
  }

  async function sendToReview() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    await persist(lang);
    const result = await sendArticleToReviewAction(article.id);
    setReviewMessage(result.message);
  }


  const toggle = (action: () => boolean) => () => {
    action();
    setTick((tick) => tick + 1);
  };

  const statusText =
    status.kind === "saving" ? "Guardando…" : status.kind === "saved" ? `Guardado ${new Date(status.at).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}` : status.kind === "error" ? status.message : "";

  return (
    <div className="article-editor">
      <div className="article-bar">
        <Link href="/insights" className="secondary" style={{ padding: "6px 10px", borderRadius: 6 }}>
          ← Artículos
        </Link>
        <span className="sub" aria-live="polite">{published ? "Publicado · solo lectura" : statusText}</span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button type="button" className="secondary" onClick={() => setPreviewing((value) => !value)}>
            {previewing ? "Editar" : "Vista previa"}
          </button>
          {article.status === "borrador" ? (
            <>
              <button type="button" className="primary" onClick={sendToReview}>Enviar a revisión</button>
              <ConfirmAction
                label="Descartar"
                title="¿Descartar este borrador?"
                body="Deja de verse; su número no se reutiliza."
                confirmLabel="Descartar borrador"
                onConfirm={() => discardArticleAction(article.id)}
              />
            </>
          ) : null}
        </div>
      </div>

      {article.status === "en_revision" ? (
        <p className="approval" role="note" style={{ margin: "12px auto", maxWidth: 680 }}>
          Este artículo está en revisión. Si lo editas, vuelve a borrador. Lo apruebas en{" "}
          <Link href="/aprobaciones">Aprobaciones</Link>.
        </p>
      ) : null}
      {reviewMessage ? <p role="status" className="notice-ok" style={{ maxWidth: 680, margin: "8px auto" }}>{reviewMessage}</p> : null}

      <div className="article-langs" role="tablist" aria-label="Idiomas">
        {LANGS.map((item) => {
          const present = langs.includes(item.value);
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={lang === item.value}
              className={lang === item.value ? "primary" : "secondary"}
              onClick={() => switchLanguage(item.value)}
            >
              {item.label}
              {!present ? " +" : ""}
            </button>
          );
        })}
      </div>

      {!previewing && editor && !published ? (
        <div className="article-toolbar" role="toolbar" aria-label="Formato">
          <button type="button" aria-pressed={editor.isActive("bold")} onClick={toggle(() => editor.chain().focus().toggleBold().run())}>B</button>
          <button type="button" aria-pressed={editor.isActive("italic")} onClick={toggle(() => editor.chain().focus().toggleItalic().run())}><i>I</i></button>
          <button type="button" aria-pressed={editor.isActive("heading", { level: 2 })} onClick={toggle(() => editor.chain().focus().toggleHeading({ level: 2 }).run())}>H2</button>
          <button type="button" aria-pressed={editor.isActive("heading", { level: 3 })} onClick={toggle(() => editor.chain().focus().toggleHeading({ level: 3 }).run())}>H3</button>
          <button type="button" aria-pressed={editor.isActive("blockquote")} onClick={toggle(() => editor.chain().focus().toggleBlockquote().run())}>“ ”</button>
          <button type="button" aria-pressed={editor.isActive("bulletList")} onClick={toggle(() => editor.chain().focus().toggleBulletList().run())}>• Lista</button>
          <button type="button" aria-pressed={editor.isActive("orderedList")} onClick={toggle(() => editor.chain().focus().toggleOrderedList().run())}>1. Lista</button>
          <button
            type="button"
            aria-pressed={editor.isActive("link")}
            onClick={toggle(() => {
              const previous = editor.getAttributes("link").href as string | undefined;
              const url = window.prompt("Enlace (https://…)", previous ?? "https://");
              if (url === null) return false;
              if (url === "") return editor.chain().focus().unsetLink().run();
              return editor.chain().focus().setLink({ href: url }).run();
            })}
          >
            Enlace
          </button>
          <button type="button" onClick={toggle(() => editor.chain().focus().setHorizontalRule().run())}>—</button>
          <button type="button" onClick={toggle(() => editor.chain().focus().undo().run())}>↶</button>
          <button type="button" onClick={toggle(() => editor.chain().focus().redo().run())}>↷</button>
        </div>
      ) : null}

      <div className="article-page">
        <input
          className="article-title"
          aria-label={`Título (${lang.toUpperCase()})`}
          placeholder="Título"
          defaultValue={texts[lang]?.title ?? ""}
          key={`title-${lang}`}
          readOnly={published || previewing}
          onChange={(event) => setText("title", event.target.value)}
        />
        <input
          className="article-subtitle"
          aria-label={`Subtítulo (${lang.toUpperCase()})`}
          placeholder="Subtítulo (opcional)"
          defaultValue={texts[lang]?.subtitle ?? ""}
          key={`subtitle-${lang}`}
          readOnly={published || previewing}
          onChange={(event) => setText("subtitle", event.target.value)}
        />
        <div className={previewing ? "article-body preview" : "article-body"}>
          {editor ? <EditorContent editor={editor} /> : <p className="muted">Cargando el editor…</p>}
        </div>
      </div>

      <details className="article-settings" open>
        <summary>Ajustes del artículo</summary>
        <label className="field">
          Resumen (aparece en la lista y en la vista previa de la red)
          <textarea value={excerpt} maxLength={300} disabled={published} onChange={(event) => setSetting("excerpt", event.target.value)} style={{ minHeight: 70 }} />
        </label>
        <label className="field">
          Caso relacionado (obligatorio para revisar)
          <input value={caseRef} maxLength={160} disabled={published} onChange={(event) => setSetting("caseRef", event.target.value)} placeholder="Escalabilidad SaaS (caso representativo)" />
        </label>
        <p className="sub" style={{ margin: 0 }}>Idiomas con contenido: {langs.map((item) => item.toUpperCase()).join(" · ")}</p>
      </details>
    </div>
  );
}
