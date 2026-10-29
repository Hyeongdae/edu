import { useEffect, useId, useRef, useState, type CSSProperties, type ReactElement } from "react";
import { OvertimeOfficer } from "./pixel/OvertimeOfficer";
import { OVERTIME_CAPTURE_DURATION_MS } from "./useOvertimeCaptureEnding";
import "./overtime-capture-ending.css";

export interface OvertimeCaptureEndingProps {
  variant: "animated" | "complete";
  startedAtMs?: number;
}

const BUILDINGS = [
  { x: 36, y: 132, width: 36 }, { x: 78, y: 94, width: 38 },
  { x: 122, y: 118, width: 34 }, { x: 162, y: 76, width: 48 },
  { x: 216, y: 108, width: 32 }, { x: 254, y: 90, width: 52 },
];

export function OvertimeCaptureEnding({ variant, startedAtMs }: OvertimeCaptureEndingProps): ReactElement {
  const id = useId(), titleId = `${id}-overtime-title`, windowId = `${id}-overtime-window`;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const animated = variant === "animated";
  const [elapsedMs] = useState(() => startedAtMs === undefined ? 0
    : Math.min(OVERTIME_CAPTURE_DURATION_MS, Math.max(0, Date.now() - startedAtMs)));

  useEffect(() => { if (animated) headingRef.current?.focus(); }, [animated]);

  return (
    <section className="overtime-capture-ending" data-testid="overtime-capture-ending" data-variant={variant}
      role={animated ? "dialog" : undefined} aria-modal={animated ? true : undefined}
      aria-labelledby={animated ? titleId : undefined} aria-label={animated ? undefined : "야근 사무실"}
      style={{ "--overtime-capture-offset": `${-elapsedMs}ms` } as CSSProperties}
      onKeyDown={event => {
        if (animated && event.key === "Tab") { event.preventDefault(); headingRef.current?.focus(); }
      }}>
      {animated && <h2 id={titleId} ref={headingRef} tabIndex={-1}>야근 사무실</h2>}
      <svg className="overtime-capture-scene" viewBox="0 0 520 400" preserveAspectRatio="xMidYMid meet"
        shapeRendering="crispEdges" role="img"
        aria-label="네온 도시 야경이 보이는 야근 사무실. 나이 든 추격자가 젊은 회사원의 팔을 붙잡아 책상으로 끌고 가고, 주인공이 의자에 털썩 앉아 고개를 숙입니다.">
        <defs><clipPath id={windowId}><rect x="32" y="50" width="280" height="156" /></clipPath></defs>
        <rect width="520" height="400" fill="#10182c" />
        <rect x="12" y="14" width="496" height="292" fill="#202d45" />
        <path d="M12 14H508V22H12ZM12 290H508V306H12Z" fill="#34425a" />
        <rect x="24" y="24" width="294" height="4" fill="#43546b" />

        <g data-scene-part="city-window">
          <rect x="24" y="42" width="296" height="172" fill="#080f21" />
          <g clipPath={`url(#${windowId})`}>
            <rect x="32" y="50" width="280" height="156" fill="#101b38" />
            <rect x="32" y="166" width="280" height="40" fill="#20344e" />
            {BUILDINGS.map((building, index) => <g key={building.x}>
              <rect x={building.x} y={building.y} width={building.width} height={212 - building.y} fill={index % 2 ? "#2a3b58" : "#1b2d48"} />
              <rect x={building.x} y={building.y} width={building.width} height="3" fill="#3c506a" />
              {[0, 1, 2, 3].map(row => <g key={row} fill={(row + index) % 2 ? "#d47aa6" : "#65bec5"}>
                <rect x={building.x + 6} y={building.y + 10 + row * 19} width="4" height="6" />
                <rect x={building.x + 18} y={building.y + 10 + row * 19} width="4" height="6" />
              </g>)}
            </g>)}
            <path d="M168 94H204V98H168ZM264 110H302V114H264Z" fill="#f07cbd" />
            <path d="M82 116H110V120H82ZM222 128H242V132H222Z" fill="#61e8e1" />
            <path d="M44 60H48V162H44ZM50 60H52V162H50Z" fill="#81bcc3" fillOpacity="0.18" />
          </g>
          <path d="M24 42H320V50H24ZM24 206H320V214H24ZM168 50H176V206H168Z" fill="#52647a" />
          <path d="M24 214H320V220H24ZM172 50H174V206H172Z" fill="#71889a" />
        </g>

        <g data-scene-part="office-clock" aria-hidden="true">
          <rect x="433" y="49" width="50" height="50" fill="#0b1326" />
          <rect x="437" y="53" width="42" height="42" fill="#c1c9c9" />
          <path d="M457 57H460V62H457ZM457 86H460V91H457ZM441 72H446V75H441ZM471 72H476V75H471Z" fill="#34425a" />
          <path d="M456 64H459V75H456ZM449 66H452V69H455V72H452V69H449Z" fill="#202d45" />
          <rect x="456" y="72" width="4" height="4" fill="#c84e76" />
        </g>
        <g aria-hidden="true">
          <rect x="357" y="52" width="48" height="5" fill="#536780" />
          <rect x="357" y="65" width="31" height="3" fill="#43546b" />
          <rect x="353" y="112" width="131" height="71" fill="#152239" />
          <rect x="359" y="118" width="119" height="3" fill="#344a63" />
          <rect x="360" y="131" width="46" height="32" fill="#2c3d56" />
          <path d="M364 137H402V140H364ZM364 145H389V148H364Z" fill="#7c8b9c" />
          <rect x="420" y="131" width="48" height="32" fill="#30434e" />
          <path d="M425 137H463V140H425ZM425 145H454V148H425Z" fill="#91b6a5" />
        </g>

        <g data-scene-part="floor" aria-hidden="true">
          <rect x="0" y="306" width="520" height="94" fill="#47576b" />
          <rect x="0" y="306" width="520" height="4" fill="#738393" />
          {[334, 366, 398].map(y => <rect key={y} x="0" y={y} width="520" height="2" fill="#35465b" />)}
          {[24, 108, 192, 276, 360, 444].map(x => <rect key={x} x={x} y="310" width="2" height="90" fill="#35465b" />)}
        </g>
        <g aria-hidden="true">
          <rect x="28" y="267" width="101" height="7" fill="#536780" />
          <rect x="32" y="274" width="8" height="31" fill="#142238" />
          <rect x="116" y="274" width="8" height="31" fill="#142238" />
          <rect x="42" y="237" width="39" height="25" fill="#111a2d" />
          <rect x="45" y="240" width="33" height="18" fill="#2a3a52" />
          <rect x="58" y="262" width="8" height="5" fill="#6a7c8e" />
          <path d="M94 254H117V258H94ZM90 260H121V264H90Z" fill="#aebbc6" />
        </g>

        <g data-scene-part="chair" aria-hidden="true">
          <rect x="279" y="275" width="25" height="40" fill="#0b1428" />
          <rect x="283" y="279" width="17" height="30" fill="#506079" />
          <rect x="282" y="313" width="50" height="8" fill="#0c1529" />
          <rect x="286" y="313" width="43" height="4" fill="#66778c" />
          <rect x="304" y="321" width="6" height="19" fill="#1a2941" />
          <path d="M287 340H327V344H287ZM287 344H293V348H287ZM321 344H327V348H321Z" fill="#10182c" />
        </g>

        <g className="overtime-capture-pair overtime-capture-timed" data-testid="overtime-capture-actors">
          <g className="overtime-capture-bob overtime-capture-timed">
            <g transform="translate(136 326)" data-testid="overtime-capture-protagonist">
              <g className="overtime-capture-young--dragged overtime-capture-timed">
                <OvertimeOfficer variant="young" pose="dragged" />
              </g>
              <g className="overtime-capture-young--seated overtime-capture-timed">
                <OvertimeOfficer variant="young" pose="seated" />
              </g>
            </g>
            <g transform="translate(204 326)" data-testid="overtime-capture-pursuer">
              <g className="overtime-capture-older--grabbing overtime-capture-timed">
                <OvertimeOfficer variant="older" pose="grabbing" />
              </g>
              <g className="overtime-capture-older--standing overtime-capture-timed">
                <OvertimeOfficer variant="older" pose="standing" />
              </g>
            </g>
          </g>
        </g>

        <g data-scene-part="desk" aria-hidden="true">
          <rect x="348" y="306" width="155" height="12" fill="#102037" />
          <rect x="344" y="304" width="164" height="6" fill="#81939c" />
          <rect x="352" y="318" width="8" height="37" fill="#17263d" />
          <rect x="474" y="318" width="25" height="37" fill="#263950" />
          <path d="M477 322H495V325H477ZM477 334H495V337H477Z" fill="#52677c" />
          <rect x="481" y="327" width="8" height="2" fill="#8da0ad" />
          <rect x="481" y="339" width="8" height="2" fill="#8da0ad" />
        </g>
        <g data-scene-part="computer" aria-hidden="true">
          <rect x="437" y="245" width="58" height="43" fill="#10182c" />
          <rect x="441" y="249" width="50" height="34" fill="#245363" />
          <rect x="445" y="253" width="42" height="26" fill="#327787" />
          <path d="M448 257H479V259H448ZM448 263H470V265H448ZM448 269H481V271H448Z" fill="#91dfda" />
          <rect x="460" y="288" width="8" height="11" fill="#5c7386" />
          <rect x="448" y="299" width="32" height="5" fill="#7b919f" />
          <path d="M368 299H416V303H368ZM421 299H430V303H421Z" fill="#b0c2c8" />
        </g>
        <g data-scene-part="documents" aria-hidden="true">
          <path d="M403 286H431V290H403ZM400 291H434V295H400ZM403 296H435V300H403Z" fill="#d8e3de" />
          <path d="M407 287H426V289H407ZM404 292H430V294H404ZM408 297H430V299H408Z" fill="#7b969e" />
          <rect x="349" y="288" width="11" height="16" fill="#eea874" />
          <path d="M360 291H364V299H360Z" fill="#d48668" />
        </g>
      </svg>
    </section>
  );
}
