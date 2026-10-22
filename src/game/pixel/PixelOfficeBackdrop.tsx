import type { ReactElement } from "react";

const BUILDINGS = [
  { x: 36, y: 126, width: 38, height: 150, color: "#21304e" },
  { x: 78, y: 92, width: 42, height: 184, color: "#192b47" },
  { x: 124, y: 154, width: 34, height: 122, color: "#243551" },
  { x: 164, y: 112, width: 50, height: 164, color: "#1e304d" },
  { x: 222, y: 72, width: 40, height: 204, color: "#273653" },
  { x: 270, y: 138, width: 42, height: 138, color: "#1d2c49" },
  { x: 320, y: 102, width: 46, height: 174, color: "#203753" },
  { x: 374, y: 150, width: 40, height: 126, color: "#29324d" },
  { x: 422, y: 84, width: 40, height: 192, color: "#20304d" },
  { x: 468, y: 134, width: 20, height: 142, color: "#243652" },
] as const;

function OfficeDesk(): ReactElement {
  return (
    <g className="office-prop office-desk" transform="translate(80 232)">
      <rect x="14" y="0" width="34" height="24" fill="#0b1328" />
      <rect x="17" y="3" width="28" height="17" fill="#294d60" />
      <rect x="20" y="6" width="15" height="2" fill="#517c87" />
      <rect x="20" y="10" width="21" height="2" fill="#3c6375" />
      <rect x="20" y="14" width="10" height="2" fill="#517c87" />
      <rect x="28" y="24" width="6" height="7" fill="#364760" />
      <rect x="23" y="29" width="16" height="3" fill="#465974" />
      <rect x="8" y="32" width="76" height="6" fill="#52627b" />
      <rect x="8" y="38" width="76" height="4" fill="#18253e" />
      <rect x="13" y="42" width="5" height="25" fill="#3b4a64" />
      <rect x="71" y="42" width="5" height="25" fill="#3b4a64" />
      <rect x="49" y="43" width="20" height="20" fill="#2c3a54" />
      <rect x="53" y="46" width="12" height="2" fill="#4b5e76" />
      <rect x="57" y="51" width="4" height="2" fill="#5c6d80" />
      <rect x="56" y="24" width="9" height="8" fill="#69798b" />
      <rect x="65" y="26" width="3" height="4" fill="#69798b" />
      <rect x="72" y="29" width="9" height="3" fill="#536881" />
      <rect x="74" y="26" width="9" height="3" fill="#77838f" />
    </g>
  );
}

function OfficeCopier(): ReactElement {
  return (
    <g className="office-prop office-copier" transform="translate(388 242)">
      <rect x="8" y="0" width="46" height="6" fill="#63758a" />
      <rect x="4" y="6" width="56" height="9" fill="#46566e" />
      <rect x="10" y="15" width="54" height="38" fill="#3b4b64" />
      <rect x="13" y="18" width="48" height="12" fill="#68788b" />
      <rect x="43" y="20" width="13" height="6" fill="#29445a" />
      <rect x="45" y="22" width="7" height="2" fill="#61bdbb" />
      <rect x="0" y="23" width="16" height="6" fill="#2a3851" />
      <rect x="1" y="20" width="11" height="3" fill="#9aa6ac" />
      <rect x="17" y="34" width="38" height="3" fill="#18273f" />
      <rect x="17" y="40" width="38" height="9" fill="#465770" />
      <rect x="31" y="42" width="10" height="2" fill="#84909a" />
      <rect x="14" y="53" width="7" height="5" fill="#182238" />
      <rect x="53" y="53" width="7" height="5" fill="#182238" />
    </g>
  );
}

