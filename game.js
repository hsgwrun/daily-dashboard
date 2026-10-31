/* 今日の遊び — 餅つきゲーム
   杵がもちに近い瞬間にスペースかタップ。8回まいたら完成。
   うまくなっても、もちの味は変わりません。 */
'use strict';

(function () {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // 古いブラウザ用の簡易フォールバック
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      this.moveTo(x + r, y);
      this.arcTo(x + w, y, x + w, y + h, r);
      this.arcTo(x + w, y + h, x, y + h, r);
      this.arcTo(x, y + h, x, y, r);
      this.arcTo(x, y, x + w, y, r);
      this.closePath();
      return this;
    };
  }

  const HITS_TO_FINISH = 8;
  const STRIKE_DUR = 0.32;
  const AMPLITUDE = 90;
  const ZONE = 20; // めざす幅（px） — 心優しい設計

  const HIT_TEXTS = ['ぺったん！', 'いい音！', 'ぺったん', 'まだまだいける'];
  const MISS_TEXTS = ['あと少し！', 'タイミングが命', 'もちは待っています'];
  const RANKS = [
    [1, 'S', '神業'],
    [3, 'A', '職人'],
    [5, 'B', 'おうちもち'],
    [Infinity, 'C', 'もちのような心'],
  ];

  let state = 'idle'; // idle | playing | done
  let hits = 0;
  let misses = 0;
  let combo = 0;
  let time = 0;
  let strikeT = -1; // 打つアニメーションの進行
  let squash = 0; // もちのつぶれ具合
  let steam = [];
  let floats = [];
  let css = {};

  /* --- サイズ --- */
  let W = 0;
  const H = 240;
  function fit() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  fit();
  window.addEventListener('resize', fit);

  /* --- ベスト記録（日替わり） --- */
  const BEST_KEY = 'mochi-best';
  function loadBest() {
    const p = jstParts();
    const today = isoDate(p.year, p.month, p.day);
    const saved = store.get(BEST_KEY, null);
    if (!saved || saved.date !== today) return null;
    return saved;
  }
  function saveBest(missCount) {
    const r = rankFor(missCount);
    store.set(BEST_KEY, { date: isoDateOfToday(), misses: missCount, rank: r.rank, label: r.label });
  }
  function isoDateOfToday() {
    const p = jstParts();
    return isoDate(p.year, p.month, p.day);
  }
  function rankFor(missCount) {
    for (const [max, r, label] of RANKS) if (missCount <= max) return { rank: r, label };
    return { rank: 'C', label: 'もちのような心' };
  }
  function showBest() {
    const b = loadBest();
    document.getElementById('game-best').textContent = b
      ? `今日のベスト: ${b.rank}（${b.label}）`
      : '今日のベスト: —';
  }
  showBest();

  /* --- 入力 --- */
  function action() {
    if (state === 'idle') {
      state = 'playing';
      hits = 0;
      misses = 0;
      combo = 0;
      floats = [];
      return;
    }
    if (state === 'done') {
      state = 'idle';
      showBest();
      return;
    }
    if (strikeT >= 0 && strikeT < 0.2) return; // 打った直後は受け付けない
    if (pestleBottom() >= mochiTop() - ZONE) {
      hits += 1;
      combo += 1;
      strikeT = 0;
      squash = 1;
      spawnSteam();
      let text = HIT_TEXTS[Math.floor(Math.random() * HIT_TEXTS.length)];
      if (combo >= 3) text = `リズムがいい（${combo}連続）`;
      floats.push({ text, x: W / 2, y: mochiTop() - 30, life: 1 });
      if (hits >= HITS_TO_FINISH) {
        state = 'done';
        saveBest(misses);
        showBest();
      }
    } else {
      misses += 1;
      combo = 0;
      floats.push({
        text: MISS_TEXTS[Math.floor(Math.random() * MISS_TEXTS.length)],
        x: W / 2,
        y: mochiTop() - 30,
        life: 1,
      });
    }
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    action();
  });

  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Space') return;
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    e.preventDefault();
    action();
  });

  /* --- 位置計算 --- */
  function period() {
    return Math.max(0.9, 1.5 - hits * 0.07);
  }
  function mochiTop() {
    return H - 92; // もちの上端
  }
  function pestleBottom() {
    if (state === 'done') return mochiTop() - 70; // 完成したら杵は上げておく
    if (state === 'idle') {
      // 待機中はゆっくり上下
      return mochiTop() - AMPLITUDE * (0.5 - 0.5 * Math.sin(time * 1.1));
    }
    if (strikeT >= 0 && strikeT < STRIKE_DUR) {
      // 打っている間はもちにめり込む
      const p = strikeT / STRIKE_DUR;
      const dip = Math.sin(Math.min(p * 2, 1) * Math.PI);
      return mochiTop() + 8 * dip;
    }
    const phase = (time / period()) * Math.PI * 2;
    return mochiTop() - AMPLITUDE * (0.5 - 0.5 * Math.sin(phase));
  }

  function spawnSteam() {
    for (let i = 0; i < 5; i++) {
      steam.push({
        x: W / 2 + (Math.random() - 0.5) * 40,
        y: mochiTop() - 10,
        vy: -20 - Math.random() * 25,
        life: 1,
      });
    }
  }

  /* --- 描画 --- */
  function draw() {
    css = {
      text: getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim(),
      muted: getComputedStyle(document.documentElement).getPropertyValue('--color-text-muted').trim(),
      faint: getComputedStyle(document.documentElement).getPropertyValue('--color-text-faint').trim(),
      accent: getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim(),
      divider: getComputedStyle(document.documentElement).getPropertyValue('--color-divider').trim(),
    };
    ctx.clearRect(0, 0, W, H);

    const cx = W / 2;
    const floor = H - 26;

    // 床
    ctx.strokeStyle = css.divider;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, floor);
    ctx.lineTo(W - 20, floor);
    ctx.stroke();

    // めやすの帯（ここに杵の頭があれば当たり）
    if (state === 'playing') {
      ctx.fillStyle = css.accent;
      ctx.globalAlpha = 0.08;
      ctx.fillRect(cx - 110, mochiTop() - ZONE, 220, ZONE + 6);
      ctx.globalAlpha = 1;
    }

    // 臼（うす）
    drawMortar(cx, floor);

    // もち（完成したら少し顔になる）
    drawMochi(cx);

    // 杵（きね）
    drawPestle(cx);

    // 湯気
    for (const s of steam) {
      ctx.fillStyle = css.faint;
      ctx.globalAlpha = 0.4 * s.life;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 浮かぶ文字
    ctx.font = '700 13px "Zen Kaku Gothic New", sans-serif';
    ctx.textAlign = 'center';
    for (const f of floats) {
      ctx.fillStyle = css.text;
      ctx.globalAlpha = f.life;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    // 状態別の文言（左寄せ：杵と重ならないように。狭いときは短縮版）
    const compact = W < 560;
    const tx = compact ? 16 : 24;
    ctx.textAlign = 'left';
    if (state === 'idle') {
      ctx.fillStyle = css.text;
      ctx.font = `700 ${compact ? 12 : 15}px "Zen Kaku Gothic New", sans-serif`;
      ctx.fillText(compact ? 'スペースかタップで開始' : 'スペースキーかタップで、もちつき開始', tx, 36);
      ctx.fillStyle = css.muted;
      ctx.font = `${compact ? 11 : 12}px "Zen Kaku Gothic New", sans-serif`;
      ctx.fillText(compact ? '赤い帯の瞬間がチャンス' : '杵の頭が赤い帯に入った瞬間がチャンス', tx, 56);
    } else if (state === 'playing') {
      ctx.font = '700 13px "Zen Kaku Gothic New", sans-serif';
      ctx.fillStyle = css.muted;
      ctx.fillText(`つき ${hits}/${HITS_TO_FINISH}`, tx, 36);
      if (misses > 0) ctx.fillText(`はずし ${misses}`, tx, 56);
    } else if (state === 'done') {
      ctx.fillStyle = css.text;
      ctx.font = `700 ${compact ? 12 : 15}px "Zen Kaku Gothic New", sans-serif`;
      ctx.fillText(compact ? '完成！おめでとう' : '完成！きな粉か醤油かはお好みで', tx, 36);
      const r = rankFor(misses);
      ctx.fillStyle = css.accent;
      ctx.fillText(`ランク ${r.rank}（${r.label}）`, tx, 58);
      ctx.fillStyle = css.muted;
      ctx.font = `${compact ? 11 : 12}px "Zen Kaku Gothic New", sans-serif`;
      ctx.fillText(compact ? 'タップでもう一度' : 'スペースキーかタップで、もう一度', tx, 78);
    }
    ctx.textAlign = 'center';
  }

  function drawMortar(cx, floor) {
    ctx.fillStyle = '#9c7a5c';
    ctx.beginPath();
    ctx.moveTo(cx - 78, mochiTop() + 14);
    ctx.quadraticCurveTo(cx - 70, floor, cx - 46, floor);
    ctx.lineTo(cx + 46, floor);
    ctx.quadraticCurveTo(cx + 70, floor, cx + 78, mochiTop() + 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7d6047';
    ctx.fillRect(cx - 84, mochiTop() + 6, 168, 10);
  }

  function drawMochi(cx) {
    const r = 24 + hits * 2.4;
    const sy = 1 - 0.35 * squash;
    const sx = 1 + 0.22 * squash;
    ctx.save();
    ctx.translate(cx, mochiTop() + r * 0.6);
    ctx.scale(sx, sy);
    ctx.fillStyle = '#f6f2e8';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    // つや
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.3, -r * 0.35, r * 0.28, r * 0.16, -0.5, 0, Math.PI * 2);
    ctx.fill();
    // 完成したら、うれしい顔
    if (state === 'done') {
      ctx.strokeStyle = '#9a9384';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      for (const ex of [-r * 0.35, r * 0.35]) {
        ctx.beginPath();
        ctx.arc(ex, -r * 0.1, r * 0.12, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, r * 0.25, r * 0.18, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPestle(cx) {
    const bottom = pestleBottom();
    // 柄
    ctx.fillStyle = '#8a6f57';
    ctx.fillRect(cx - 5, 8, 10, Math.max(bottom - 22 - 8, 0));
    // 頭
    ctx.fillStyle = '#a9846a';
    ctx.beginPath();
    ctx.roundRect(cx - 16, bottom - 22, 32, 22, 8);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.roundRect(cx - 16, bottom - 22, 32, 7, 4);
    ctx.fill();
  }

  /* --- ループ --- */
  let last = performance.now();
  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    time += dt;

    if (strikeT >= 0) {
      strikeT += dt;
      if (strikeT >= STRIKE_DUR) strikeT = -1;
    }
    squash = Math.max(0, squash - dt * 3);
    for (const s of steam) {
      s.y += s.vy * dt;
      s.life -= dt;
    }
    steam = steam.filter((s) => s.life > 0);
    for (const f of floats) {
      f.y -= 18 * dt;
      f.life -= dt * 1.4;
    }
    floats = floats.filter((f) => f.life > 0);

    draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
