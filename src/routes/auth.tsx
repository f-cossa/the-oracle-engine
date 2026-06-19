import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Mail, KeyRound, ShieldCheck, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { derivePassword, isPin } from "@/lib/auth-helpers";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — A VOZ E A VERDADE" },
      {
        name: "description",
        content: "Acede ao oráculo. Identificação por e-mail e PIN de 4 dígitos.",
      },
    ],
  }),
  component: AuthPage,
});

type Step =
  | { kind: "email" }
  | { kind: "code"; email: string; mode: "signup" | "signin" }
  | { kind: "create-pin"; email: string }
  | { kind: "enter-pin"; email: string };

function AuthPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>({ kind: "email" });
  const [busy, setBusy] = useState(false);

  // If already signed in, leave.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-obsidian px-6 text-foreground scanlines">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        aria-hidden="true"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 50% 30%, rgba(0,242,255,0.22) 0%, transparent 55%)",
        }}
      />

      <div className="relative z-10 w-full max-w-md fade-up">
        <div className="mb-10 text-center">
          <h1 className="font-display text-2xl font-bold uppercase tracking-tighter">
            A Voz e a <span className="text-cyan-vivid">Verdade</span>
          </h1>
          <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-ghost">
            Revelando o que o sistema esconde
          </p>
        </div>

        <div className="border border-cyan-vivid/20 bg-obsidian/80 p-7 backdrop-blur-sm">
          {step.kind === "email" && (
            <EmailStep
              busy={busy}
              setBusy={setBusy}
              onContinue={(email, mode) =>
                setStep({ kind: "code", email, mode })
              }
              onPinExisting={(email) => setStep({ kind: "enter-pin", email })}
            />
          )}
          {step.kind === "code" && (
            <CodeStep
              email={step.email}
              busy={busy}
              setBusy={setBusy}
              onBack={() => setStep({ kind: "email" })}
              onVerified={() => setStep({ kind: "create-pin", email: step.email })}
            />
          )}
          {step.kind === "create-pin" && (
            <CreatePinStep
              email={step.email}
              busy={busy}
              setBusy={setBusy}
              onDone={() => navigate({ to: "/", replace: true })}
            />
          )}
          {step.kind === "enter-pin" && (
            <EnterPinStep
              email={step.email}
              busy={busy}
              setBusy={setBusy}
              onBack={() => setStep({ kind: "email" })}
              onForgotPin={() => setStep({ kind: "code", email: step.email, mode: "signup" })}
              onDone={() => navigate({ to: "/", replace: true })}
            />
          )}
        </div>

        <p className="mt-6 text-center text-[10px] uppercase tracking-[0.25em] text-ghost/60">
          © Faustino Job Cossa · Todos os direitos reservados
        </p>
      </div>
    </div>
  );
}

/* ---------- Steps ---------- */

function EmailStep({
  busy,
  setBusy,
  onContinue,
  onPinExisting,
}: {
  busy: boolean;
  setBusy: (b: boolean) => void;
  onContinue: (email: string, mode: "signup" | "signin") => void;
  onPinExisting: (email: string) => void;
}) {
  const [email, setEmail] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
      toast.error("Insere um e-mail válido.");
      return;
    }
    setBusy(true);
    try {
      // Try to fetch a profile flag via signing in with a dummy password — instead
      // we just send an OTP and let the user enter PIN if known. Simpler:
      // send OTP for fresh signups; if the user knows the PIN, they can skip.
      // To distinguish, we ask the server: try sign-in with an invalid password;
      // if it returns "Invalid login" the email already exists.
      const probe = await supabase.auth.signInWithPassword({
        email: trimmed,
        password: "__voz_probe__not_a_real_password__",
      });

      // If credentials are invalid -> account exists.
      const errMsg = probe.error?.message?.toLowerCase() ?? "";
      const accountExists = errMsg.includes("invalid login") || errMsg.includes("invalid_credentials");

      if (accountExists) {
        onPinExisting(trimmed);
      } else {
        // Send OTP code (creates user if missing).
        const { error } = await supabase.auth.signInWithOtp({
          email: trimmed,
          options: { shouldCreateUser: true },
        });
        if (error) throw error;
        toast.success("Código enviado para o teu e-mail.");
        onContinue(trimmed, "signup");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao enviar código.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Header
        icon={<Mail className="size-3.5" />}
        kicker="Passo 01"
        title="Identificação"
        subtitle="Insere o teu e-mail. Enviamos um código único."
      />
      <input
        type="email"
        autoComplete="email"
        autoFocus
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="teu@email.com"
        className="w-full border border-cyan-vivid/30 bg-obsidian/60 px-4 py-3 text-sm text-foreground placeholder:text-ghost/50 outline-none focus:border-cyan-vivid"
      />
      <PrimaryButton busy={busy}>Continuar</PrimaryButton>
    </form>
  );
}

