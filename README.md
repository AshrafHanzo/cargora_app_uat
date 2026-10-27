# Cargora Manager

The native manager app for Cargora. React Native + Expo, runs in Expo Go.

A read-only view of a company's customs operation: how many jobs completed, split by
shipment type, who did them, and the trend over time. It cannot change anything — see
[Read-only, on purpose](#read-only-on-purpose).

Points at **UAT** (`cargoradev.axioralabs.ai`) by default.

## Running it

```bash
npm install
npx expo start
```

Then open **Expo Go** on your phone and scan the QR code. The phone and this computer must
be on the same Wi-Fi. If they can't see each other (guest Wi-Fi, or a corporate network that
blocks it), use `npx expo start --tunnel`.

## Signing in

The app only accepts **manager app logins** — the `app_manager` role. An operator, GK2 or
Tenant Admin password will be refused with a message pointing them at the website, because
those accounts have no business on this app.

A Super Admin creates one in the Cargora portal:

- role **app_manager**
- the company it belongs to
- **at least one shipment type** — this is the login's hard limit, and it is what stops a
  Sea Import login from ever seeing Air Import

One company can hold several. That is the intended shape: one login for Sea Import, another
for Air Import, each going to whoever watches that desk.

## Picking what the phone shows

After the first sign-in the app asks which shipment types to watch. Multi-select — Air
Import and Sea Import together is fine. It is changeable any time from **Profile**.

That choice only ever **narrows** what the login is already allowed. The server intersects
it again on every request, so the phone's preference is a convenience, never the thing
keeping one company's data from another.

Ticking everything is stored as "whatever I'm allowed" rather than as today's list, so a
login later granted a fifth shipment type sees it straight away instead of staying pinned to
the four that existed when the choice was made.

## Pointing it somewhere else

`EXPO_PUBLIC_API_URL` wins over everything, which is how you run against a backend on your
own machine:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.5:30299/api/v1 npx expo start
```

Use the machine's LAN address — on a phone, `localhost` is the phone.

The environment the app is talking to is always shown on the sign-in screen and under
Profile. UAT and production are **two different servers with two different databases**, so
it should never be a guess which one a number came from.

To change the default, edit `ACTIVE` in `src/api/config.ts`.

## How it is put together

```
app/                      screens (expo-router: the file tree IS the navigation)
  _layout.tsx             the only place that decides which screen a launch lands on
  login.tsx
  modes.tsx               the "what do you watch?" picker
  (tabs)/                 Dashboard · Usage · Reports · Profile
src/
  api/        config.ts   which backend
              client.ts   Bearer tokens, one-at-a-time refresh, error messages
              manager.ts  the endpoints, typed
  auth/                   who is signed in, allowed modes vs chosen modes
  components/             shared UI + the trend chart
  hooks/useAsync.ts       loading/error/abort, shared by every screen
  theme/                  every colour, size and shadow (light and dark)
```

Two things worth knowing before changing anything:

**Tokens, not cookies.** The web portal keeps its session in an httpOnly cookie. React
Native has no cookie jar that survives the app closing, so this app holds the tokens itself
and sends `Authorization: Bearer`. They live in `expo-secure-store` (Keychain / encrypted
SharedPreferences), never `AsyncStorage`, which is plain text on disk.

**Only one refresh at a time.** The dashboard fires several requests at once. Without the
lock in `client.ts`, each 401 would start its own refresh, every one rotating the token and
invalidating the others — and the server treats a reused refresh token as theft and kills
the session. The symptom is being logged out on launch.

**Dates are local, never UTC.** A job finished at 02:00 IST is 20:30 UTC *the day before*.
Every call sends the device's own offset, and `localDateKey()` is used instead of
`toISOString()` anywhere a date is shown or sent.

## Read-only, on purpose

Every endpoint the app talks to is a GET. Not "none yet" — none. A manager watches;
anything they want done is something to ask a GK1 or GK2 to do in the portal. The backend
has a test that fails if a writing method is ever added to that router, so doing it would
have to be a deliberate, visible decision.
