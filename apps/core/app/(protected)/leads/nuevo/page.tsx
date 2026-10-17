import Link from "next/link";
import { NewLeadForm } from "@/components/leads/new-lead-form";

// Alta manual: mensajes directos, comentarios, referidos o eventos. Los leads del sitio llegan solos.
export default function NewLeadPage() {
  return (
    <>
      <Link href="/leads" className="sub" style={{ display: "inline-block", marginBottom: 10 }}>
        ← Leads
      </Link>
      <div className="page-head">
        <div>
          <h1>Nuevo lead</h1>
          <p>Registra una persona que llegó por una red social, un mensaje directo, un referido o un evento. Indica de dónde vino.</p>
        </div>
      </div>
      <NewLeadForm />
    </>
  );
}
