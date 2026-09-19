# ESTARA — MASTER BUILD PROMPT
## Complete Cinematic Landing Experience — Scenes 01 → 06

Build the complete Estara cinematic landing-page experience as ONE integrated project.

Estara is a premium real-estate marketplace connecting property seekers with property agents. The cinematic landing experience introduces the brand through a continuous journey from the Earth, into a beautiful location, into the human/property scale, and finally into the Estara platform and role-selection entry point.

IMPORTANT:
- Build ALL scenes in this document in one pass.
- Do not stop after Scene 01, 02, or 03.
- Do not wait for additional prompts.
- Do not create separate prototypes.
- Do not rebuild working systems unnecessarily.
- Preserve the existing Scene 01 and Scene 02 implementation when technically sound.
- Extend the existing architecture rather than replacing it.
- The whole journey must feel like one continuous cinematic experience.
- Complete through Scene 06.
- Do NOT build the full customer dashboard or full agent dashboard yet.
- Do NOT build the complete property marketplace backend yet.
- The final state should be the polished cinematic landing page with the user/agent entry point ready for the next application-building stage.

---

# 1. PRODUCT IDEA

Estara is a platform between:

CUSTOMERS
and
PROPERTY AGENTS

Customers should eventually be able to:
- discover properties
- search by location
- filter by price/property type
- view property details
- save properties
- contact agents
- request property information

Agents should eventually be able to:
- register and verify themselves
- create listings
- upload property media
- manage listings
- receive inquiries
- manage leads
- edit/remove listings

Those application systems are future work.

This build focuses on the cinematic public landing experience.

---

# 2. BRAND

Brand:

ESTARA

Suggested brand positioning:

"Where places become possibilities."

Primary mission language:

"Estara connects you to places worth calling home."

The visual identity should feel:
- premium
- architectural
- modern
- trustworthy
- cinematic
- restrained
- sophisticated

Avoid:
- generic SaaS aesthetics
- excessive gradients
- random glassmorphism
- neon overload
- generic real-estate templates
- stock-looking AI imagery
- cartoon 3D
- excessive UI

---

# 3. TECHNOLOGY

Use the existing project stack.

Preferred:
- React
- TypeScript
- Three.js
- React Three Fiber
- GSAP
- ScrollTrigger
- WebGL

Keep one persistent WebGL canvas across the complete cinematic journey.

Prefer a scene architecture like:

```text
CinematicCanvas
      |
      +-- JourneyDriver
      |
      +-- Scene01
      +-- Scene02
      +-- Scene03
      +-- Scene04
      +-- Scene05
      +-- Scene06
```

The DOM overlays and WebGL world should remain separate systems.

---

# 4. GLOBAL STORY

The complete landing experience should read as:

```text
DARKNESS
   ↓
THE WORLD
   ↓
THE JOURNEY
   ↓
THE PLACE
   ↓
THE POSSIBILITY
   ↓
THE PLATFORM
   ↓
YOUR NEXT MOVE
```

The visitor begins outside Earth and ends with a clear choice:

CUSTOMER
or
AGENT

The experience must communicate what Estara does without dumping a paragraph on the visitor.

---

# 5. GLOBAL CAMERA RULE

Use one persistent camera.

Only one active scene director may control it at a time.

Scene transitions must inherit the previous scene's actual state.

No:
- camera teleportation
- camera reset
- Earth reset
- cloud reset
- lighting jump
- environment reload
- visible asset snap

The visitor should experience the journey as a single continuous cinematic shot.

---

# 6. SCROLL ARCHITECTURE

Each scene gets its own scroll track.

Example:

```text
Scene 01 track
      ↓
Scene 02 track
      ↓
Scene 03 track
      ↓
Scene 04 track
      ↓
Scene 05 track
      ↓
Scene 06 track
```

Use a single normalized journey progress system where possible.

Raw scroll must not directly drive camera transforms.

Use:
- ScrollTrigger
- damped progress
- interpolation
- smoothstep/smootherstep
- controlled easing

The experience must respond naturally to mouse wheel, trackpad and touch scroll.

---

# SCENE 01 — THE WORLD

## PURPOSE

Introduce the scale of the platform through Earth.

## VISUAL

Begin almost completely black.

A subtle atmospheric rim appears.

Then:
- Earth surface
- sunlight
- cloud layer
- stars
- atmospheric depth

