/* Dedicated Setflix Memory Lane collage interaction. */
(function () {
  const canvas = document.getElementById("memoryCanvas");
  const board = document.getElementById("memoryCanvasBoard");
  const contextBar = document.getElementById("memoryCanvasContext");
  const countLabel = document.getElementById("memoryCanvasCount");
  const selectedName = document.getElementById("memoryCanvasSelectionName");
  const closeButton = document.getElementById("memoryCanvasClose");
  const addButton = document.getElementById("memoryCanvasAdd");
  const previewButton = document.getElementById("memoryCanvasPreview");
  if (!canvas || !board || !closeButton || !addButton || !previewButton) return;

  let readOnly = false;
  let returnToEditor = false;
  let selectedId = null;
  let pointer = null;
  let lastPostedLayout = "";

  const defaultLayout = (index, total) => {
    if (total === 1) return { x: 27, y: 15, width: 46, height: 70, rotation: -1, z: 1, fit: "cover" };
    if (total === 2) return { x: index === 0 ? 5 : 55, y: 18, width: 40, height: 62, rotation: index === 0 ? -1.5 : 1.5, z: index + 1, fit: "cover" };
    if (total === 3) return { x: [4, 36, 68][index], y: [20, 9, 23][index], width: 28, height: 55, rotation: [-1.5, 1.2, -0.5][index], z: index + 1, fit: "cover" };
    if (total === 4) return { x: index % 2 === 0 ? 5 : 53, y: index < 2 ? 6 : 53, width: 42, height: 40, rotation: index % 2 === 0 ? -1 : 1, z: index + 1, fit: "cover" };
    const mobile = window.matchMedia("(max-width: 680px)").matches;
    const columns = mobile ? 3 : 4;
    const gap = 2.5;
    const width = mobile ? 30 : 22;
    const height = mobile ? 20 : 25;
    const column = index % columns;
    const row = Math.floor(index / columns);
    return {
      x: gap + column * (width + gap),
      y: 3 + row * (height + (mobile ? 4 : 2)),
      width,
      height,
      rotation: ((index % 3) - 1) * 1.2,
      z: index + 1,
      fit: "cover"
    };
  };

  const normalizeLayout = (value, index, total) => {
    const fallback = defaultLayout(index, total);
    if (!value || typeof value !== "object") return fallback;
    const x = Number(value.x), y = Number(value.y);
    const width = Number(value.width), height = Number(value.height);
    const rotation = Number(value.rotation), z = Number(value.z);
    if (![x, y, width, height, rotation, z].every(Number.isFinite)) return fallback;
    const safeWidth = Math.max(10, Math.min(width, 100));
    const safeHeight = Math.max(10, Math.min(height, 100));
    return {
      x: Math.max(0, Math.min(x, 100 - safeWidth)),
      y: Math.max(0, Math.min(y, 100 - safeHeight)),
      width: safeWidth,
      height: safeHeight,
      rotation: Math.max(-30, Math.min(30, rotation)),
      z: Math.max(0, Math.min(100, z)),
      fit: value.fit === "contain" ? "contain" : "cover"
    };
  };

  const postLayout = () => {
    if (!paperStishEditing) return;
    const snapshot = JSON.stringify(memoryLaneMedia.map(item => ({ id: item.id, layout: item.layout })));
    if (snapshot === lastPostedLayout) return;
    lastPostedLayout = snapshot;
    window.parent.postMessage({ type: "paper-stish:media-change", media: memoryLaneMedia }, "*");
  };

  const setTileLayout = (tile, layout) => {
    tile.style.left = layout.x + "%";
    tile.style.top = layout.y + "%";
    tile.style.width = layout.width + "%";
    tile.style.height = layout.height + "%";
    tile.style.zIndex = String(layout.z);
    tile.style.transform = "rotate(" + layout.rotation + "deg)";
    const media = tile.querySelector(".memory-canvas-media");
    if (media) media.style.objectFit = layout.fit;
  };

  const selectedItem = () => memoryLaneMedia.find(item => item.id === selectedId) || null;

  const updateSelection = () => {
    board.querySelectorAll(".memory-canvas-item").forEach(tile => {
      const active = tile.dataset.memoryId === selectedId;
      tile.classList.toggle("selected", active && !readOnly);
      let handle = tile.querySelector(".memory-canvas-resize");
      if (active && !readOnly && !handle) {
        handle = document.createElement("span");
        handle.className = "memory-canvas-resize";
        handle.setAttribute("aria-label", "Resize memory");
        tile.append(handle);
      } else if ((!active || readOnly) && handle) {
        handle.remove();
      }
    });
    const item = selectedItem();
    contextBar.hidden = readOnly || !item;
    selectedName.textContent = item ? (item.name || (item.type === "video" ? "Video" : "Photo")) : "";
    const fitButton = contextBar.querySelector('[data-canvas-action="fit"]');
    if (fitButton && item) fitButton.textContent = item.layout.fit === "contain" ? "Fill" : "Fit";
  };

  const render = () => {
    board.replaceChildren();
    countLabel.textContent = memoryLaneMedia.length + (memoryLaneMedia.length === 1 ? " memory" : " memories");
    if (!memoryLaneMedia.length) {
      const empty = document.createElement("div");
      empty.className = "memory-canvas-empty";
      const mark = document.createElement("div");
      mark.className = "memory-canvas-empty-mark";
      mark.textContent = "＋";
      const title = document.createElement("strong");
      title.textContent = readOnly ? "No memories yet" : "Start your Memory Lane";
      const copy = document.createElement("p");
      copy.textContent = readOnly
        ? "There are no photos or videos in this Memory Lane yet."
        : "Add photos and videos, then arrange each memory anywhere on your canvas.";
      empty.append(mark, title, copy);
      if (!readOnly) {
        const add = document.createElement("button");
        add.className = "memory-canvas-button primary";
        add.type = "button";
        add.textContent = "Add photos & videos";
        add.addEventListener("click", () => memoryMediaInput.click());
        empty.append(add);
      }
      board.append(empty);
      selectedId = null;
      updateSelection();
      return;
    }

    if (!memoryLaneMedia.some(item => item.id === selectedId)) selectedId = null;
    memoryLaneMedia.forEach((item, index) => {
      const tile = document.createElement("figure");
      tile.className = "memory-canvas-item" + (readOnly ? " viewer" : "");
      tile.dataset.memoryId = item.id;
      tile.setAttribute("aria-label", item.name || "Memory");
      if (!readOnly) {
        tile.tabIndex = 0;
        tile.setAttribute("role", "button");
      }

      const url = mediaUrl(item);
      let media;
      if (item.type === "video") {
        media = document.createElement("video");
        media.src = url;
        media.playsInline = true;
        media.preload = "metadata";
        media.muted = !readOnly;
        media.loop = !readOnly;
        media.controls = readOnly;
        media.className = "memory-canvas-media";
        const tag = document.createElement("span");
        tag.className = "memory-canvas-video-tag";
        tag.textContent = "VIDEO";
        tile.append(media, tag);
      } else {
        media = document.createElement("img");
        media.src = url;
        media.alt = item.name || "Memory Lane photo";
        media.draggable = false;
        media.className = "memory-canvas-media";
        media.addEventListener("error", () => { media.alt = "This photo could not be loaded"; });
        tile.append(media);
      }

      item.layout = normalizeLayout(item.layout, index, memoryLaneMedia.length);
      setTileLayout(tile, item.layout);
      board.append(tile);
    });
    updateSelection();
  };

  const openEditor = () => {
    if (!paperStishEditing) return;
    readOnly = false;
    returnToEditor = false;
    canvas.classList.remove("is-viewer");
    closeButton.textContent = "Done";
    closeButton.setAttribute("aria-label", "Done editing memories");
    document.getElementById("memoryCanvasSubtitle").textContent = "Arrange your photos and videos";
    addButton.hidden = false;
    previewButton.hidden = memoryLaneMedia.length === 0;
    canvas.hidden = false;
    mediaEditor.hidden = true;
    playerScreen.hidden = true;
    tp.hidden = true;
    render();
    postLayout();
  };

  const openViewer = fromPreview => {
    readOnly = true;
    returnToEditor = fromPreview === true;
    canvas.classList.add("is-viewer");
    closeButton.textContent = fromPreview ? "Back" : "×";
    closeButton.setAttribute("aria-label", fromPreview ? "Back to editing" : "Close memories");
    document.getElementById("memoryCanvasSubtitle").textContent = "A collection of favourite moments";
    addButton.hidden = true;
    previewButton.hidden = true;
    canvas.hidden = false;
    mediaEditor.hidden = true;
    playerScreen.hidden = true;
    tp.hidden = true;
    render();
  };

  const closeCanvas = () => {
    if (returnToEditor && paperStishEditing) {
      openEditor();
      return;
    }
    canvas.hidden = true;
    canvas.classList.remove("is-viewer");
    selectedId = null;
    pointer = null;
    returnToEditor = false;
    tp.hidden = false;
  };

  closeButton.addEventListener("click", closeCanvas);
  addButton.addEventListener("click", () => { if (paperStishEditing) memoryMediaInput.click(); });
  previewButton.addEventListener("click", () => {
    if (paperStishEditing && memoryLaneMedia.length) openViewer(true);
  });

  contextBar.addEventListener("click", event => {
    const button = event.target.closest("[data-canvas-action]");
    const item = selectedItem();
    if (!button || !item || !paperStishEditing) return;
    const action = button.dataset.canvasAction;
    if (action === "remove") {
      const next = memoryLaneMedia.filter(media => media.id !== item.id);
      selectedId = null;
      setMemoryLaneMedia(next);
      render();
      postLayout();
      return;
    }
    const layout = item.layout || defaultLayout(memoryLaneMedia.indexOf(item), memoryLaneMedia.length);
    if (action === "fit") layout.fit = layout.fit === "cover" ? "contain" : "cover";
    if (action === "rotate") layout.rotation = Math.max(-30, Math.min(30, layout.rotation + 5));
    if (action === "front") layout.z = Math.min(100, Math.max.apply(null, memoryLaneMedia.map(media => (media.layout || {}).z || 0)) + 1);
    if (action === "back") layout.z = Math.max(0, Math.min.apply(null, memoryLaneMedia.map(media => (media.layout || {}).z || 0)) - 1);
    item.layout = layout;
    render();
    postLayout();
  });

  board.addEventListener("pointerdown", event => {
    if (readOnly || !paperStishEditing) return;
    const tile = event.target.closest(".memory-canvas-item");
    if (!tile) {
      selectedId = null;
      updateSelection();
      return;
    }
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const item = memoryLaneMedia.find(media => media.id === tile.dataset.memoryId);
    if (!item) return;
    selectedId = item.id;
    updateSelection();
    event.preventDefault();
    const activeTile = board.querySelector('[data-memory-id="' + item.id + '"]');
    if (activeTile && activeTile.setPointerCapture) activeTile.setPointerCapture(event.pointerId);
    const rect = board.getBoundingClientRect();
    pointer = {
      id: item.id,
      pointerId: event.pointerId,
      tile: activeTile,
      startX: event.clientX,
      startY: event.clientY,
      boardWidth: rect.width,
      boardHeight: rect.height,
      startLayout: { ...(item.layout || defaultLayout(memoryLaneMedia.indexOf(item), memoryLaneMedia.length)) },
      resize: Boolean(event.target.closest(".memory-canvas-resize"))
    };
  });

  board.addEventListener("pointermove", event => {
    const drag = pointer;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const item = memoryLaneMedia.find(media => media.id === drag.id);
    if (!item) return;
    const dx = (event.clientX - drag.startX) / Math.max(1, drag.boardWidth) * 100;
    const dy = (event.clientY - drag.startY) / Math.max(1, drag.boardHeight) * 100;
    const start = drag.startLayout;
    if (drag.resize) {
      item.layout = {
        ...start,
        width: Math.max(10, Math.min(100 - start.x, start.width + dx)),
        height: Math.max(10, Math.min(100 - start.y, start.height + dy))
      };
    } else {
      item.layout = {
        ...start,
        x: Math.max(0, Math.min(100 - start.width, start.x + dx)),
        y: Math.max(0, Math.min(100 - start.height, start.y + dy))
      };
    }
    if (drag.tile) setTileLayout(drag.tile, item.layout);
  });

  const finishPointer = event => {
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    pointer = null;
    postLayout();
  };
  board.addEventListener("pointerup", finishPointer);
  board.addEventListener("pointercancel", finishPointer);

  document.addEventListener("click", event => {
    const playButton = event.target.closest(".pl");
    if (!playButton) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (paperStishEditing) openEditor();
    else openViewer(false);
  }, true);

  document.addEventListener("keydown", event => {
    if (!canvas.hidden && event.key === "Escape") {
      event.preventDefault();
      closeCanvas();
    }
  });

  window.addEventListener("message", event => {
    if (event.source !== window.parent || !event.data || typeof event.data !== "object") return;
    const type = event.data.type;
    if (type === "paper-stish:init" || type === "paper-stish:update-media") {
      const hadUnplaced = memoryLaneMedia.some(item => !item.layout);
      memoryLaneMedia.forEach((item, index) => {
        item.layout = normalizeLayout(item.layout, index, memoryLaneMedia.length);
      });
      if (!canvas.hidden) render();
      if (hadUnplaced && paperStishEditing) postLayout();
    }
    if (type === "paper-stish:set-editing" && event.data.editing === false && !readOnly && !canvas.hidden) {
      closeCanvas();
    }
  });
})();