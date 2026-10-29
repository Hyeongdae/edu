import { useEffect, useId, useRef, useState, type CSSProperties, type ReactElement } from "react";
import { PixelOfficer } from "./pixel/PixelOfficer";
import "./office-exit-ending.css";

export interface OfficeExitEndingProps {
  variant: "animated" | "complete";
  startedAtMs?: number;
}

export function OfficeExitEnding({ variant, startedAtMs }: OfficeExitEndingProps): ReactElement {
  const id = useId(), titleId = `${id}-office-exit-title`, doorClipId = `${id}-office-exit-door`;
  const title = useRef<HTMLHeadingElement>(null);
  const [elapsedMs] = useState(() => startedAtMs === undefined ? 0 : Math.max(0, Date.now() - startedAtMs));
  const animated = variant === "animated";
  useEffect(() => { if (animated) title.current?.focus(); }, [animated]);

  return (
    <section className="office-exit-ending" data-variant={variant} data-testid="office-exit-ending"
      style={{ "--office-exit-offset": `${-elapsedMs}ms` } as CSSProperties}
      role={animated ? "dialog" : undefined} aria-modal={animated ? true : undefined} aria-labelledby={titleId}
      onKeyDown={event => { if (animated && event.key === "Tab") { event.preventDefault(); title.current?.focus(); } }}>
      <header className="office-exit-heading">
        {animated ? <h2 id={titleId} ref={title} tabIndex={-1}>오늘도 수고했어요!</h2>
          : <h3 id={titleId} ref={title}>퇴근 완료!</h3>}
        <p>{animated ? "1층 출입문을 지나 퇴근합니다." : "회사 밖의 밤공기가 반겨줍니다."}</p>
      </header>
      <svg className="office-exit-scene" viewBox="0 0 520 400" preserveAspectRatio="xMidYMid meet"
        shapeRendering="crispEdges" role="img" aria-label="1층 회사 로비에서 문이 열리고 젊은 회사원이 네온 야경이 보이는 밖으로 걸어나가는 퇴근 장면">
        <defs><clipPath id={doorClipId}><rect x="334" y="100" width="140" height="220" /></clipPath></defs>
        <rect width="520" height="400" fill="#11192e" />
        <rect x="16" y="18" width="488" height="302" fill="#202b43" />
        <rect x="16" y="18" width="488" height="8" fill="#35465e" />
        <rect x="42" y="38" width="238" height="4" fill="#94aab6" />
        <rect x="42" y="42" width="238" height="5" fill="#3e5966" />
        <rect x="42" y="80" width="78" height="54" fill="#10182b" />
        <rect x="46" y="84" width="70" height="46" fill="#30445b" />
        <text x="81" y="117" textAnchor="middle" fill="#f3ca58" fontFamily="monospace" fontSize="30" fontWeight="bold">1F</text>
        <rect x="180" y="112" width="68" height="7" fill="#495b72" />
        <rect x="180" y="128" width="44" height="4" fill="#495b72" />
        <rect x="0" y="320" width="520" height="80" fill="#52616f" />
        <rect x="0" y="320" width="520" height="4" fill="#7b8994" />
        {[344,368,392].map(y => <rect key={y} x="0" y={y} width="520" height="2" fill="#465460" />)}
        {[50,130,210,290,370,450].map(x => <rect key={x} x={x} y="324" width="2" height="76" fill="#465460" />)}
        <g className="office-exit-arrival-stairs" aria-hidden="true">
          <path d="M18 268H54V284H96V300H138V320H18Z" fill="#64717d" />
          <path d="M18 268H54V272H18ZM54 284H96V288H54ZM96 300H138V304H96Z" fill="#f3ca58" />
          <rect x="18" y="276" width="30" height="2" fill="#8c98a3" />
          <rect x="60" y="292" width="28" height="2" fill="#8c98a3" />
        </g>
        <g aria-hidden="true">
          <rect x="254" y="240" width="50" height="80" fill="#172236" />
          <rect x="250" y="236" width="58" height="8" fill="#8b9ba5" />
          <rect x="264" y="252" width="30" height="12" fill="#34495d" />
          <rect x="272" y="256" width="14" height="3" fill="#61e8e1" />
        </g>
        <rect x="328" y="94" width="152" height="232" fill="#0a1223" />
        <g clipPath={`url(#${doorClipId})`}>
          <rect x="334" y="100" width="140" height="220" fill="#0c142b" />
          <rect x="334" y="270" width="140" height="50" fill="#233c52" />
          {[{x:340,y:194,w:24},{x:369,y:152,w:28},{x:402,y:180,w:30},{x:437,y:130,w:28}].map(building => (
            <g key={building.x}>
              <rect x={building.x} y={building.y} width={building.w} height={290-building.y} fill="#2c3e5d" />
              {[0,1,2,3].map(row => <rect key={row} x={building.x+5} y={building.y+10+row*18} width="4" height="6" fill={row%2 ? "#ef99c3" : "#75c9cd"} />)}
            </g>
          ))}
          <rect x="372" y="164" width="18" height="3" fill="#f07cbd" />
          <rect x="439" y="143" width="23" height="3" fill="#61e8e1" />
          <rect x="334" y="310" width="140" height="10" fill="#344d60" />
          <g className="office-exit-door office-exit-door--left" data-testid="office-exit-door-left">
            <rect x="334" y="100" width="70" height="220" fill="#526d80" />
            <rect x="340" y="106" width="58" height="204" fill="#264759" fillOpacity="0.86" />
            <rect x="348" y="122" width="4" height="154" fill="#81bcc3" fillOpacity="0.45" />
            <rect x="392" y="216" width="4" height="24" fill="#d9dee2" />
          </g>
          <g className="office-exit-door office-exit-door--right" data-testid="office-exit-door-right">
            <rect x="404" y="100" width="70" height="220" fill="#526d80" />
            <rect x="410" y="106" width="58" height="204" fill="#264759" fillOpacity="0.86" />
            <rect x="454" y="122" width="4" height="154" fill="#81bcc3" fillOpacity="0.45" />
            <rect x="412" y="216" width="4" height="24" fill="#d9dee2" />
          </g>
        </g>
        <g transform="translate(145 320)" data-testid="office-exit-runner">
          <g className="office-exit-runner-travel"><PixelOfficer variant="young" direction="right" pose={animated ? "climb" : "idle"} /></g>
        </g>
        <g aria-hidden="true">
          <path d="M326 92H482V100H334V320H326ZM474 100H482V320H474Z" fill="#8193a1" />
          <rect x="326" y="320" width="156" height="6" fill="#f3ca58" />
          <rect x="368" y="62" width="72" height="23" fill="#1d655c" />
          <text x="404" y="79" textAnchor="middle" fill="#d9fff3" fontFamily="monospace" fontSize="16" fontWeight="bold">EXIT →</text>
        </g>
      </svg>
      {animated && <p className="office-exit-messages" aria-hidden="true">
        <span className="office-exit-message--arrival">1층 도착</span>
        <span className="office-exit-message--walk">문이 열렸어요. 이제 퇴근!</span>
        <span className="office-exit-message--complete">퇴근 완료!</span>
      </p>}
    </section>
  );
}
