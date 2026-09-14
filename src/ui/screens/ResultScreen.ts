import type { AppController } from "../AppController";

export function renderResultScreen(container: HTMLElement, app: AppController, text: string): void {
  const state = app.getState();

  const wrap = document.createElement("div");
  wrap.className = "screen screen-result";

  const header = document.createElement("h1");
  header.textContent = "Результат";
  wrap.appendChild(header);

  const resultText = document.createElement("p");
  resultText.textContent = text;
  wrap.appendChild(resultText);

  const day = document.createElement("p");
  day.className = "muted";
  day.textContent = `Сейчас день ${state.day}.`;
  wrap.appendChild(day);

  const continueBtn = document.createElement("button");
  continueBtn.className = "btn btn-primary";
  continueBtn.textContent = "Вернуться в убежище";
  continueBtn.addEventListener("click", () => app.finishResult());
  wrap.appendChild(continueBtn);

  container.appendChild(wrap);
}
