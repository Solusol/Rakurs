"use strict";

/*
  Звуки кнопок «Ракурса».

  Те же короткие звуки действий, что на сайте «Лимба».
  Фонового звука нет, настроек нет: щелчки включены всегда.

  Браузеры не дают запускать звук без действия человека,
  поэтому файлы подгружаются после первого касания или клавиши.
*/

(() => {
  const BASE = "assets/sounds/";

  const CONFIG = {
    /* Громкость всех звуков: 0–1 */
    volume: 0.8,

    effects: {
      click: ["ui-click.mp3"],
      clickSoft: ["ui-click-2.mp3"],
      tick: ["tick.mp3"],
      switch: ["switch.mp3"],
      undo: ["undo.mp3"],
      redo: ["redo.mp3"],
      paperOpen: ["paper-open.mp3"],
      paperClose: ["paper-close.mp3"],
      paperFlip: ["paper-flip-1.mp3", "paper-flip-2.mp3"]
    },

    /*
      Что звучит при клике. Проверяется сверху вниз,
      срабатывает первое совпадение. null — без звука.
    */
    clickMap: [
      /* Дублирование блока — до правил переходов, кнопка лежит внутри карточки */
      [".ws-dup-btn, .ws-del-btn", "clickSoft"],

      /* Отмена и повтор в редакторе */
      ["[title^='Отменить']", "undo"],
      ["[title^='Повторить']", "redo"],

      /* Переключатели: чтение/правка, тема, порядок, галочки */
      [".seg-btn, [title*='тему'], input[type='checkbox'], input[type='radio']", "switch"],

      /* Переходы по страницам: оглавление, карточки, хлебные крошки */
      [
        "#toc a, #crumb a, .ws-crumbs a, .ws-card, a.card, a.ch-item, a.ch-title, " +
        "a.link, a.r, a.ap, .ws-toc-home",
        "paperFlip"
      ],

      /* Окна открываются и закрываются со своим звуком — у этих кнопок щелчка нет */
      [".rk-start-btn, [data-close]", null],

      /* Мелкие кнопки панелей и инструментов */
      [".icon-btn, .br2-icon, .ws-drag-handle, .fmt button, .fmtbar button, .popmenu button", "clickSoft"],

      /* Плитки выбора палитры и типа блока */
      [".look .tile, .ws-kind-select label, .ws-add-card, .toc-new", "click"],

      /* Всё остальное, что похоже на кнопку */
      ["button, summary, a[href^='#'], .link-btn, [role='button']", "click"]
    ]
  };

  const state = {
    context: null,
    master: null,
    buffers: new Map(),
    pending: new Map(),
    lastPlayed: new Map(),
    unlocked: false
  };

  /* ---------- Web Audio ---------- */

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  function context() {
    if (!AudioContextClass) return null;

    if (!state.context) {
      state.context = new AudioContextClass();
      state.master = state.context.createGain();
      state.master.gain.value = 1;
      state.master.connect(state.context.destination);
    }

    if (state.context.state === "suspended") {
      state.context.resume().catch(() => {});
    }

    return state.context;
  }

  function loadBuffer(url) {
    if (state.buffers.has(url)) {
      return Promise.resolve(state.buffers.get(url));
    }

    if (state.pending.has(url)) return state.pending.get(url);

    const ctx = context();
    if (!ctx) return Promise.resolve(null);

    const task = fetch(url)
      .then(response => {
        if (!response.ok) throw new Error(`Не найден файл: ${url}`);
        return response.arrayBuffer();
      })
      .then(data => new Promise((resolve, reject) => {
        /* Старый Safari принимает только колбэки */
        const result = ctx.decodeAudioData(data, resolve, reject);
        if (result && result.then) result.then(resolve, reject);
      }))
      .then(buffer => {
        state.buffers.set(url, buffer);
        state.pending.delete(url);
        return buffer;
      })
      .catch(error => {
        state.pending.delete(url);
        console.warn("[Ракурс: звуки]", error.message);
        return null;
      });

    state.pending.set(url, task);
    return task;
  }

  function preloadEffects() {
    Object.values(CONFIG.effects).forEach(list => {
      list.forEach(file => loadBuffer(BASE + file));
    });
  }

  /* ---------- Звуки действий ---------- */

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function playEffect(name) {
    const list = CONFIG.effects[name];
    if (!list || !list.length) return;

    /* Защита от дребезга: один и тот же звук не чаще 70 мс */
    const now = performance.now();
    if (now - (state.lastPlayed.get(name) || 0) < 70) return;
    state.lastPlayed.set(name, now);

    const ctx = context();
    if (!ctx) return;

    loadBuffer(BASE + pick(list)).then(buffer => {
      if (!buffer) return;

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const gain = ctx.createGain();
      gain.gain.value = CONFIG.volume;

      source.connect(gain);
      gain.connect(state.master);
      source.start();
    });
  }

  /* ---------- Привязка к действиям ---------- */

  function soundForTarget(target) {
    for (const [selector, name] of CONFIG.clickMap) {
      let element = null;

      try {
        element = target.closest(selector);
      } catch {
        continue;
      }

      if (!element) continue;
      if (element.disabled) return null;
      if (element.getAttribute("aria-disabled") === "true") return null;

      return name;
    }

    return null;
  }

  document.addEventListener("click", event => {
    if (!(event.target instanceof Element)) return;

    /* Клики по тексту в редакторе не щёлкают */
    if (event.target.closest("[contenteditable='true']")) return;

    const name = soundForTarget(event.target);
    if (name) playEffect(name);
  }, true);

  /* Выбор в выпадающих списках */
  document.addEventListener("change", event => {
    if (!(event.target instanceof Element)) return;
    if (event.target.matches("select")) playEffect("tick");
  }, true);

  /* Окна: открытие и закрытие любого .modal */
  const modalObserver = new MutationObserver(records => {
    for (const record of records) {
      const node = record.target;
      if (!(node instanceof Element) || !node.classList.contains("modal")) continue;

      const wasHidden = record.oldValue !== null;
      if (node.hidden === wasHidden) continue;

      playEffect(node.hidden ? "paperClose" : "paperOpen");
    }
  });

  modalObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["hidden"],
    attributeOldValue: true,
    subtree: true
  });

  /* Окна, которые создаются при открытии и удаляются при закрытии */
  const isOpenModal = node =>
    node instanceof Element && node.classList.contains("modal") && !node.hidden;

  const bodyObserver = new MutationObserver(records => {
    for (const record of records) {
      record.addedNodes.forEach(node => { if (isOpenModal(node)) playEffect("paperOpen"); });
      record.removedNodes.forEach(node => { if (isOpenModal(node)) playEffect("paperClose"); });
    }
  });

  bodyObserver.observe(document.documentElement, { childList: true, subtree: true });

  /* Первое действие посетителя разблокирует звук и подгружает файлы */
  function unlock() {
    state.unlocked = true;
    context();
    preloadEffects();

    document.removeEventListener("pointerdown", unlock, true);
    document.removeEventListener("keydown", unlock, true);
  }

  document.addEventListener("pointerdown", unlock, true);
  document.addEventListener("keydown", unlock, true);
})();