function CodeStep({
  email,
  busy,
  setBusy,
  onBack,
  onVerified,
}: {
  email: string;
  busy: boolean;
  setBusy: (b: boolean) => void;
  onBack: () => void;
  onVerified: () => void;
}) {
  const [code, setCode] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const token = code.trim();
    if (token.length < 6) {
      toast.error("Código de 6 dígitos.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "email",
      });
      if (error) throw error;
      onVerified();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Código inválido.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      toast.success("Código reenviado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao reenviar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <BackBtn onClick={onBack} />
      <Header
        icon={<ShieldCheck className="size-3.5" />}
        kicker="Passo 02"
        title="Verificação"
        subtitle={`Insere o código enviado para ${email}.`}
      />
      <input
        inputMode="numeric"
        pattern="\d*"
        maxLength={6}
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        placeholder="••••••"
        className="w-full border border-cyan-vivid/30 bg-obsidian/60 px-4 py-3 text-center font-mono text-2xl tracking-[0.6em] text-foreground placeholder:text-ghost/50 outline-none focus:border-cyan-vivid"
      />
      <PrimaryButton busy={busy}>Verificar</PrimaryButton>
      <button
        type="button"
        onClick={resend}
        disabled={busy}
        className="block w-full text-center text-[10px] uppercase tracking-[0.3em] text-ghost hover:text-cyan-vivid"
      >
        Reenviar código
      </button>
    </form>
  );
}

function CreatePinStep({
  email,
  busy,
  setBusy,
  onDone,
}: {
  email: string;
  busy: boolean;
  setBusy: (b: boolean) => void;
  onDone: () => void;
}) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isPin(pin)) {
      toast.error("PIN deve ter 4 dígitos.");
      return;
    }
    if (pin !== confirmPin) {
      toast.error("Os PINs não coincidem.");
      return;
    }
    setBusy(true);
    try {
      const password = derivePassword(email, pin);
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await supabase
        .from("profiles")
        .update({ pin_set: true })
        .eq("email", email);
      toast.success("PIN criado. Bem-vindo à Verdade.");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao gravar PIN.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Header
        icon={<KeyRound className="size-3.5" />}
        kicker="Passo 03"
        title="Cria o teu PIN"
        subtitle="4 dígitos. Vais usá-lo para entrar nas próximas vezes."
      />
      <PinInput value={pin} onChange={setPin} placeholder="PIN" />
      <PinInput value={confirmPin} onChange={setConfirmPin} placeholder="Confirma" />
      <PrimaryButton busy={busy}>Selar PIN</PrimaryButton>
    </form>
  );
}

function EnterPinStep({
  email,
  busy,
  setBusy,
  onBack,
  onForgotPin,
  onDone,
}: {
  email: string;
  busy: boolean;
  setBusy: (b: boolean) => void;
  onBack: () => void;
  onForgotPin: () => void;
  onDone: () => void;
}) {
  const [pin, setPin] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isPin(pin)) {
      toast.error("PIN deve ter 4 dígitos.");
      return;
    }
    setBusy(true);
    try {
      const password = derivePassword(email, pin);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error("PIN incorrecto.");
        return;
      }
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao entrar.");
    } finally {
      setBusy(false);
    }
  }

  async function forgot() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (error) throw error;
      toast.success("Código enviado para redefinir PIN.");
      onForgotPin();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <BackBtn onClick={onBack} />
      <Header
        icon={<KeyRound className="size-3.5" />}
        kicker="Acesso"
        title="Insere o teu PIN"
        subtitle={email}
      />
      <PinInput value={pin} onChange={setPin} autoFocus />
      <PrimaryButton busy={busy}>Entrar</PrimaryButton>
      <button
        type="button"
        onClick={forgot}
        disabled={busy}
        className="block w-full text-center text-[10px] uppercase tracking-[0.3em] text-ghost hover:text-cyan-vivid"
      >
        Esqueci o PIN
      </button>
    </form>
  );
}

/* ---------- Bits ---------- */

function Header({
  icon,
  kicker,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  kicker: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-cyan-vivid/70">
        {icon}
        {kicker}
      </p>
      <h2 className="mt-2 font-display text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-xs text-ghost">{subtitle}</p>
    </div>
  );
}

function PrimaryButton({
  busy,
  children,
}: {
  busy: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="flex w-full items-center justify-center gap-2 border border-cyan-vivid bg-cyan-vivid py-3 text-xs font-bold uppercase tracking-[0.3em] text-obsidian transition-colors hover:bg-white disabled:opacity-50"
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : children}
    </button>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-ghost hover:text-cyan-vivid"
    >
      <ArrowLeft className="size-3" />
      Voltar
    </button>
  );
}

function PinInput({
  value,
  onChange,
  autoFocus,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  return (
    <input
      type="password"
      inputMode="numeric"
      pattern="\d*"
      maxLength={4}
      autoFocus={autoFocus}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
      placeholder={placeholder ?? "••••"}
      className="w-full border border-cyan-vivid/30 bg-obsidian/60 px-4 py-3 text-center font-mono text-2xl tracking-[0.7em] text-foreground placeholder:text-ghost/50 outline-none focus:border-cyan-vivid"
    />
  );
}