export function PixelOfficeBackdrop(): ReactElement {
  return (
    <svg
      className="office-backdrop" viewBox="0 0 520 400" preserveAspectRatio="xMidYMid slice"
      shapeRendering="crispEdges" aria-hidden="true"
    >
      <rect width="520" height="400" fill="#171e3b" />
      <rect x="0" y="0" width="520" height="20" fill="#0b1026" />
      <rect x="18" y="20" width="484" height="6" fill="#303a55" />
      <rect x="48" y="14" width="108" height="3" fill="#8eb6c0" />
      <rect x="364" y="14" width="108" height="3" fill="#8eb6c0" />
      <rect x="28" y="28" width="464" height="252" fill="#090f22" />
      <rect x="34" y="34" width="452" height="240" fill="#0b1026" />

      <g className="office-city" opacity="0.85">
        <g fill="#60728a">
          <rect x="58" y="58" width="2" height="2" /><rect x="196" y="52" width="2" height="2" />
          <rect x="302" y="80" width="2" height="2" /><rect x="410" y="58" width="2" height="2" />
          <rect x="466" y="68" width="2" height="2" />
        </g>
        <rect x="38" y="196" width="448" height="78" fill="#14243c" />
        {BUILDINGS.map((building, buildingIndex) => (
          <g key={building.x}>
            <rect x={building.x} y={building.y} width={building.width} height={building.height} fill={building.color} />
            <rect x={building.x + 4} y={building.y - 4} width={building.width - 8} height="4" fill={building.color} />
            {Array.from({ length: Math.floor((building.height - 12) / 12) }, (_, row) => (
              <g key={row}>
                {Array.from({ length: Math.floor((building.width - 6) / 8) }, (_, column) => (
                  (row + column * 2 + buildingIndex) % 4 !== 0 && (
                    <rect
                      key={column} x={building.x + 5 + column * 8} y={building.y + 8 + row * 12}
                      width="3" height="5" fill={(row + column + buildingIndex) % 3 === 0 ? "#8e7a6c" : "#42677a"}
                    />
                  )
                ))}
              </g>
            ))}
          </g>
        ))}
        <g fill="#61e8e1">
          <rect x="84" y="101" width="30" height="3" />
          <rect x="84" y="106" width="3" height="14" />
          <rect x="108" y="106" width="6" height="3" />
          <rect x="108" y="114" width="6" height="3" />
          <rect x="328" y="117" width="28" height="3" />
          <rect x="352" y="120" width="4" height="13" />
          <rect x="328" y="130" width="24" height="3" />
          <rect x="242" y="80" width="2" height="34" />
        </g>
        <g fill="#f07cbd">
          <rect x="176" y="142" width="26" height="3" />
          <rect x="176" y="149" width="16" height="3" />
          <rect x="196" y="149" width="6" height="3" />
          <rect x="432" y="100" width="18" height="4" />
          <rect x="432" y="108" width="4" height="15" />
          <rect x="446" y="108" width="4" height="15" />
          <rect x="432" y="126" width="18" height="3" />
        </g>
        <rect x="38" y="254" width="448" height="4" fill="#345169" />
        <rect x="120" y="255" width="31" height="2" fill="#aa728e" />
        <rect x="277" y="255" width="40" height="2" fill="#527f8e" />
      </g>

      {/* Indoor frames and reflections are in front of the distant city. */}
      <g className="office-window-frame">
        {[32, 144, 256, 368, 480].map((x) => (
          <g key={x}>
            <rect x={x} y="32" width="8" height="244" fill="#0c172c" />
            <rect x={x} y="32" width="2" height="244" fill="#496078" />
          </g>
        ))}
        <rect x="32" y="156" width="456" height="8" fill="#101b30" />
        <rect x="32" y="156" width="456" height="2" fill="#3e536c" />
        <rect x="32" y="272" width="456" height="8" fill="#34435d" />
        <rect x="32" y="272" width="456" height="2" fill="#61758b" />
        <g fill="#b9edee" opacity="0.045">
          <rect x="48" y="40" width="8" height="228" />
          <rect x="58" y="40" width="3" height="228" />
          <rect x="273" y="40" width="8" height="228" />
          <rect x="283" y="40" width="3" height="228" />
        </g>
      </g>
      <g fill="#242b4a">
        <rect x="0" y="26" width="20" height="260" />
        <rect x="500" y="26" width="20" height="260" />
      </g>
      <rect x="0" y="280" width="520" height="120" fill="#202b43" />
      <rect x="0" y="280" width="520" height="4" fill="#465570" />
      <g fill="#303d56">
        {[304, 336, 374].map((y) => <rect key={y} x="0" y={y} width="520" height="2" />)}
        <rect x="52" y="284" width="2" height="116" /><rect x="164" y="284" width="2" height="116" />
        <rect x="354" y="284" width="2" height="116" /><rect x="466" y="284" width="2" height="116" />
      </g>
      <g className="office-rail" fill="#40516b">
        <rect x="22" y="220" width="5" height="78" /><rect x="63" y="220" width="5" height="78" />
        <rect x="22" y="220" width="76" height="5" /><rect x="22" y="254" width="63" height="3" />
        <rect x="463" y="220" width="5" height="78" /><rect x="493" y="220" width="5" height="78" />
        <rect x="457" y="220" width="41" height="5" /><rect x="468" y="254" width="30" height="3" />
      </g>
      <g className="office-floor-sign" transform="translate(67 110)">
        <rect width="48" height="25" fill="#0b1427" />
        <rect x="2" y="2" width="44" height="21" fill="#293950" />
        <rect x="2" y="2" width="2" height="21" fill="#61a7ad" />
        <text x="10" y="17" fontFamily="monospace" fontWeight="700" fontSize="13" fill="#b0c4ce">02F</text>
      </g>
      <OfficeDesk />
      <OfficeCopier />
      <g className="office-plant" transform="translate(52 281)">
        <rect x="5" y="-24" width="3" height="27" fill="#416b68" />
        <rect x="0" y="-18" width="6" height="8" fill="#3e6262" />
        <rect x="8" y="-23" width="5" height="9" fill="#4b7470" />
        <rect x="1" y="0" width="12" height="13" fill="#5d5e70" />
        <rect x="0" y="0" width="14" height="3" fill="#77758a" />
      </g>
    </svg>
  );
}
