import { useEffect, useRef, useState } from "react";

// Fades + lifts its child into view once, when it scrolls on screen.
// `delay` (ms) lets you stagger siblings in a grid.
export default function Reveal({ children, className = "", delay = 0 }) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`m-reveal${seen ? " in" : ""} ${className}`}
      style={{ "--d": delay }}
    >
      {children}
    </div>
  );
}