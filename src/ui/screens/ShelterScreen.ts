import type { AppController } from "../AppController";
import { RESOURCE_KEYS } from "../../player/Resources";

const RESOURCE_LABELS: Record<string, string> = {
  food: "Еда",
  water: "Вода",
  energy: "Энергия",
  scrap: "Металлолом",
};

export function renderShelterScreen(container: HTMLElement, app: AppController): void {
  const state = app.getState();

  const wrap = document.createElement("div");
  wrap.className = "screen screen-shelter";

  const header = document.createElement("h1");
  header.textContent = `День ${state.day}`;
  wrap.appendChild(header);

  const health = document.createElement("p");
  health.className = "shelter-health";
  health.textContent = `Здоровье убежища: ${state.shelterHealth}`;
  wrap.appendChild(health);

  const resourceRow = document.createElement("div");
  resourceRow.className = "resource-row";
  for (const key of RESOURCE_KEYS) {
    const chip = document.createElement("div");
    chip.className = "resource-chip";
    chip.textContent = `${RESOURCE_LABELS[key]}: ${state.resources[key]}`;
    resourceRow.appendChild(chip);
  }
  wrap.appendChild(resourceRow);

  const buildingsHeader = document.createElement("h2");
  buildingsHeader.textContent = "Постройки";
  wrap.appendChild(buildingsHeader);

  const buildingsList = document.createElement("ul");
  buildingsList.className = "building-list";
  for (const b of state.buildings) {
    const li = document.createElement("li");
    li.textContent = `${b.name} (уровень ${b.level})`;
    buildingsList.appendChild(li);
  }
  wrap.appendChild(buildingsList);

  const charactersHeader = document.createElement("h2");
  charactersHeader.textContent = "Персонажи";
  wrap.appendChild(charactersHeader);

  const charactersList = document.createElement("div");
  charactersList.className = "character-list";
  for (const c of state.characters) {
    const card = document.createElement("div");
    card.className = "character-card";

    const name = document.createElement("strong");
    name.textContent = `${c.name} — ${c.profession}`;
    card.appendChild(name);

    const status = document.createElement("div");
    status.className = "character-status";
    status.textContent = statusLabel(c.status);
    card.appendChild(status);

    const sendBtn = document.createElement("button");
    sendBtn.className = "btn btn-primary";
    sendBtn.textContent = "Отправить в экспедицию";
    sendBtn.disabled = c.status !== "idle";
    sendBtn.addEventListener("click", () => app.goToExpeditionSetup(c.id));
    card.appendChild(sendBtn);

    charactersList.appendChild(card);
  }
  wrap.appendChild(charactersList);

  container.appendChild(wrap);
}

function statusLabel(status: string): string {
  switch (status) {
    case "idle":
      return "В убежище";
    case "expedition":
      return "В экспедиции";
    case "injured":
      return "Ранен";
    case "dead":
      return "Погиб";
    default:
      return status;
  }
}