The planet floats in deep space.

It rotates very slowly.

The visual language is premium cinematic film.

## TEXT

Use minimal messaging.

Possible sequence:

"Property begins with place."

Then:

"Every journey starts somewhere."

Do not overcrowd the opening.

## BRAND

Introduce:

ESTARA

subtly.

Do not show conventional navigation.

## SCROLL

As the visitor scrolls:
- Earth grows
- camera begins approaching
- sense of movement increases
- scene prepares the handoff to Scene 02

## EXIT STATE

End with Earth large in frame, still rotating, and camera ready to continue toward the selected destination.

Create:

```ts
getSceneHandoff()
```

with the existing Earth/camera state.

---

# SCENE 02 — THE JOURNEY

## PURPOSE

Turn the world into a destination.

Destination:

CAPE TOWN, SOUTH AFRICA

Coordinates:

```ts
latitude: -33.9249
longitude: 18.4241
```

## VISUAL

Continue directly from Scene 01.

Camera starts travelling toward Earth.

Progression:

```text
Earth
→ continent
→ Africa
→ Southern Africa
→ Cape Town region
```

Do not fake the geographic orientation.

Use mathematical latitude/longitude conversion.

## PHASES

### 0.00 → 0.20
Text:

"The world is full of places."

### 0.20 → 0.45
Text:

"Some feel like home."

### 0.45 → 0.72
Text:

"Find the place that feels right."

### 0.72 → 1.00

Reveal Cape Town region.

The atmosphere becomes more prominent.

## CAMERA

Smooth orbital-to-forward transition.

Avoid:
- sudden acceleration
- excessive banking
- shaking
- arcade movement

## EXIT

Create:

```ts
getScene02Handoff()
```

including:
- destination
- latitude
- longitude
- camera pose
- altitude
- Earth rotation
- cloud rotation
- destination direction
- scene progress

---

# SCENE 03 — ARRIVAL

## PURPOSE

Move from geographic scale to human scale.

The narrative is:

```text
WORLD
→ REGION
→ CITY
→ LANDSCAPE
→ NEIGHBORHOOD
→ PROPERTY
```

## PHASE 01 — DESCENT

Continue from Scene 02.

Text:

"Every place tells a story."

## PHASE 02 — LANDSCAPE

Reveal:
- coastline
- ocean
- mountains
- terrain
- urban area
- vegetation
- architecture

Text:

"From where you are..."

then:

"...to where you want to be."

Only one line visible at a time.

## PHASE 03 — HUMAN SCALE

Descend toward a neighborhood.

Introduce:
- roads
- houses
- trees
- architecture
- realistic shadows
- natural light

Do not make this look like Google Maps.

## PHASE 04 — PROPERTY

Reveal one premium residential property.

It should be:
- modern
- realistic
- elegant
- architecturally interesting
- naturally integrated

Text:

"A place of your own."

## PHASE 05 — MISSION

Settle into a beautiful property/environment composition.

Text:

"Estara connects you to places worth calling home."

Create:

```ts
getScene03Handoff()
```

including:
- destination
- property
- camera pose
- property transform
- scene progress
- active phase

---

# SCENE 04 — THE POSSIBILITY

## PURPOSE

Now that the visitor has seen a place and property, explain what Estara actually helps them do.

This scene transitions from cinematic environment into a more intentional brand-story composition.

The visitor should understand:

"Estara helps people discover and connect with property."

Do not suddenly turn the page into a normal website.

---

## TRANSITION

The camera remains near the property from Scene 03.

Slowly move from an immersive environmental view into a controlled architectural composition.

Possible camera behavior:

```text
property exterior
      ↓
slow lateral/orbit movement
      ↓
architectural framing
      ↓
minimal spatial UI
```

The property remains visible.

---

## STORY BLOCK 01

Text:

"Finding the right place shouldn't be complicated."

Fade in gently.

Hold.

Fade out.

---

## STORY BLOCK 02

Text:

"Discover properties that fit the life you're building."

Fade in.

Hold.

Fade out.

---

## STORY BLOCK 03

Text:

"Connect with the people who can make it happen."

Fade in.

Hold.

Fade out.

---

## VISUAL INFORMATION

Introduce three extremely minimal concept indicators.

Not cards.

Not large UI.

Use:

