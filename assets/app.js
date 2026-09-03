/* 诗笺 · 主逻辑
 * 全部数据存在浏览器 localStorage 里，不联网、不上传。
 * 想换设备：用「关于」页的导出 / 导入把记录搬走。
 */

/* ---------- 1. 基础常量 ---------- */
var LS_KEY = "shijian_records_v1";
// 艾宾浩斯复习间隔（天）：加入当天先背一次，之后分别在 1、2、4、7、15、30、60 天后回炉
var STAGES = [0, 1, 2, 4, 7, 15, 30, 60];
var STAGE_NAME = ["初见", "1天后", "2天后", "4天后", "7天后", "15天后", "30天后", "60天后", "已入心"];

var poems = window.POEMS || [];
var recs = {};        // { 诗id: { stage, next, added, reviews } }
var curTab = "library";
var kw = "";
var fDynasty = "";
var fGenre = "";

/* ---------- 2. 小工具 ---------- */
function $(s) { return document.querySelector(s); }
function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }

function pad(n) { return n < 10 ? "0" + n : "" + n; }
function todayStr() {
  var d = new Date();
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}
function addDays(str, n) {
  var p = str.split("-");
  var d = new Date(+p[0], +p[1] - 1, +p[2]);
  d.setDate(d.getDate() + n);
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}
function esc(s) {
  return String(s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}
function findPoem(id) {
  for (var i = 0; i < poems.length; i++) if (poems[i].id === id) return poems[i];
  return null;
}

/* ---------- 3. 读写本地记录 ---------- */
function load() {
  try { recs = JSON.parse(localStorage.getItem(LS_KEY)) || {}; }
  catch (e) { recs = {}; }
}
function save() {
  localStorage.setItem(LS_KEY, JSON.stringify(recs));
}

/* ---------- 4. 渲染：今日推荐 ---------- */
function renderHero() {
  if (!poems.length) return;
  // 用日期算出一个固定的下标，保证同一天打开都是同一首
  var t = todayStr().replace(/-/g, "");
  var idx = parseInt(t, 10) % poems.length;
  var p = poems[idx];
  $("#hero").innerHTML =
    '<div class="hero-txt">' +
      '<div class="hero-label">今 日 推 荐</div>' +
      '<div class="hero-title">' + esc(p.title) + '</div>' +
      '<div class="hero-meta">' + esc(p.dynasty) + " · " + esc(p.author) + " · " + esc(p.genre) + "</div>" +
      '<div class="hero-body">' + esc(p.content.slice(0, 3).join("<br>")) + "</div>" +
    "</div>" +
    '<div class="hero-acts">' +
      '<button class="btn red" onclick="openDetail(\'' + p.id + '\')">读全文</button>' +
      '<button class="btn" onclick="toggleRec(\'' + p.id + '\')">' + (recs[p.id] ? "移出背诵本" : "加入背诵本") + "</button>" +
    "</div>";
}

/* ---------- 5. 渲染：筛选条 ---------- */
function renderFilters() {
  var ds = [], gs = [];
  poems.forEach(function (p) {
    if (ds.indexOf(p.dynasty) < 0) ds.push(p.dynasty);
    if (gs.indexOf(p.genre) < 0) gs.push(p.genre);
  });
  var h = '<div class="chips"><span class="chip' + (fDynasty === "" ? " on" : "") + '" onclick="setDynasty(\'\')">全部朝代</span>';
  ds.forEach(function (d) {
    h += '<span class="chip' + (fDynasty === d ? " on" : "") + '" onclick="setDynasty(\'' + d + '\')">' + d + "</span>";
  });
  h += '</div><div class="chips"><span class="chip' + (fGenre === "" ? " on" : "") + '" onclick="setGenre(\'\')">全部题材</span>';
  gs.forEach(function (g) {
    h += '<span class="chip' + (fGenre === g ? " on" : "") + '" onclick="setGenre(\'' + g + '\')">' + g + "</span>";
  });
  h += "</div>";
  $("#filters").innerHTML = h;
}
function setDynasty(d) { fDynasty = d; renderFilters(); renderGrid(); }
function setGenre(g) { fGenre = g; renderFilters(); renderGrid(); }

/* ---------- 6. 渲染：诗词卡片 ---------- */
function renderGrid() {
  var list = poems.filter(function (p) {
    if (fDynasty && p.dynasty !== fDynasty) return false;
    if (fGenre && p.genre !== fGenre) return false;
    if (kw) {
      var hay = p.title + p.author + p.dynasty + p.genre + p.content.join("") + p.notes;
      if (hay.indexOf(kw) < 0) return false;
    }
    return true;
  });
  if (!list.length) {
    $("#grid").innerHTML = '<div class="empty"><div class="big">没有找到</div>换个词试试，比如「月」「山」「愁」</div>';
    $("#count").textContent = "0 首";
    return;
  }
  var h = "";
  list.forEach(function (p) {
    h += '<div class="card" onclick="openDetail(\'' + p.id + '\')">' +
      (recs[p.id] ? '<div class="flag"></div>' : "") +
      "<h3>" + esc(p.title) + "</h3>" +
      '<div class="meta">' + esc(p.dynasty) + " · " + esc(p.author) + " · " + esc(p.genre) + "</div>" +
      "<p>" + esc(p.content.join("／")) + "</p></div>";
  });
  $("#grid").innerHTML = h;
  $("#count").textContent = list.length + " 首";
}

/* ---------- 7. 详情弹层 ---------- */
function openDetail(id) {
  var p = findPoem(id);
  if (!p) return;
  var inRec = !!recs[id];
  $("#sheet").innerHTML =
    '<button class="sheet-close" onclick="closeSheet()">×</button>' +
    "<h2>" + esc(p.title) + "</h2>" +
    '<div class="meta">' + esc(p.dynasty) + " · " + esc(p.author) + " · " + esc(p.genre) + "</div>" +
    '<div class="poem-body">' + esc(p.content.join("\n")) + "</div>" +
    '<div class="notes">' + esc(p.notes) + "</div>" +
    '<div class="sheet-acts">' +
      '<button class="btn red" onclick="startQuiz(\'' + id + '\')">默写自测</button>' +
      '<button class="btn" onclick="toggleRec(\'' + id + '\')">' + (inRec ? "移出背诵本" : "加入背诵本") + "</button>" +
      '<button class="btn" onclick="openCard(\'' + id + '\')">生成分享卡片</button>' +
      '<button class="btn" onclick="closeSheet()">收起</button>' +
    "</div>";
  $("#mask").classList.add("show");
}
function closeSheet() { $("#mask").classList.remove("show"); }

/* ---------- 8. 加入 / 移出背诵本 ---------- */
function toggleRec(id) {
  if (recs[id]) {
    delete recs[id];
  } else {
    recs[id] = { stage: 0, next: todayStr(), added: todayStr(), reviews: 0 };
  }
  save();
  renderHero(); renderGrid(); renderRecite(); renderStats();
  if ($("#mask").classList.contains("show")) {
    var stillIn = !!recs[id];
    $("#sheet").querySelector(".sheet-acts").children[1].textContent = stillIn ? "移出背诵本" : "加入背诵本";
  }
}

/* ---------- 9. 渲染：背诵本 ---------- */
function renderRecite() {
  var ids = Object.keys(recs);
  if (!ids.length) {
    $("#recite").innerHTML = '<div class="empty"><div class="big">背诵本还是空的</div>在「诗词库」里点开任意一首，按「加入背诵本」开始</div>';
    return;
  }
  var today = todayStr();
  var due = [], later = [], done = [];
  ids.forEach(function (id) {
    var p = findPoem(id);
    if (!p) return;
    var r = recs[id];
    if (r.stage >= STAGES.length - 1) done.push(id);
    else if (r.next <= today) due.push(id);
    else later.push(id);
  });

  function row(id, cls) {
    var p = findPoem(id), r = recs[id];
    var over = r.next < today;
    return '<div class="due-item ' + cls + '">' +
      '<div class="due-info"><h4>' + esc(p.title) + "</h4>" +
      "<p>" + esc(p.dynasty) + " · " + esc(p.author) + " · 已背 " + r.reviews + " 次" +
      (cls === "" ? (over ? " · 已逾期" : " · 今日该背") : " · 下次 " + r.next) + "</p></div>" +
      '<span class="stage">' + STAGE_NAME[Math.min(r.stage, STAGE_NAME.length - 1)] + "</span>" +
      '<button class="btn sm" onclick="openDetail(\'' + id + '\')">看</button>' +
      '<button class="btn sm red" onclick="markReview(\'' + id + '\',1)">记得</button>' +
      '<button class="btn sm" onclick="markReview(\'' + id + '\',0)">忘了</button>' +
      "</div>";
  }

  var h = "";
  h += '<div class="sec-title">今日该复习<span>' + due.length + " 首</span></div>";
  h += due.length
    ? '<div class="due-list">' + due.map(function (i) { return row(i, ""); }).join("") + "</div>"
    : '<div class="empty" style="padding:24px">今天没有欠账，可以去诗词库挑几首新的</div>';

  if (later.length) {
    h += '<div class="sec-title">还没到时间<span>' + later.length + " 首</span></div>";
    h += '<div class="due-list">' + later.map(function (i) { return row(i, "done"); }).join("") + "</div>";
  }
  if (done.length) {
    h += '<div class="sec-title">已入心<span>' + done.length + " 首</span></div>";
    h += '<div class="due-list">' + done.map(function (i) { return row(i, "done"); }).join("") + "</div>";
  }
  $("#recite").innerHTML = h;
}

function markReview(id, ok) {
  var r = recs[id];
  if (!r) return;
  r.reviews++;
  if (ok) {
    r.stage = Math.min(r.stage + 1, STAGES.length - 1);
  } else {
    r.stage = 0;   // 忘了就从头再来，这是艾宾浩斯最狠也最有效的地方
  }
  r.next = addDays(todayStr(), STAGES[Math.min(r.stage, STAGES.length - 1)]);
  save();
  renderRecite(); renderStats(); renderGrid();
}

/* ---------- 10. 默写自测 ---------- */
function startQuiz(id) {
  var p = findPoem(id);
  var text = p.content.join("\n");
  var h = '<button class="sheet-close" onclick="closeSheet()">×</button>' +
    "<h2>默写 · " + esc(p.title) + "</h2>" +
    '<div class="meta">' + esc(p.dynasty) + " · " + esc(p.author) + " · 空格里填一个字，填完点检查</div>" +
    '<div class="quiz-body" id="quizBody">';
  var blanks = 0;
  for (var i = 0; i < text.length; i++) {
    var ch = text[i];
    if (ch === "\n") { h += "<br>"; continue; }
    // 汉字才挖空，标点保留；约 35% 的字会被遮住
    if (/[\u4e00-\u9fa5]/.test(ch) && Math.random() < 0.35) {
      h += '<input class="blank" maxlength="1" data-a="' + esc(ch) + '">';
      blanks++;
    } else {
      h += "<span>" + esc(ch) + "</span>";
    }
  }
  h += "</div>" +
    '<div class="quiz-msg" id="quizMsg">共 ' + blanks + " 个空</div>" +
    '<div class="sheet-acts">' +
      '<button class="btn red" onclick="checkQuiz()">检查</button>' +
      '<button class="btn" onclick="showAnswer()">看答案</button>' +
      '<button class="btn" onclick="startQuiz(\'' + id + '\')">换一组空</button>' +
      '<button class="btn" onclick="openDetail(\'' + id + '\')">返回原文</button>' +
    "</div>";
  $("#sheet").innerHTML = h;
  $("#mask").classList.add("show");
  var first = $("#quizBody .blank");
  if (first) first.focus();
}
function checkQuiz() {
  var bs = $$("#quizBody .blank");
  var right = 0;
  bs.forEach(function (b) {
    var v = b.value.trim();
    b.classList.remove("ok", "bad");
    if (!v) return;
    if (v === b.getAttribute("data-a")) { b.classList.add("ok"); right++; }
    else b.classList.add("bad");
  });
  var pct = bs.length ? Math.round(right / bs.length * 100) : 0;
  $("#quizMsg").textContent = "填对 " + right + " / " + bs.length + "，正确率 " + pct + "%。" +
    (pct === 100 ? "全对，这首可以往前推一档了。" : pct >= 80 ? "不错，再顺一遍就稳了。" : "回去读两遍再来，别急。");
}
function showAnswer() {
  $$("#quizBody .blank").forEach(function (b) { b.value = b.getAttribute("data-a"); });
  $("#quizMsg").textContent = "答案已填好，对照着读一遍。";
}

/* ---------- 11. 飞花令 ---------- */
function renderFeihua() {
  var key = ($("#fhInput").value || "").trim();
  var box = $("#fhList");
  if (!key) {
    box.innerHTML = '<div class="empty"><div class="big">输入一个字试试</div>比如「月」「花」「风」「山」「酒」</div>';
    return;
  }
  var out = [];
  poems.forEach(function (p) {
    p.content.forEach(function (line) {
      // 按标点切成单句，再找含关键字的句子
      line.split(/[，。？！、；：]/).forEach(function (seg) {
        if (seg.indexOf(key) >= 0 && seg.length > 2) {
          out.push({ seg: seg, p: p });
        }
      });
    });
  });
  if (!out.length) {
    box.innerHTML = '<div class="empty"><div class="big">诗库里没有含「' + esc(key) + '」的句子</div>换一个常见字试试</div>';
    return;
  }
  var h = "";
  out.slice(0, 80).forEach(function (o) {
    var marked = esc(o.seg).split(key).join("<em>" + esc(key) + "</em>");
    h += '<div class="fh-item" onclick="openDetail(\'' + o.p.id + '\')">' + marked +
      '<div class="src">—— ' + esc(o.p.dynasty) + " · " + esc(o.p.author) + "《" + esc(o.p.title) + "》</div></div>";
  });
  box.innerHTML = '<div class="fh-hint">共找到 ' + out.length + " 句" + (out.length > 80 ? "，先显示前 80 句" : "") + "</div>" + h;
}

/* ---------- 12. 导出 / 导入 / 统计 ---------- */
function exportData() {
  var blob = new Blob([JSON.stringify(recs, null, 2)], { type: "application/json" });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "诗笺-背诵记录-" + todayStr() + ".json";
  a.click();
}
function importData(file) {
  var fr = new FileReader();
  fr.onload = function () {
    try {
      var d = JSON.parse(fr.result);
      recs = d; save();
      renderHero(); renderGrid(); renderRecite(); renderStats();
      alert("导入成功，共 " + Object.keys(recs).length + " 条记录");
    } catch (e) { alert("文件格式不对，请选择本工具导出的 json"); }
  };
  fr.readAsText(file);
}
function renderStats() {
  var ids = Object.keys(recs), today = todayStr(), due = 0, done = 0;
  ids.forEach(function (id) {
    var r = recs[id];
    if (r.stage >= STAGES.length - 1) done++;
    else if (r.next <= today) due++;
  });
  var el = $("#stats");
  if (el) el.innerHTML = "背诵本 " + ids.length + " 首 · 今日待复习 " + due + " 首 · 已入心 " + done + " 首";
}

/* ---------- 13. 切页 ---------- */
function switchTab(name) {
  curTab = name;
  $$("nav button").forEach(function (b) {
    b.classList.toggle("on", b.getAttribute("data-t") === name);
  });
  $$(".page").forEach(function (el) { el.style.display = "none"; });
  $("#page-" + name).style.display = "block";
  if (name === "recite") { renderRecite(); }
  if (name === "feihua") { renderFeihua(); }
  if (name === "about") { renderStats(); }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------- 13.5 分享卡片生成器（产品化核心） ---------- */
// 三种底色：宣纸 / 墨夜 / 青绿，点「换底色」循环切换
var CARD_THEMES = [
  { name:"宣纸", bg:"#F6F1E6", ink:"#2C2A26", sub:"#8C8577", line:"#E2DBCB", seal:"#A8352A" },
  { name:"墨夜", bg:"#23211D", ink:"#F1ECE1", sub:"#A89E8C", line:"#3A362F", seal:"#C9705F" },
  { name:"青绿", bg:"#EAF0EE", ink:"#243530", sub:"#5E726C", line:"#C8D6D1", seal:"#4A6660" }
];
var cardThemeIdx = 0;
var cardPoem = null;

// 按像素宽度自动换行，返回多行
function wrapText(ctx, text, maxW) {
  var lines = [], cur = "";
  for (var i = 0; i < text.length; i++) {
    var t = cur + text[i];
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = text[i]; }
    else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawCard(p) {
  var th = CARD_THEMES[cardThemeIdx];
  var W = 680, pad = 52, scale = 2; // 2 倍像素 = 高清图
  var cv = document.getElementById("cardCanvas");
  var ctx = cv.getContext("2d");

  // 第一遍：量高度（canvas 必须先定高才能画）
  ctx.font = '600 30px "Songti SC","SimSun",serif';
  var titleH = 30, metaH = 18;
  ctx.font = '400 21px "Songti SC","SimSun",serif';
  var bodyLines = [];
  p.content.forEach(function (line) {
    wrapText(ctx, line, W - pad * 2).forEach(function (l) { bodyLines.push(l); });
  });
  var bodyH = bodyLines.length * 38;
  var notesLines = [];
  if (p.notes) {
    ctx.font = '400 15px "PingFang SC","Microsoft YaHei",sans-serif';
    p.notes.split("\n").forEach(function (nl) {
      wrapText(ctx, nl, W - pad * 2 - 24).forEach(function (l) { notesLines.push(l); });
    });
  }
  var notesH = notesLines.length * 26 + (p.notes ? 28 : 0);
  var H = pad + titleH + 14 + metaH + 26 + bodyH + (notesH ? notesH + 20 : 0) + 70;

  cv.width = W * scale; cv.height = H * scale;
  cv.style.width = W + "px"; cv.style.height = H + "px";
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(scale, scale);

  // 背景 + 细边框
  ctx.fillStyle = th.bg; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = th.line; ctx.lineWidth = 1;
  ctx.strokeRect(pad / 2, pad / 2, W - pad, H - pad);

  var cx = W / 2, y = pad + 6;
  ctx.textBaseline = "alphabetic";

  // 标题
  ctx.fillStyle = th.ink; ctx.textAlign = "center";
  ctx.font = '600 30px "Songti SC","SimSun",serif';
  ctx.fillText(p.title, cx, y + titleH);
  y += titleH + 14;
  // 元信息
  ctx.fillStyle = th.sub; ctx.font = '400 16px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.fillText(p.dynasty + " · " + p.author + " · " + p.genre, cx, y + metaH);
  y += metaH + 26;
  // 正文
  ctx.fillStyle = th.ink; ctx.font = '400 21px "Songti SC","SimSun",serif';
  bodyLines.forEach(function (l) { ctx.fillText(l, cx, y + 26); y += 38; });
  y += 14;
  // 赏读
  if (p.notes) {
    ctx.fillStyle = th.line; ctx.fillRect(pad, y - 18, 3, notesLines.length * 26 + 8);
    ctx.fillStyle = th.sub; ctx.font = '400 15px "PingFang SC","Microsoft YaHei",sans-serif';
    notesLines.forEach(function (l) { ctx.fillText(l, pad + 14, y); y += 26; });
    y += 20;
  }
  // 页脚：产品名 + 印章
  ctx.fillStyle = th.sub; ctx.font = '400 14px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.textAlign = "left";
  ctx.fillText("诗笺 · 古诗词学习工作台", pad, H - pad + 6);
  ctx.strokeStyle = th.seal; ctx.lineWidth = 2;
  ctx.strokeRect(W - pad - 40, H - pad - 18, 34, 34);
  ctx.fillStyle = th.seal; ctx.font = '600 20px "Songti SC","SimSun",serif';
  ctx.textAlign = "center";
  ctx.fillText("笺", W - pad - 23, H - pad + 6);
}

function openCard(id) {
  var p = findPoem(id); if (!p) return;
  cardPoem = p; cardThemeIdx = 0;
  drawCard(p);
  document.getElementById("cardMask").classList.add("show");
}
function closeCard() { document.getElementById("cardMask").classList.remove("show"); }
function cycleCardTheme() {
  cardThemeIdx = (cardThemeIdx + 1) % CARD_THEMES.length;
  if (cardPoem) drawCard(cardPoem);
}
function downloadCard() {
  var cv = document.getElementById("cardCanvas");
  var a = document.createElement("a");
  a.href = cv.toDataURL("image/png");
  a.download = "诗笺-" + (cardPoem ? cardPoem.title : "卡片") + ".png";
  a.click();
}

/* ---------- 14. 启动 ---------- */
load();
renderHero();
renderFilters();
renderGrid();
renderRecite();
renderStats();

$("#search").addEventListener("input", function (e) { kw = e.target.value.trim(); renderGrid(); });
$("#fhInput").addEventListener("input", renderFeihua);
$("#mask").addEventListener("click", function (e) { if (e.target.id === "mask") closeSheet(); });
document.addEventListener("keydown", function (e) { if (e.key === "Escape") { closeSheet(); closeCard(); } });
$("#cardMask").addEventListener("click", function (e) { if (e.target.id === "cardMask") closeCard(); });
