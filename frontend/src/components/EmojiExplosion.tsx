import { useEffect, useState } from "react";
import { getEffect } from "../constants/effects";
import type { EffectType } from "../types";

interface EmojiExplosionProps {
  effect: EffectType;
  onComplete?: () => void;
}

interface Particle {
  id: number;
  emoji: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  scale: number;
  opacity: number;
}

export function EmojiExplosion({ effect, onComplete }: EmojiExplosionProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (effect === "none") {
      onComplete?.();
      return;
    }

    const effectData = getEffect(effect);
    const emojis = effectData.emojis;
    if (emojis.length === 0) {
      onComplete?.();
      return;
    }

    const newParticles: Particle[] = [];
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    for (let i = 0; i < 30; i++) {
      const angle = (Math.PI * 2 * i) / 30 + Math.random() * 0.5;
      const speed = 8 + Math.random() * 12;

      newParticles.push({
        id: i,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 5,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 20,
        scale: 0.8 + Math.random() * 0.8,
        opacity: 1,
      });
    }

    setParticles(newParticles);

    let frame = 0;
    const maxFrames = 60;

    const animate = () => {
      frame++;

      setParticles((prev) =>
        prev.map((p) => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          vy: p.vy + 0.5,
          rotation: p.rotation + p.rotationSpeed,
          opacity: 1 - frame / maxFrames,
        }))
      );

      if (frame < maxFrames) {
        requestAnimationFrame(animate);
      } else {
        setParticles([]);
        onComplete?.();
      }
    };

    requestAnimationFrame(animate);
  }, [effect, onComplete]);

  if (particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[200]">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute text-3xl"
          style={{
            left: p.x,
            top: p.y,
            transform: `translate(-50%, -50%) rotate(${p.rotation}deg) scale(${p.scale})`,
            opacity: p.opacity,
          }}
        >
          {p.emoji}
        </div>
      ))}
    </div>
  );
}
