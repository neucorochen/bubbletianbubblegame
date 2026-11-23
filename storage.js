const SAVE_KEY = "bubble_shooter_save_v1";

const GameStorage = {
  save(data) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) {
      // Игнорируем ошибку, если хранилище недоступно
    }
  },

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
};
