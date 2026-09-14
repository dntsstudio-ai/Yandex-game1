export type ScreenName = "shelter" | "expedition" | "event" | "result" | "gameover";

export interface ScreenRenderer {
  (container: HTMLElement): void;
}
