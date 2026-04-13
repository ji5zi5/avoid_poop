# Design System: Avoid Poop Mobile Arcade

## 1. Visual Theme & Atmosphere
A playful arcade interface with premium restraint: warm ivory surfaces floating over a deep cocoa background, rounded containers, bold Korean display typography, and soft motion cues that feel like a polished mobile game lobby instead of a debug panel. Density stays balanced and asymmetric; the interface should feel collectible, tactile, and easy to read at a glance.

## 2. Color Palette & Roles
- **Cream Canvas** (#F8EBDD) — primary surface background
- **Ivory Lift** (#FFF8F1) — elevated cards and forms
- **Cocoa Frame** (#4A341F) — shell background and primary shadows
- **Dark Bark** (#2B1E12) — primary text and structural borders
- **Muted Clay** (#8A6A49) — helper text and metadata
- **Action Coral** (#D07A63) — single accent for key actions, focus, and active chips
- **Moss Gold** (#D5A75B) — restrained secondary accent for rewards and join signals

## 3. Typography Rules
- **Display:** DungGeunMo with tight tracking and compact line-height for titles and hero numerals.
- **Body:** Noto Sans KR / Apple SD Gothic Neo for readable labels and descriptions.
- **Hierarchy:** Large title, quiet metadata, minimal uppercase English labels only for tiny chips.
- **Banned:** neon gradients, oversized all-caps headings, washed-out low contrast text.

## 4. Component Stylings
- **Primary Buttons:** pill-like rounded rectangle, cream-to-coral contrast, soft floating shadow, slight upward hover.
- **Secondary Buttons:** translucent ivory with dark text and thin border, never heavier than the primary CTA.
- **Cards:** large rounded corners, translucent light fill, subtle border and diffuse shadow.
- **Inputs:** label-above or contextual placeholder, bright field fill, rounded corners, visible border focus.
- **Status Chips:** compact rounded pills with muted backgrounds and crisp borders.
- **Chat / Lists:** stacked bubbles and roster cards, never plain raw rows.

## 5. Layout Principles
- Mobile-first centered stage with one dominant card per screen.
- Hero surfaces should use layered ambient gradients rather than noisy gimmicks.
- Menu should stay simple: title, one big entry CTA, then mode branching.
- Multiplayer surfaces should separate quick actions, room options, roster, and chat into clearly scoped zones.

## 6. Motion & Interaction
- Fast but soft hover/press transitions.
- No exaggerated shake or neon glows.
- Decorative gradients and floating shadow imply motion even when static.
- Control surfaces should feel chunky and thumb-friendly.

## 7. Anti-Patterns (Banned)
- Raw debug-panel layouts
- Equal-weight blocks everywhere
- Tiny unreadable metadata
- Overly dark muddy panels without surface contrast
- Generic 3-column feature rows
- Pure black, neon cyan, or AI-purple highlights
