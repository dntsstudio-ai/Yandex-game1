import "./style.css";
import { AppController } from "./ui/AppController";
import { initYandexSDK } from "./ads/YandexSDK";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) {
  throw new Error("Не найден контейнер #app в index.html");
}

void initYandexSDK();

const app = new AppController(root);
app.start();
