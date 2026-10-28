export interface DescentEnvironment {
  DEV: boolean;
  VITE_LOCAL_DEMO_MODE?: string;
}

export function isDescentTestEnabled(environment: Readonly<DescentEnvironment>): boolean {
  return environment.DEV === true && environment.VITE_LOCAL_DEMO_MODE?.trim() === "true";
}
