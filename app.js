(() => {
  "use strict";
  const bank = window.RESEARCH_METHOD_QUESTIONS;
  const STORAGE_KEY = "research-methodology-exam-progress-v1";
  const typeLabels = { cloze: "빈칸 문제", keyword: "키워드형", essay: "서술형" };
  const modeLabels = { core: "핵심 우선", review: "오답 복습", all: "전체 순환" };
  const titles = { cloze: "핵심 문장을 정확히 완성하세요", keyword: "채점 기준이 되는 핵심어를 쓰세요", essay: "30점 답안을 처음부터 끝까지 작성하세요" };
  const els = Object.fromEntries([...document.querySelectorAll("[id]")].map((el) => [el.id, el]));
  const safeParse = (value, fallback) => { try { return JSON.parse(value) ?? fallback; } catch { return fallback; } };
  let store = safeParse(localStorage.getItem(STORAGE_KEY), { stats: {}, totals: { attempts: 0, correct: 0, sessions: 0 }, bookmarks: [] });
  if (!store.stats) store.stats = {};
  if (!store.totals) store.totals = { attempts: 0, correct: 0, sessions: 0 };
  if (!store.bookmarks) store.bookmarks = [];
  let type = "cloze", mode = "core", count = 20, session = [], index = 0, score = 0, answered = false, revealed = false;

  const normalize = (value) => String(value ?? "").normalize("NFKC").toLowerCase().replace(/[\s·ㆍ,，.。;:()（）\[\]{}<>〈〉《》'"“”‘’!?！？\-_/]/g, "");
  const keyFor = (item, itemType = type) => `${itemType}:${item.id}`;
  const getStat = (item, itemType = type) => store.stats[keyFor(item, itemType)] || { attempts: 0, correct: 0, wrong: 0, streak: 0, nextDue: 0 };
  const due = (item, itemType = type) => { const stat = getStat(item, itemType); return stat.wrong > 0 && (stat.nextDue || 0) <= Date.now(); };
  const allEntries = () => Object.entries({ cloze: bank.cloze, keyword: bank.keyword, essay: bank.essay }).flatMap(([itemType, items]) => items.map((item) => ({ itemType, item })));
  const dueCount = () => allEntries().filter(({ itemType, item }) => due(item, itemType)).length;

  function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); updateSummaries(); }
  function weighted(items) {
    return [...items].map((item) => {
      const stat = getStat(item); let weight = item.importance === 3 ? 6 : item.importance === 2 ? 2.5 : 1;
      if (stat.wrong > stat.correct) weight += 5; if (due(item)) weight += 4; if (!stat.attempts) weight += 1;
      return { item, order: Math.pow(Math.random(), 1 / weight) };
    }).sort((a, b) => b.order - a.order).map(({ item }) => item);
  }
  function selectItems() {
    let pool = bank[type];
    if (mode === "core") pool = pool.filter((item) => item.importance >= 2);
    if (mode === "review") {
      pool = pool.filter((item) => due(item));
      if (!pool.length) pool = bank[type].filter((item) => getStat(item).wrong > 0 || store.bookmarks.includes(keyFor(item)));
      if (!pool.length) pool = bank[type].filter((item) => item.importance === 3);
    }
    return weighted(pool).slice(0, Math.min(count, pool.length));
  }

  function switchView(view) {
    document.querySelectorAll(".view").forEach((el) => el.classList.toggle("is-active", el.id === `view-${view}`));
    document.querySelectorAll("[data-view]").forEach((el) => el.classList.toggle("is-active", el.dataset.view === view));
    if (view === "progress") renderProgress();
    location.hash = view; window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function setType(nextType, restart = true) {
    type = nextType;
    document.querySelectorAll("[data-type]").forEach((button) => { const active = button.dataset.type === type; button.classList.toggle("is-active", active); button.setAttribute("aria-selected", String(active)); });
    els["page-title"].textContent = titles[type];
    if (restart) startSession();
  }
  function startSession() {
    count = Number(els["question-count"].value);
    session = selectItems(); index = 0; score = 0; answered = false; revealed = false;
    store.totals.sessions += 1; persist();
    els["session-label"].textContent = `${typeLabels[type]} · ${modeLabels[mode]}`;
    switchView("study"); renderQuestion();
    return { type, mode, count: session.length };
  }
  const current = () => session[index];
  function showPanel(name) { ["cloze-panel", "keyword-panel", "essay-panel", "completion"].forEach((id) => { els[id].hidden = id !== name; }); }
  function renderBase(item) {
    answered = false; revealed = false;
    els.topic.textContent = item.topic;
    els.importance.textContent = item.importance === 3 ? "최우선" : item.importance === 2 ? "중요" : "보충";
    els["format-badge"].textContent = typeLabels[type];
    els.position.textContent = `${index + 1} / ${session.length}`;
    els["score-label"].textContent = type === "essay" ? `충분히 씀 ${score}` : `정답 ${score}`;
    els["progress-fill"].style.width = `${((index + 1) / Math.max(1, session.length)) * 100}%`;
    const saved = store.bookmarks.includes(keyFor(item)); els.bookmark.textContent = saved ? "★" : "☆"; els.bookmark.classList.toggle("is-active", saved);
  }
  function renderQuestion() {
    const item = current(); if (!item) { renderComplete(); return; }
    renderBase(item);
    if (type === "cloze") renderCloze(item); else if (type === "keyword") renderKeyword(item); else renderEssay(item);
  }
  function renderCloze(item) {
    showPanel("cloze-panel");
    els["cloze-text"].replaceChildren();
    const [before, after = ""] = item.text.split("____"); els["cloze-text"].append(document.createTextNode(before));
    const blank = document.createElement("span"); blank.className = "blank"; blank.textContent = item.answer; els["cloze-text"].append(blank, document.createTextNode(after));
    els["cloze-answer"].value = ""; els["cloze-answer"].disabled = false; els["cloze-answer"].className = ""; els["cloze-answer"].placeholder = "정답을 입력하세요";
    els["check-cloze"].disabled = false; els["cloze-feedback"].hidden = true; els["cloze-feedback"].classList.remove("is-wrong");
    els["study-tip"].textContent = item.hint ? `힌트 없이 먼저 떠올린 뒤 막히면 확인하세요: ${item.hint}` : "정의와 반대개념을 함께 떠올리세요.";
    setTimeout(() => els["cloze-answer"].focus(), 30);
  }
  function renderKeyword(item) {
    showPanel("keyword-panel"); els["keyword-question"].textContent = item.question; els["keyword-answer"].value = ""; els["keyword-answer"].disabled = false; els["keyword-answer"].className = "";
    els["check-keyword"].disabled = false; els["keyword-feedback"].hidden = true; els["keyword-feedback"].classList.remove("is-wrong"); els["keyword-grid"].replaceChildren();
    els["study-tip"].textContent = "문장보다 채점 기준이 되는 명사·구를 먼저 모두 꺼내보세요.";
  }
  function renderEssay(item) {
    showPanel("essay-panel"); els["essay-question"].textContent = item.question; els["essay-min"].textContent = item.minChars; els["essay-answer"].value = ""; els["essay-answer"].disabled = false; els["essay-answer"].className = "essay-answer"; els["char-count"].textContent = "0자";
    els["reveal-essay"].disabled = false; els["essay-review"].hidden = true; els["essay-next"].hidden = true; els["essay-checklist"].replaceChildren();
    document.querySelectorAll("[data-rating]").forEach((button) => { button.disabled = false; button.classList.remove("selected"); });
    els["study-tip"].textContent = "정의 → 유형·요건 → 장단점·비교 → 결론 순으로 구조를 먼저 잡으세요.";
  }

  function record(item, correct, retrySoon = false) {
    const stat = getStat(item); stat.attempts += 1; stat.lastAttempt = Date.now(); store.totals.attempts += 1;
    if (correct) { stat.correct += 1; stat.streak += 1; store.totals.correct += 1; score += 1; const gaps = [60*60e3,24*60*60e3,3*24*60*60e3,7*24*60*60e3,14*24*60*60e3]; stat.nextDue = Date.now() + gaps[Math.min(stat.streak - 1, gaps.length - 1)]; }
    else { stat.wrong += 1; stat.streak = 0; stat.nextDue = retrySoon ? Date.now() + 6*60*60e3 : Date.now(); }
    store.stats[keyFor(item)] = stat; persist(); els["score-label"].textContent = type === "essay" ? `충분히 씀 ${score}` : `정답 ${score}`; return stat;
  }
  function gradeCloze(reveal = false) {
    if (answered) return; const item = current(); const input = els["cloze-answer"].value; if (!input.trim() && !reveal) { els["cloze-answer"].focus(); return; }
    const correct = !reveal && normalize(input) === normalize(item.answer); answered = true; record(item, correct);
    els["cloze-answer"].disabled = true; els["check-cloze"].disabled = true; els["cloze-answer"].classList.add(correct ? "good" : "bad");
    els["cloze-feedback"].hidden = false; els["cloze-feedback"].classList.toggle("is-wrong", !correct); els["cloze-result"].textContent = correct ? "정답입니다" : reveal ? "정답을 확인했습니다" : "다시 기억할 문제입니다"; els["cloze-detail"].textContent = `정답: ${item.answer} · ${item.hint}`;
  }
  function gradeKeyword() {
    if (answered) return; const item = current(); const value = normalize(els["keyword-answer"].value); if (!value) { els["keyword-answer"].focus(); return; }
    const hits = item.aliases.map((group) => group.some((term) => value.includes(normalize(term)))); const found = hits.filter(Boolean).length; const required = Math.ceil(item.keywords.length * .7); const correct = found >= required; answered = true; record(item, correct);
    els["keyword-answer"].disabled = true; els["check-keyword"].disabled = true; els["keyword-answer"].classList.add(correct ? "good" : "bad"); els["keyword-feedback"].hidden = false; els["keyword-feedback"].classList.toggle("is-wrong", !correct);
    els["keyword-result"].textContent = `${item.keywords.length}개 중 ${found}개 확인 · ${correct ? "핵심 통과" : "보완 필요"}`;
    els["keyword-grid"].replaceChildren(...item.keywords.map((word, i) => { const span = document.createElement("span"); span.textContent = `${hits[i] ? "✓" : "+"} ${word}`; span.className = hits[i] ? "found" : "missing"; return span; })); els["keyword-model"].textContent = item.model;
  }
  function revealEssay() {
    if (revealed) return; const item = current(); revealed = true; els["essay-review"].hidden = false; els["reveal-essay"].disabled = true;
    els["essay-checklist"].replaceChildren(...item.checklist.map((criterion) => { const label = document.createElement("label"); const input = document.createElement("input"); input.type = "checkbox"; label.append(input, document.createTextNode(criterion)); return label; }));
    els["essay-model"].textContent = item.model; els["essay-review"].scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function rateEssay(rating) {
    if (answered || !revealed) return; answered = true; const good = rating === "remember"; record(current(), good, rating === "uncertain");
    document.querySelectorAll("[data-rating]").forEach((button) => { button.disabled = true; button.classList.toggle("selected", button.dataset.rating === rating); }); els["essay-answer"].disabled = true; els["essay-next"].hidden = false;
  }
  function next() { index += 1; renderQuestion(); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function renderComplete() {
    showPanel("completion"); els["completion-title"].textContent = `${typeLabels[type]} · ${modeLabels[mode]}`; els["completion-score"].textContent = score; els["completion-total"].textContent = ` / ${session.length}`;
    els["completion-copy"].textContent = type === "essay" ? "일부 누락·다시 공부로 표시한 답안은 복습 일정에 반영했습니다." : score === session.length ? "전부 맞혔습니다. 다음 단계로 넘어가도 좋습니다." : "틀린 문제는 오답 복습에서 더 자주 출제됩니다."; els["progress-fill"].style.width = "100%";
  }

  function updateSummaries() { const n = dueCount(); els["due-summary"].textContent = `복습 대기 ${n}문제`; els["today-summary"].textContent = n ? `오늘 다시 볼 문제 ${n}개` : "핵심문제부터 시작하세요."; }
  function renderProgress() {
    const attempts = store.totals.attempts || 0, correct = store.totals.correct || 0; els["m-attempts"].textContent = attempts.toLocaleString("ko-KR"); els["m-rate"].textContent = attempts ? `${Math.round(correct/attempts*100)}%` : "0%"; els["m-mastered"].textContent = Object.values(store.stats).filter((s) => s.streak >= 3).length; els["m-due"].textContent = dueCount();
    els["type-progress"].replaceChildren(...Object.entries({ cloze: bank.cloze, keyword: bank.keyword, essay: bank.essay }).map(([itemType, items]) => { const stats = items.map((item) => store.stats[keyFor(item,itemType)] || {attempts:0,correct:0}); const a=stats.reduce((n,s)=>n+s.attempts,0), c=stats.reduce((n,s)=>n+s.correct,0), rate=a?Math.round(c/a*100):0; const row=document.createElement("div"); row.className="bar-row"; row.innerHTML=`<span>${typeLabels[itemType]}</span><span class="bar"><i style="width:${rate}%"></i></span><strong>${rate}%</strong>`; return row; }));
    const weak = allEntries().map((entry) => ({...entry,stat:store.stats[keyFor(entry.item,entry.itemType)]||{wrong:0,correct:0}})).filter((x)=>x.stat.wrong>0).sort((a,b)=>(b.stat.wrong-b.stat.correct)-(a.stat.wrong-a.stat.correct)).slice(0,7); els["weak-list"].replaceChildren();
    if (!weak.length) { const li=document.createElement("li"); li.className="empty"; li.textContent="아직 오답이 없습니다. 핵심 우선 세션부터 시작하세요."; els["weak-list"].append(li); }
    else weak.forEach(({itemType,item,stat})=>{const li=document.createElement("li"); li.innerHTML=`<span><b>${item.topic}</b><small>${typeLabels[itemType]}</small></span><em>${stat.wrong}회</em>`; els["weak-list"].append(li);});
  }
  function registerWebMcp() {
    const context = document.modelContext; if (!context?.registerTool) return; const register=(tool)=>Promise.resolve(context.registerTool(tool)).catch(()=>{});
    register({name:"start_research_method_study",title:"연구방법론 학습 시작",description:"빈칸·키워드·서술형 중 하나의 연구방법론 종합시험 학습 세션을 시작합니다.",inputSchema:{type:"object",properties:{type:{type:"string",enum:["cloze","keyword","essay"]},mode:{type:"string",enum:["core","review","all"]},count:{type:"integer",enum:[10,20,30]}},required:["type","mode","count"],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||!typeLabels[input.type]||!modeLabels[input.mode]||![10,20,30].includes(input.count))throw new Error("학습 설정이 올바르지 않습니다.");type=input.type;mode=input.mode;els["question-count"].value=String(input.count);setType(type,false);return startSession();}});
    register({name:"read_research_method_progress",title:"연구방법론 학습 현황",description:"세 문제 유형의 누적 풀이·성공률·복습 대기 수를 읽습니다.",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute(){const a=store.totals.attempts||0;return{attempts:a,successPercent:a?Math.round((store.totals.correct||0)/a*100):0,mastered:Object.values(store.stats).filter((s)=>s.streak>=3).length,due:dueCount()};}});
  }

  document.querySelectorAll("[data-view]").forEach((button)=>button.addEventListener("click",()=>switchView(button.dataset.view)));
  document.querySelectorAll("[data-type]").forEach((button)=>button.addEventListener("click",()=>setType(button.dataset.type)));
  document.querySelectorAll(".mode").forEach((button)=>button.addEventListener("click",()=>{mode=button.dataset.mode;document.querySelectorAll(".mode").forEach((b)=>{const active=b===button;b.classList.toggle("is-selected",active);b.setAttribute("aria-checked",String(active));});}));
  document.querySelectorAll(".next").forEach((button)=>button.addEventListener("click",next)); document.querySelectorAll("[data-rating]").forEach((button)=>button.addEventListener("click",()=>rateEssay(button.dataset.rating)));
  document.querySelectorAll("[data-open-progress]").forEach((button)=>button.addEventListener("click",()=>switchView("progress")));
  els.restart.addEventListener("click",startSession); els.repeat.addEventListener("click",startSession); els["check-cloze"].addEventListener("click",()=>gradeCloze(false)); els["cloze-reveal"].addEventListener("click",()=>gradeCloze(true)); els["cloze-hint"].addEventListener("click",()=>{els["cloze-answer"].placeholder=current().hint;els["cloze-answer"].focus();});
  els["cloze-answer"].addEventListener("keydown",(event)=>{if(event.key!=="Enter")return;event.preventDefault();answered?next():gradeCloze(false);}); els["check-keyword"].addEventListener("click",gradeKeyword); els["reveal-essay"].addEventListener("click",revealEssay); els["essay-answer"].addEventListener("input",()=>{els["char-count"].textContent=`${els["essay-answer"].value.length}자`;});
  els.bookmark.addEventListener("click",()=>{const key=keyFor(current());store.bookmarks=store.bookmarks.includes(key)?store.bookmarks.filter((x)=>x!==key):[...store.bookmarks,key];persist();renderQuestion();});
  els["reset-progress"].addEventListener("click",()=>els["reset-dialog"].showModal()); els["reset-dialog"].addEventListener("close",()=>{if(els["reset-dialog"].returnValue!=="confirm")return;store={stats:{},totals:{attempts:0,correct:0,sessions:0},bookmarks:[]};persist();renderProgress();});

  els["count-cloze"].textContent=bank.cloze.length; els["count-keyword"].textContent=bank.keyword.length; els["count-essay"].textContent=bank.essay.length;
  updateSummaries(); startSession(); const initial=location.hash.replace("#",""); if(["progress","guide"].includes(initial))switchView(initial); registerWebMcp();
})();
