// Минимальная инициализация Yandex Games SDK (Phase 0, раздел 21/10 брифа).
// На этом этапе — только безопасная инициализация, БЕЗ показа рекламы.
// Rewarded-точки входа подключаются в Phase 10.

// Тип SDK не публикуется как npm-пакет — подключается через <script> на
// странице Яндекс Игр. Вне этой среды (локальная разработка) window.YaGames
// не существует, поэтому инициализация должна безопасно деградировать.
interface YandexSDK {
  features?: {
    LoadingAPI?: { ready: () => void };
  };
  adv?: {
    showRewardedVideo: (options: {
      callbacks: {
        onOpen?: () => void;
        onRewarded?: () => void;
        onClose?: () => void;
        onError?: (err: unknown) => void;
      };
    }) => void;
  };
}

declare global {
  interface Window {
    YaGames?: { init: () => Promise<YandexSDK> };
  }
}

let sdkInstance: YandexSDK | null = null;

export async function initYandexSDK(): Promise<void> {
  if (typeof window === "undefined" || !window.YaGames) {
    console.info("Yandex Games SDK недоступен (локальная разработка) — работаем в автономном режиме.");
    return;
  }

  try {
    sdkInstance = await window.YaGames.init();
    sdkInstance.features?.LoadingAPI?.ready();
  } catch (err) {
    console.warn("Не удалось инициализировать Yandex Games SDK:", err);
  }
}

export function isYandexSDKReady(): boolean {
  return sdkInstance !== null;
}
