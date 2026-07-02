import React, { useEffect, useState } from "react";
import api from "../lib/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BookText, Download } from "lucide-react";
import { toast } from "sonner";

export default function Manual() {
  const [md, setMd] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { const { data } = await api.get("/manual"); setMd(data.markdown || ""); }
      catch (e) { toast.error("Falha ao carregar o manual"); }
      finally { setLoading(false); }
    })();
  }, []);

  const downloadPdf = async () => {
    toast.message("Gerando PDF...");
    try {
      const res = await api.get("/manual/pdf", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url; a.download = "manual_fs_solucoes.pdf";
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) { toast.error("Falha ao gerar o PDF"); }
  };

  return (
    <div className="space-y-4" data-testid="manual-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BookText size={22} /> Manual do Sistema
          </h2>
          <p className="text-sm text-slate-500">Guia completo de uso — acesso restrito ao administrador</p>
        </div>
        <button data-testid="download-manual-pdf" onClick={downloadPdf} className="h-9 px-4 text-sm bg-slate-900 text-white rounded-md flex items-center gap-2 hover:bg-slate-800">
          <Download size={15} /> Baixar PDF
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6 md:p-8" data-testid="manual-content">
        {loading ? (
          <div className="text-slate-500 text-sm">Carregando manual...</div>
        ) : (
          <div className="manual-prose">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
