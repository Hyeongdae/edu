import { useEffect, useRef, useState, type ReactElement } from "react";
import "./point-effects.css";

export function PointGainFeedback({ revision }: { revision: number }): ReactElement | null {
  const [visible, setVisible] = useState(false);
  const previousRevision = useRef(revision);
  const queued = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const gained = Math.max(0, revision - previousRevision.current);
    previousRevision.current = revision;
    if (!gained) return;
    queued.current += gained;
    if (timer.current !== undefined) return;
    const showNext = () => {
      if (queued.current <= 0) { timer.current = undefined; return; }
      queued.current -= 1;
      setVisible(true);
      timer.current = window.setTimeout(() => {
        setVisible(false);
        timer.current = window.setTimeout(showNext, 80);
      }, 600);
    };
    showNext();
  }, [revision]);

  useEffect(() => () => { if (timer.current !== undefined) window.clearTimeout(timer.current); }, []);
  if (!visible) return null;
  return <span className="point-gain-feedback" data-testid="point-gain-feedback" role="status" aria-live="polite">+1</span>;
}
