const $ = (sel) => document.querySelector(sel);

const levelGroup = $("#levelGroup");
const sentenceEl = $("#sentence");
const wordInput = $("#wordInput");
const explainBtn = $("#explainBtn");
const resultEl = $("#result");

let selectedLevel = "mid";

function getWord() {
  return wordInput.value.trim();
}

function refreshState() {
  explainBtn.disabled = !(sentenceEl.value.trim() && getWord());
}

// 1. 학년 고르기
levelGroup.addEventListener("click", (e) => {
  const btn = e.target.closest(".level-btn");
  if (!btn) return;
  document.querySelectorAll(".level-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  selectedLevel = btn.dataset.level;
});

sentenceEl.addEventListener("input", refreshState);
wordInput.addEventListener("input", refreshState);
wordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !explainBtn.disabled) {
    e.preventDefault();
    explainBtn.click();
  }
});

// 2. 뜻 찾기 (네이버 검색 + Gemini 를 서버가 한 번에 처리)
explainBtn.addEventListener("click", async () => {
  const sentence = sentenceEl.value.trim();
  const word = getWord();
  if (!sentence || !word) return;

  resultEl.classList.remove("hidden");
  resultEl.innerHTML = `<div class="loading"><div class="spinner"></div>🧭 '${escapeHtml(
    word
  )}' 낱말을 탐험하는 중...</div>`;
  explainBtn.disabled = true;

  try {
    const res = await fetch("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sentence, word, level: selectedLevel }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "요청에 실패했어요.");
    renderResult(data);
  } catch (err) {
    resultEl.innerHTML = `<div class="error">⚠️ ${escapeHtml(err.message)}</div>`;
  } finally {
    refreshState();
  }
});

function renderResult(data) {
  const tipHtml = data.tip
    ? `<div class="result-block"><div class="r-label">💡 도움말</div><div class="r-body">${escapeHtml(
        data.tip
      )}</div></div>`
    : "";

  const refsHtml =
    data.references && data.references.length
      ? `<details class="refs">
           <summary>네이버 검색 참고자료 ${data.references.length}개 보기</summary>
           <ul>${data.references
             .map(
               (r) =>
                 `<li><a href="${escapeAttr(r.link)}" target="_blank" rel="noopener">${escapeHtml(
                   r.title
                 )}</a> — ${escapeHtml((r.description || "").slice(0, 80))}</li>`
             )
             .join("")}</ul>
         </details>`
      : "";

  resultEl.innerHTML = `
    <div class="result-title">🗺️ 탐험 결과</div>
    <h2>${escapeHtml(data.word)}</h2>
    <span class="level-tag">${escapeHtml(data.levelLabel)}</span>
    <div class="result-block">
      <div class="r-label">📘 뜻</div>
      <div class="r-body">${escapeHtml(data.meaning)}</div>
    </div>
    ${
      data.example
        ? `<div class="result-block"><div class="r-label">✏️ 예문</div><div class="r-body">${escapeHtml(
            data.example
          )}</div></div>`
        : ""
    }
    ${tipHtml}
    ${refsHtml}
  `;
}

function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function escapeAttr(s = "") {
  return escapeHtml(s).replace(/'/g, "&#39;");
}