```text
DISCOVER
CONNECT
MOVE FORWARD
```

They may appear sequentially around the environment with restrained typography.

Avoid:
- floating dashboards
- huge icons
- cheesy animation
- holograms
- neon

---

# SCENE 05 — THE ESTARA PLATFORM

## PURPOSE

Reveal that the cinematic world is actually the entry point to a real platform.

This is the major transition from film-like storytelling into product experience.

The visitor should finally understand:

"There is a platform behind this."

---

## TRANSITION

The camera begins pulling away from the individual property.

The property environment gradually transitions into a refined Estara interface.

Use visual continuity.

For example:

```text
PROPERTY
   ↓
NEIGHBORHOOD
   ↓
CITY
   ↓
MAP / DISCOVERY
   ↓
ESTARA PLATFORM
```

Do not hard-cut between the 3D world and the website UI.

Use a controlled crossfade, camera pull-back, scale transition, or spatial interface reveal.

The transition should feel intentional.

---

## PLATFORM REVEAL

Introduce a premium Estara property-discovery interface.

Show a small number of realistic example properties.

The UI should communicate:

- location
- property type
- price
- image
- availability/status
- agent
- basic property metadata

Do not build the complete marketplace.

This is a cinematic preview of the product.

---

## SEARCH EXPERIENCE

Introduce a refined search field.

Example concept:

```text
Where do you want to live?
```

Possible controls:

```text
Location
Property Type
Price
```

But keep the interface minimal.

Do not make the scene feel like a normal property listing site yet.

---

## PLATFORM MESSAGE

Text:

"One place to discover what comes next."

Then:

"Properties. People. Possibilities."

---

# SCENE 06 — YOUR NEXT MOVE

## PURPOSE

End the cinematic landing experience with a clear conversion point.

The user now understands:

- what Estara is
- why it exists
- what it does
- how it helps
- what the platform looks like

Now give them a choice.

---

## TRANSITION

The platform preview should simplify.

Gradually remove secondary elements.

Bring ESTARA into stronger focus.

Background remains elegant and calm.

---

## MAIN MESSAGE

Display:

"Where will your next chapter take you?"

Then:

"Start with Estara."

---

## ROLE SELECTION

Present two primary paths:

```text
I'M LOOKING FOR A PROPERTY
```

and

```text
I'M LISTING A PROPERTY
```

These correspond to:

CUSTOMER
and
AGENT

Use two large but refined interactive choices.

They must feel like the natural conclusion of the journey.

---

## CUSTOMER ENTRY

Customer CTA:

"Explore Properties"

Secondary text:

"Discover homes, apartments, land and spaces worth considering."

Button:

"Continue as a Customer"

---

## AGENT ENTRY

Agent CTA:

"List a Property"

Secondary text:

"Put your properties in front of people looking for their next place."

Button:

"Continue as an Agent"

---

## OPTIONAL SECONDARY ENTRY

Below the role choices:

"Already have an account? Sign in"

Do not build the complete authentication flow yet.

The button only needs to be structurally ready for the future auth route.

---

# 7. GLOBAL TYPOGRAPHY

Typography must remain consistent throughout.

Use:
- premium modern sans-serif
- restrained tracking
- strong whitespace
- readable contrast
- light/medium weights

Avoid:
- futuristic gamer fonts
- decorative luxury fonts
- excessive bold text
- typewriter animations

Preferred animation:

```text
opacity + subtle translateY
```

Keep one major message visible at a time whenever possible.

---

# 8. GLOBAL VISUAL LANGUAGE

Colors should be restrained.

Foundation:

- deep blacks
- off-whites
- natural Earth tones
- muted architectural neutrals

Avoid:
- excessive purple/blue gradients
- neon cyan
- artificial glow everywhere
- candy-like colors

The site should feel expensive without trying to look expensive.

---

# 9. GLOBAL PERFORMANCE

Optimize the full experience.

Use:
- adaptive DPR
- device quality profiles
- progressive asset loading
- reasonable texture sizes
- minimized per-frame allocations
- frustum culling
- controlled post-processing
- minimal React state updates in render loops

The browser must not freeze during the cinematic journey.

The transition from 3D scene to interface must also remain responsive.

---

# 10. MOBILE

Do not simply scale desktop down.

Recompose scenes for mobile.

Scene 01:
Earth remains dominant.

Scene 02:
preserve Earth → destination approach.

