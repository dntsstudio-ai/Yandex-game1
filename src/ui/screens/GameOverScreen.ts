import type { AppController } from "../AppController";

export function renderGameOverScreen(container: HTMLElement, app: AppController, day: number): void {
  const wrap = document.createElement("div");
  wrap.className = "screen screen-gameover";

  const dayLine = document.createElement("p");
  dayLine.className = "gameover-day";
  dayLine.textContent = `ДЕНЬ ${day}`;
  wrap.appendChild(dayLine);

  const title = document.createElement("h1");
  title.textContent = "ВЫ НЕ ВЫЖИЛИ";
  wrap.appendChild(title);

  const restartBtn = document.createElement("button");
  restartBtn.className = "btn btn-primary";
  restartBtn.textContent = "Начать заново";
  restartBtn.addEventListener("click", () => app.restartGame());
  wrap.appendChild(restartBtn);

  container.appendChild(wrap);
}
