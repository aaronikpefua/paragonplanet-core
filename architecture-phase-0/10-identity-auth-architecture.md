# Identity and Auth Architecture

| Layer | Files/Owners | Responsibility |
|---|---|---|
| Web auth | `AuthContext.jsx`, auth pages | Firebase session state and route gating |
| Android auth UI | `AuthScreen.kt`, `AuthViewModel.kt` | login/signup/provider UI state |
| Android session | `SessionRepository.kt` | persisted local session/token state |
| Native X | `NativeXAuthCoordinator.kt`, `nativeXAuth.routes.js` | native X OAuth start/callback flow |
| PPIF | `android-native/.../ppif/*` | provider abstraction, profile mapping, runtime execution |
| Backend auth | `auth.middleware.js`, `auth.routes.js` | Firebase ID token verification and trusted/App Check gates |
| Firebase | Firebase client/admin config | identity assertion and token verification |

## Boundary

UI starts auth flows, platform/provider adapters handle provider details, Firebase asserts identity, and backend routes authorize using verified tokens. Future work should keep provider details behind PPIF/provider adapters.
