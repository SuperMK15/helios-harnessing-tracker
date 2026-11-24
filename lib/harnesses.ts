export const systems = [
  "Power", "Power Distribution", "Propulsion", "Flight Controller",
  "Servos", "RC + TELEM + VTX", "External Sensors",
] as const;

export type System = (typeof systems)[number];

export type Harness = {
  id: string;
  system: System;
  name: string;
  endpoints: string;
  connector: string;
};

export type Tracking = {
  length: number | null;
  mechReady: boolean;
  soldered: boolean;
  installed: boolean;
  solderedBy: string;
  inspectedBy: string;
  revision: number;
};

export const blankTracking: Tracking = {
  length: null,
  mechReady: false,
  soldered: false,
  installed: false,
  solderedBy: "",
  inspectedBy: "",
  revision: 0,
};

function group(system: System, prefix: string, runs: [string, string, string][]): Harness[] {
  return runs.map(([name, endpoints, connector], index) => ({
    id: prefix + "-" + String(index + 1).padStart(2, "0"),
    system,
    name,
    endpoints,
    connector,
  }));
}

const lifts = [1, 2, 3, 4];
const tailServos = ["Left elevator", "Right elevator", "Left rudder", "Right rudder"];

const originalHarnesses = [
  ...group("Power", "PWR", [
    ["Main battery feed", "12S3P battery → PM08-CAN BMS", "XT90"],
    ["Power distribution feed", "PM08-CAN BMS → Mateksys PDB", "XT90 · 8 AWG"],
    ["5 V buck supply", "Mateksys PDB → Brakenator buck converter", "XT30"],
    ["5 V servo rail supply", "Brakenator buck converter → Pixhawk 6X servo rail", "XT30 / 3-pin header"],
  ]),
  ...group("Propulsion", "PRP", [
    ["Pusher ESC power", "Mateksys PDB → Pusher ESC", "XT60 · 10 AWG"],
    ["Pusher motor phases", "Pusher ESC → Pusher motor", "MT60 · 10 AWG"],
    ["Pusher ESC signal", "Pixhawk 6X → Pusher ESC", "DShot in functional diagram · CAN in detailed diagram"],
    ...lifts.flatMap((n): [string, string, string][] => [
      ["Lift " + n + " ESC power", "Mateksys PDB → Lift " + n + " ESC", "XT60"],
      ["Lift " + n + " motor phases", "Lift " + n + " ESC → Lift " + n + " motor", "MT60"],
      ["Lift " + n + " motor encoder signal", "Lift " + n + " motor ↔ Lift " + n + " ESC", n === 1 ? "MR / M6 · 5C 24 AWG as drawn" : "MR / M6 as drawn"],
      ["Lift " + n + " ESC signal", "Pixhawk 6X → Lift " + n + " ESC", "DShot in functional diagram · CAN in detailed diagram"],
    ]),
  ]),
  ...group("RC + TELEM + VTX", "AVN", [
    ["DJI air unit power", "Mateksys PDB 12 V → DJI O4 Pro", "XT30 to shared 6-pin JST"],
    ["DJI air unit data", "Pixhawk 6X UART 2 → DJI O4 Pro", "6-pin JST · MSP DisplayPort"],
    ["ELRS radio link", "Pixhawk 6X UART 1 → ELRS Link", "6-pin JST · Gemini MAVLink"],
    ["CAN 1 trunk", "Pixhawk 6X CAN 1 → CAN Splitter #1", "4-pin JST"],
    ["CAN 2 trunk", "Pixhawk 6X CAN 2 → CAN Splitter #2", "4-pin JST"],
    ["BMS data", "CAN Splitter #1 → PM08-CAN BMS", "4-pin JST"],
  ]),
  ...group("External Sensors", "SNS", [
    ["Left GPS fuselage run", "CAN Splitter #1 → Left wing disconnect", "4-pin JST"],
    ["Left GPS wing run", "Left wing disconnect → Left M9N DroneCAN GPS", "4-pin JST"],
    ["Right GPS wing run", "CAN Splitter #2 → Right M9N DroneCAN GPS", "4-pin JST"],
    ["Airspeed sensor", "CAN Splitter #2 → DLVR L10D airspeed sensor", "4-pin JST"],
    ["Magnetometer splitter run", "CAN Splitter #2 → Magnetometer inline disconnect", "4-pin JST"],
    ["Magnetometer tail run", "Magnetometer inline disconnect → RM3100 CAN magnetometer", "4-pin JST"],
    ["Downward rangefinder", "Pixhawk 6X I2C 1 → Benewake TF02", "4-pin JST"],
  ]),
  ...group("Servos", "SRV", [
    ["Wheel servo", "Pixhawk 6X → Wheel servo", "3-pin header"],
    ...["Left aileron", "Right aileron"].flatMap((name): [string, string, string][] => [
      [name + " fuselage run", "Pixhawk 6X → " + name.toLowerCase() + " wing disconnect", "3-pin header"],
      [name + " wing run", name + " wing disconnect → Servo", "3-pin header"],
    ]),
    ...tailServos.flatMap((name): [string, string, string][] => [
      [name + " fuselage run", "Pixhawk 6X → " + name.toLowerCase() + " wing disconnect", "3-pin header"],
      [name + " extension", name + " wing disconnect → Tail disconnect", "3-pin header"],
      [name + " tail run", name + " tail disconnect → Servo", "3-pin header"],
    ]),
  ]),
];

const regrouped: Partial<Record<string, System>> = {
  "PWR-02": "Power Distribution",
  "PWR-03": "Power Distribution",
  "PWR-04": "Power Distribution",
  "AVN-04": "Flight Controller",
  "AVN-05": "Flight Controller",
  "AVN-06": "Power",
};

export const harnesses = originalHarnesses.map((wire) => ({
  ...wire,
  system: regrouped[wire.id] ?? wire.system,
}));

export type WireDetails = Pick<Harness, "name" | "endpoints" | "connector">;

export type Wire = Harness & Tracking & {
  archived: boolean;
  custom: boolean;
};

export function wireLabel(id: string) {
  return id.startsWith("wire-") ? "W-" + id.slice(5, 11).toUpperCase() : id;
}
