import type { AppController } from "../AppController";
import type { EventDefinition } from "../../events/EventTypes";

export function renderEventScreen(
  container: HTMLElement,
  app: AppController,
  event: EventDefinition,
): void {
  const wrap = document.createElement("div");
  wrap.className = "screen screen-event";

  const title = document.createElement("h1");
  title.textContent = event.title;
  wrap.appendChild(title);

  const description = document.createElement("p");
  description.textContent = event.description;
  wrap.appendChild(description);

  const choicesWrap = document.createElement("div");
  choicesWrap.className = "event-choices";

  for (const choice of event.choices) {
    const btn = document.createElement("button");
    btn.className = "btn btn-choice";
    btn.textContent = choice.label;
    btn.addEventListener("click", () => app.resolveEventChoice(choice));
    choicesWrap.appendChild(btn);
  }
  wrap.appendChild(choicesWrap);

  container.appendChild(wrap);
}
