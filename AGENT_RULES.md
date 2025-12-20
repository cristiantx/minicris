# Minicris - Isometric Mobile Game Rules

## Project Overview
This is a mobile-focused isometric 3D game built with Three.js, TypeScript, and Vite. The game features a controllable character with FBX animations and touch-based virtual joystick controls.

## Tech Stack
- **Build Tool**: Vite (vanilla-ts template)
- **Language**: TypeScript
- **3D Engine**: Three.js
- **Model Format**: FBX with skeleton animations

## Project Structure
```
src/
├── main.ts          # Entry point, initializes Game
├── Game.ts          # Core game loop, scene, renderer, lighting
├── CameraManager.ts # Isometric orthographic camera, follow logic
├── InputManager.ts  # Touch/Mouse virtual joystick
├── Character.ts     # FBX loading, animation mixer, movement
├── GameState.ts     # Game state constants (SPLASH, TRANSITIONING, GAMEPLAY)
├── GameConfig.ts    # Global game settings (Title, etc.)
├── MainMenuUI.ts    # HTML/CSS menu overlay
└── style.css        # Basic CSS reset and menu styles

public/
└── models/          # FBX model assets (character.fbx)
└── animations/      # FBX animation assets (walking.fbx, running.fbx, idle.fbx, bored.fbx)
```

## Key Conventions

### Rendering
- Use **Orthographic Camera** for isometric view (not Perspective)
- `viewSize` controls zoom level (lower = more zoomed in)
- Camera offset is `(10, 10, 10)` for standard isometric angle
- Use **ACES Filmic Tone Mapping** and **sRGB Color Space** for premium visuals
- Use **PCFSoftShadowMap** for premium and stable visuals
- Shadow maps should be 2048x2048
- Debugging: Toggle `SHOW_FPS` in `GameConfig.ts` to see performance metrics.

### Character System
- FBX models are loaded via `FBXLoader` from `three/examples/jsm/loaders/FBXLoader`
- Animations are loaded from separate FBX files and applied to the main model's `AnimationMixer`
- Character height is normalized to ~2 world units via auto-scaling
- Animation state machine: Idle → Walk (1-30% input) → Run (>30% input)
- Bored animation triggers after 15 seconds of idle
- Splash animations: `laiddown` (loop) for splash screen, `standup` (one-shot) for start game transition

### State Management
- Use `GameState` constants to manage game flow:
  - `SPLASH`: Front-facing closeup camera, `laiddown` animation, `MainMenuUI` visible.
  - `TRANSITIONING`: Playing `standup` animation, UI hidden.
  - `GAMEPLAY`: Isometric camera, full movement control enabled.

### UI System
- Main menu is implemented as a DOM overlay in `MainMenuUI.ts`
- Use `GameConfig` for centralized settings like `GAME_TITLE`
- Overlay elements should have `pointer-events: auto` while the container has `none` to allow clicking through to the game if needed.

### Input System
- Virtual joystick appears on touch/click and follows the touch position
- Input magnitude determines walk vs run threshold (0.3 is the cutoff)
- Input vector is normalized and mapped to camera-relative world direction
- Joystick UI is pure DOM elements overlaid on canvas

### Movement
- Movement direction is calculated relative to camera forward/right vectors
- Character rotates smoothly using quaternion slerp
- Speed is interpolated based on input magnitude for smooth acceleration

## Common Tasks

### Adding New Animations
1. Place FBX file in `public/models/`
2. Load in `Character.ts` using `FBXLoader.loadAsync()`
3. Extract animation clip and register with `mixer.clipAction()`
4. Use `fadeToAction()` for smooth transitions

### Adjusting Camera Zoom
- Modify `viewSize` in `CameraManager.ts` (default: 15)
- Lower values = more zoomed in

### Adding Environment Props
- Add to `addProps()` method in `Game.ts`
- Ensure props have `castShadow` and `receiveShadow` enabled

## Performance Notes
- Limit `devicePixelRatio` to 2 for mobile performance
- Keep shadow map sizes reasonable (2048 max)
- Use `powerPreference: 'high-performance'` in WebGLRenderer

## Development
```bash
npm run dev   # Start dev server
npm run build # Production build
```
