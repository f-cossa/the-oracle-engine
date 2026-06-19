interface SoundWavesProps {
  active?: boolean;
}

export function SoundWaves({ active = false }: SoundWavesProps) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div
        className={`absolute size-full rounded-full border ${
          active
            ? "border-cyan-vivid/70 wave-delay-1"
            : "border-cyan-vivid/30 wave-delay-1"
        }`}
      />
      <div
        className={`absolute size-full rounded-full border ${
          active ? "border-cyan-vivid/50 wave-delay-2" : "border-cyan-vivid/20 wave-delay-2"
        }`}
      />
      <div
        className={`absolute size-full rounded-full border ${
          active ? "border-cyan-vivid/40 wave-delay-3" : "border-cyan-vivid/10 wave-delay-3"
        }`}
      />
    </div>
  );
}
