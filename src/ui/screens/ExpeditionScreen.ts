import type { AppController } from "../AppController";
import { EXPEDITION_OPTIONS } from "../../expeditions/Expedition";

export function renderExpeditionScreen(
  container: HTMLElement,
  app: AppController,
  characterId: string,
): void {
  const state = app.getState();
  const character = state.characters.find((c) => c.id === characterId);

  const wrap = document.createElement("div");
  wrap.className = "screen screen-expedition";

  const header = document.createElement("h1");
  header.textContent = character ? `Экспедиция: ${character.name}` : "Экспедиция";
  wrap.appendChild(header);

  const optionsWrap = document.createElement("div");
  optionsWrap.className = "expedition-options";

  for (const option of EXPEDITION_OPTIONS) {
    const card = document.createElement("div");
    card.className = "expedition-option";

    const title = document.createElement("strong");
    title.textContent = `${option.label} — ${option.durationDays} дн.`;
    card.appendChild(title);

    const reward = document.createElement("div");
    reward.textContent = `Награда: ${option.rewardScrapRange[0]}–${option.rewardScrapRange[1]} металлолома`;
    card.appendChild(reward);

    const risk = document.createElement("div");
    risk.className = `risk risk-${option.riskLevel}`;
    risk.textContent = `Риск: ${riskLabel(option.riskLevel)}`;
    card.appendChild(risk);

    const chooseBtn = document.createElement("button");
    chooseBtn.className = "btn btn-primary";
    chooseBtn.textContent = "Отправить";
    chooseBtn.addEventListener("click", () => app.confirmExpedition(option.durationDays));
    card.appendChild(chooseBtn);

    optionsWrap.appendChild(card);
  }
  wrap.appendChild(optionsWrap);

  const backBtn = document.createElement("button");
  backBtn.className = "btn btn-secondary";
  backBtn.textContent = "Назад в убежище";
  backBtn.addEventListener("click", () => app.backToShelter());
  wrap.appendChild(backBtn);

  container.appendChild(wrap);
}

function riskLabel(level: string): string {
  switch (level) {
    case "low":
      return "минимальный";
    case "medium":
      return "средний";
    case "high":
      return "очень высокий";
    default:
      return level;
  }
}