Scene 03:
prioritize landscape → neighborhood → property.

Scene 04:
prioritize typography and property.

Scene 05:
use a simplified but recognizable platform preview.

Scene 06:
make Customer/Agent choices easy to tap.

Reduce:
- terrain complexity
- texture resolution
- shadows
- post-processing
- particle count

when necessary.

---

# 11. REDUCED MOTION

Respect the system reduced-motion preference.

When enabled:
- reduce camera travel
- reduce Earth rotation
- reduce cloud movement
- reduce large visual transitions
- preserve content and hierarchy

The user must still understand the story.

---

# 12. ACCESSIBILITY

Use:
- semantic text
- accessible buttons
- keyboard focus
- readable contrast
- aria labels where useful

Do not make important information dependent entirely on animation.

---

# 13. STATE ARCHITECTURE

Extend the current scene state system.

Recommended scene phases:

```ts
type ScenePhase =
  | "loading"
  | "scene01"
  | "scene02"
  | "scene03"
  | "scene04"
  | "scene05"
  | "scene06";
```

Recommended active camera authority:

```ts
type CameraAuthority =
  | "scene01"
  | "scene02"
  | "scene03"
  | "scene04"
  | "scene05"
  | "scene06";
```

Create dedicated handoff contracts between every scene.

---

# 14. HANDOFFS

Required:

```ts
getSceneHandoff()
getScene02Handoff()
getScene03Handoff()
getScene04Handoff()
getScene05Handoff()
```

At minimum, each handoff should preserve whatever the next scene needs instead of reconstructing state from scratch.

The transition must remain deterministic.

---

# 15. FUTURE APPLICATION BOUNDARY

DO NOT build the full application in this task.

Do not implement:
- complete authentication
- customer dashboard
- agent dashboard
- admin dashboard
- property CRUD backend
- payments
- messaging backend
- KYC/agent verification backend
- database schema
- notifications
- commissions

However, the final Scene 06 CTAs must be designed so future routes can attach naturally:

```text
/customer/register
/agent/register
/login
```

Use placeholder navigation only where necessary.

---

# 16. NO-GARBAGE RULE

Do not introduce:
- placeholder lorem ipsum
- fake unrelated features
- random stock cards
- unrelated icons
- excessive animations
- duplicate scene systems
- redundant state stores
- unnecessary dependencies
- debugging UI in production
- visible error messages
- obvious temporary assets

Do not claim a feature works unless it actually works.

---

# 17. COMPLETION CHECK

Before finishing, verify the full sequence manually.

## Scene 01
Earth emerges from darkness and rotates naturally.

## Scene 02
Camera leaves Earth orbit and approaches Cape Town.

## Scene 03
Camera descends from Cape Town into a neighborhood and reveals a property.

## Scene 04
The story explains Estara's purpose while maintaining cinematic continuity.

## Scene 05
The real-estate platform preview emerges naturally from the cinematic environment.

## Scene 06
The experience ends with clear Customer and Agent entry choices.

Verify:
- no camera resets
- no scene jumps
- no scroll dead zones
- no broken overlays
- no text collisions
- no major performance spikes
- mobile works
- reduced motion works
- scene handoffs work
- the entire sequence can be scrolled from top to bottom without manual intervention

---

# 18. FINAL EXPERIENCE

The finished landing page should feel like:

```text
BLACK
 ↓
EARTH
 ↓
WORLD
 ↓
JOURNEY
 ↓
CAPE TOWN
 ↓
LANDSCAPE
 ↓
NEIGHBORHOOD
 ↓
PROPERTY
 ↓
WHY ESTARA
 ↓
PLATFORM
 ↓
CUSTOMER / AGENT
```

The visitor should finish the sequence understanding Estara without needing to read a long explanation.

---

# 19. FINAL BUILD INSTRUCTION

Build Scenes 01 through 06 as one cohesive system.

Inspect the existing implementation before changing it.

Preserve working systems.

Extend them cleanly.

Do not rebuild working Earth, camera, scroll, atmosphere, cloud, or destination systems unless necessary.

Do not stop halfway through the sequence.

Do not proceed into the full application beyond Scene 06.

Finish the complete cinematic landing experience, run the production build/type checks, and verify the complete scroll journey.

The final product should feel polished enough to serve as the foundation of the Estara brand.
