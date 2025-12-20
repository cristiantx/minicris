export const GameState = {
    SPLASH: 'SPLASH',
    TRANSITIONING: 'TRANSITIONING',
    GAMEPLAY: 'GAMEPLAY'
} as const;

export type GameStateType = keyof typeof GameState;
