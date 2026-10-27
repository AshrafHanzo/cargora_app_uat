/**
 * Which Cargora this build talks to.
 *
 * UAT by default, on purpose. A manager's app showing real customs filings is not something
 * to point at production by accident, so production has to be asked for explicitly - either
 * by setting EXPO_PUBLIC_API_URL when starting Expo, or by editing ENVIRONMENTS below and
 * changing ACTIVE.
 *
 * Note these are two different SERVERS, not two paths on one:
 *    cargoradev.axioralabs.ai -> 103.14.121.15   (UAT, the `main` branch)
 *    cargora.axioralabs.ai    -> 163.128.112.16  (production, the `prod` branch)
 * so pointing at production also means its database, its jobs and its customers.
 */
export const ENVIRONMENTS = {
  uat: "https://cargoradev.axioralabs.ai/api/v1",
  production: "https://cargora.axioralabs.ai/api/v1",
} as const;

export type EnvironmentName = keyof typeof ENVIRONMENTS;

export const ACTIVE: EnvironmentName = "uat";

/**
 * EXPO_PUBLIC_API_URL wins when it is set, which is how you point the app at a backend
 * running on your own machine:
 *
 *    EXPO_PUBLIC_API_URL=http://192.168.1.5:30299/api/v1 npx expo start
 *
 * Use the machine's LAN address, never localhost - on a phone, localhost is the phone.
 */
export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, "") ?? ENVIRONMENTS[ACTIVE];

/** Shown on the Profile screen, so it is always possible to tell which Cargora the numbers
 *  on screen came from without reading the build. */
export const API_LABEL: string =
  process.env.EXPO_PUBLIC_API_URL ? "Custom" : ACTIVE === "uat" ? "UAT" : "Production";
