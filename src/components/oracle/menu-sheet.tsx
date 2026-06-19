import { useEffect, useState } from "react";
import { X, History, KeySquare, Film, ScrollText, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

interface MenuSheetProps {
  open: boolean;
  onClose: () => void;
}

interface HistoryRow {
  id: string;
  question: string;
  answer: string;
  created_at: string;
}

export function MenuSheet({ open, onClose }: MenuSheetProps) {
  const [tab, setTab] = useState<"history" | "info">("history");
  const [items, setItems] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("oracle_history")
      .select("id, question, answer, created_at")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (error) {
          console.error(error);
        } else if (data) {
          setItems(data as HistoryRow[]);
        }
        setLoading(false);
      });
  }, [open]);

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Sessão terminada.");
    navigate({ to: "/auth", replace: true });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex" onClick={onClose}>
      <div className="flex-1 bg-obsidian/70 backdrop-blur-sm" />
      <aside
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-md flex-col border-l border-cyan-vivid/20 bg-obsidian fade-up"
      >
        <header className="flex items-center justify-between border-b border-white/5 p-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-vivid/60">
              Arquivo
            </p>
            <h2 className="mt-1 font-display text-lg font-semibold tracking-tight">
              Câmara secreta
            </h2>
          </div>
          <button
            onClick={onClose}
            className="grid size-9 place-items-center border border-cyan-vivid/30 text-cyan-vivid/70 hover:text-cyan-vivid"
          >
            <X className="size-4" />
          </button>
        </header>

        <nav className="flex border-b border-white/5">
          <TabBtn
            active={tab === "history"}
            onClick={() => setTab("history")}
            icon={<History className="size-3.5" />}
            label="Histórico"
          />
          <TabBtn
            active={tab === "info"}
            onClick={() => setTab("info")}
            icon={<ScrollText className="size-3.5" />}
            label="Sobre"
          />
        </nav>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === "history" ? (
            loading ? (
              <p className="text-xs uppercase tracking-[0.3em] text-ghost">A descodificar…</p>
            ) : items.length === 0 ? (
              <p className="text-xs uppercase tracking-[0.3em] text-ghost">
                Sem registos. Faz a primeira pergunta.
              </p>
            ) : (
              <ul className="space-y-5">
                {items.map((it) => (
                  <li
                    key={it.id}
                    className="border-l border-cyan-vivid/30 pl-4"
                  >
                    <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-vivid/60">
                      {new Date(it.created_at).toLocaleString("pt-PT")}
                    </p>
                    <p className="mt-2 font-serif italic text-base text-ghost">
                      {it.question}
                    </p>
                    <p className="mt-2 line-clamp-4 text-sm text-foreground/90">
                      {it.answer}
                    </p>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <div className="space-y-4 text-sm text-ghost">
              <p>
                <span className="font-display font-semibold text-foreground">
                  A VOZ E A VERDADE
                </span>{" "}
                é uma plataforma de inteligência artificial enigmática, focada em
                revelar mistérios da sociedade, história e espiritualidade.
              </p>
              <p className="font-serif italic text-foreground">
                "Revelando o que o sistema esconde."
              </p>
              <ul className="space-y-2 pt-4 text-xs uppercase tracking-[0.2em]">
                <li className="flex items-center gap-3">
                  <KeySquare className="size-3.5 text-cyan-vivid" />
                  Autor: Faustino Job Cossa
                </li>
                <li className="flex items-center gap-3">
                  <Film className="size-3.5 text-cyan-vivid" />
                  Vídeo gerado por IA — em breve (Premium)
                </li>
              </ul>
            </div>
          )}
        </div>

        <footer className="border-t border-white/5 p-6">
          <button
            onClick={signOut}
            className="flex w-full items-center justify-center gap-2 border border-cyan-vivid/30 py-3 text-[11px] uppercase tracking-[0.3em] text-cyan-vivid transition-colors hover:bg-cyan-vivid hover:text-obsidian"
          >
            <LogOut className="size-3.5" />
            Terminar sessão
          </button>
        </footer>
      </aside>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 py-3 text-[10px] uppercase tracking-[0.3em] transition-colors ${
        active
          ? "border-b-2 border-cyan-vivid text-cyan-vivid"
          : "text-ghost hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
