import { useEffect, useRef, useState } from 'react';

const KONAMI = [
  'ArrowUp','ArrowUp','ArrowDown','ArrowDown',
  'ArrowLeft','ArrowRight','ArrowLeft','ArrowRight',
  'b','a',
];

function Confetti({ canvasRef }) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#818cf8','#a78bfa','#34d399','#f59e0b','#f472b6','#60a5fa'];
    const particles = Array.from({ length: 160 }, () => ({
      x:    Math.random() * canvas.width,
      y:    Math.random() * -canvas.height,
      w:    6 + Math.random() * 8,
      h:    10 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      speed: 3 + Math.random() * 4,
      angle: Math.random() * Math.PI * 2,
      spin:  (Math.random() - 0.5) * 0.2,
    }));

    let raf;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.y     += p.speed;
        p.angle += p.spin;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(raf);
  }, [canvasRef]);

  return null;
}

export default function KonamiEasterEgg() {
  const [active, setActive]   = useState(false);
  const seqRef                = useRef([]);
  const canvasRef             = useRef(null);
  const timerRef              = useRef(null);

  useEffect(() => {
    function onKey(e) {
      seqRef.current = [...seqRef.current, e.key].slice(-KONAMI.length);
      if (seqRef.current.join(',') === KONAMI.join(',')) {
        setActive(true);
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setActive(false), 4000);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!active) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      onClick={() => setActive(false)}
    >
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
      <Confetti canvasRef={canvasRef} />
      <div className="relative text-center select-none">
        <p className="text-2xl font-bold text-white drop-shadow-lg">All systems go</p>
        <p className="text-sm text-white/60 mt-1 drop-shadow">↑↑↓↓←→←→BA</p>
      </div>
    </div>
  );
}
