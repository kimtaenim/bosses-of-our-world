// 터치·마우스 입력: 드래그 스왑과 탭-탭 스왑 둘 다 지원 (Pointer Events)

export function attachInput(canvas, game) {
  let drag = null; // { cell, x, y, id, wasSelected }

  const adjacent = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
  const same = (a, b) => a && b && a.r === b.r && a.c === b.c;

  canvas.addEventListener('pointerdown', (e) => {
    game.onUserInput();
    if (!game.canInput()) return;
    const cell = game.cellAt(e.clientX, e.clientY);
    if (!cell) { game.selected = null; return; }

    if (game.selected && adjacent(game.selected, cell)) {
      const from = game.selected;
      game.selected = null;
      drag = null;
      game.requestSwap(from, cell);
      return;
    }
    const wasSelected = same(game.selected, cell);
    game.selected = cell;
    drag = { cell, x: e.clientX, y: e.clientY, id: e.pointerId, wasSelected };
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* 무시 */ }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    const threshold = game.STEP * game.scale * 0.3;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return;
    const { r, c } = drag.cell;
    const target = Math.abs(dx) > Math.abs(dy)
      ? { r, c: c + Math.sign(dx) }
      : { r: r + Math.sign(dy), c };
    drag = null;
    game.selected = null;
    if (game.board.inBounds(target.r, target.c)) game.requestSwap({ r, c }, target);
  });

  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    // 이미 선택된 타일을 다시 탭하면 선택 해제
    if (drag.wasSelected) game.selected = null;
    drag = null;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
}
