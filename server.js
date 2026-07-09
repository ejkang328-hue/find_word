import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const {
  NAVER_CLIENT_ID,
  NAVER_CLIENT_SECRET,
  GEMINI_API_KEY,
  GEMINI_MODEL = "gemini-2.5-flash",
  PORT = 3000,
} = process.env;

// 학년 수준 라벨
const LEVELS = {
  low: { label: "초등학교 1~2학년", note: "아주 쉬운 낱말만 써서, 한 문장(15~25자)으로 아주 짧게." },
  mid: { label: "초등학교 3~4학년", note: "쉬운 낱말로, 한 문장(20~35자)으로 짧게." },
  high: { label: "초등학교 5~6학년", note: "정확하고 쉬운 낱말로, 한 문장(25~40자)으로 간결하게." },
};

// 키가 실제로 설정되었는지 (빈 값 / 예시 placeholder 제외)
function hasKey(v) {
  return Boolean(v && v.trim() && !v.startsWith("여기에"));
}

// HTML 태그(<b> 등) 및 엔티티 제거
function stripHtml(s = "") {
  return s
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

// 네이버 검색 API 호출 (백과사전 우선, 없으면 웹문서)
async function naverSearch(word) {
  if (!hasKey(NAVER_CLIENT_ID) || !hasKey(NAVER_CLIENT_SECRET)) {
    throw new Error("네이버 API 키가 설정되지 않았습니다. .env 파일을 확인하세요.");
  }

  const headers = {
    "X-Naver-Client-Id": NAVER_CLIENT_ID,
    "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
  };

  const endpoints = ["encyc", "webkr"]; // 백과사전 → 웹문서 순으로 시도
  for (const ep of endpoints) {
    const url = `https://openapi.naver.com/v1/search/${ep}.json?query=${encodeURIComponent(
      word
    )}&display=5&sort=sim`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      // 인증 오류 등은 즉시 표면화
      if (res.status === 401 || res.status === 403) {
        const body = await res.text();
        throw new Error(`네이버 API 인증 실패(${res.status}): ${body}`);
      }
      continue;
    }
    const data = await res.json();
    const items = (data.items || []).map((it) => ({
      title: stripHtml(it.title),
      description: stripHtml(it.description),
      link: it.link,
      source: ep,
    }));
    if (items.length > 0) return items;
  }
  return [];
}

// Gemini 호출: 문맥에 맞는 쉬운 설명 생성
async function geminiExplain({ sentence, word, level, references }) {
  if (!hasKey(GEMINI_API_KEY)) {
    throw new Error(
      "아직 Gemini(구글 AI) 키가 없어서 '쉽게 바꾸기'는 사용할 수 없어요. https://aistudio.google.com/apikey 에서 키를 발급받아 .env 파일의 GEMINI_API_KEY 에 넣어주세요. (네이버 검색은 그대로 사용할 수 있어요.)"
    );
  }

  const lv = LEVELS[level] || LEVELS.mid;
  const refText =
    references.length > 0
      ? references.map((r, i) => `[참고자료 ${i + 1}] ${r.title} : ${r.description}`).join("\n")
      : "(참고자료 없음 — 네가 아는 지식으로 설명해도 좋아.)";

  const prompt = `너는 초등학생에게 낱말을 쉽고 다정하게 알려주는 선생님이야.

아래 [문장]에서 '${word}'라는 낱말이 어떤 뜻으로 쓰였는지 설명해 줘.
반드시 [문장]의 문맥(앞뒤 내용)에 맞는 뜻을 골라야 해. 참고자료는 도움용일 뿐이고, 문맥과 다르면 무시해.
설명은 ${lv.label} 수준에 맞춰야 해: ${lv.note}

[문장]
${sentence}

[설명할 낱말]
${word}

[참고자료(네이버 검색 결과)]
${refText}

규칙:
- meaning: 이 문장에서 '${word}'가 뜻하는 바를 **딱 한 문장으로 아주 짧고 간단하게**. 아이가 공책에 그대로 옮겨 적을 수 있을 만큼 짧아야 해. 이야기하듯 길게 늘어놓지 말고, 핵심 뜻만!
- example: '${word}'를 넣어 만든 짧고 쉬운 예문 한 개.
- tip: 비슷한말 등 짧은 한 줄 도움말(없으면 빈 문자열).
- 모든 답은 한국어로, 어려운 한자어·전문용어는 피할 것.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.5,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            meaning: { type: "string" },
            example: { type: "string" },
            tip: { type: "string" },
          },
          required: ["meaning", "example"],
        },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API 오류(${res.status}): ${body}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  try {
    return JSON.parse(text);
  } catch {
    // JSON 파싱 실패 시 원문이라도 반환
    return { meaning: text || "설명을 생성하지 못했습니다.", example: "", tip: "" };
  }
}

// 1단계: 네이버 검색만 (Gemini 키 없이도 동작)
app.post("/api/search", async (req, res) => {
  try {
    const { word = "" } = req.body || {};
    if (!word.trim()) {
      return res.status(400).json({ error: "찾을 낱말을 골라 주세요." });
    }
    const references = await naverSearch(word.trim());
    res.json({ word: word.trim(), references });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "서버 오류가 발생했습니다." });
  }
});

// 2단계: 학년에 맞게 쉽게 바꾸기 (Gemini 사용)
app.post("/api/explain", async (req, res) => {
  try {
    const { sentence = "", word = "", level = "mid", references } = req.body || {};
    if (!sentence.trim() || !word.trim()) {
      return res.status(400).json({ error: "문장과 단어를 모두 입력해 주세요." });
    }

    // 프론트에서 이미 받은 검색 결과가 있으면 재사용, 없으면 다시 검색
    const refs = Array.isArray(references) ? references : await naverSearch(word.trim());
    const result = await geminiExplain({
      sentence: sentence.trim(),
      word: word.trim(),
      level,
      references: refs,
    });

    res.json({
      word: word.trim(),
      levelLabel: (LEVELS[level] || LEVELS.mid).label,
      ...result,
      references: refs,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "서버 오류가 발생했습니다." });
  }
});

// 키 설정 상태 확인용 (선택)
app.get("/api/health", (req, res) => {
  res.json({
    naver: hasKey(NAVER_CLIENT_ID) && hasKey(NAVER_CLIENT_SECRET),
    gemini: hasKey(GEMINI_API_KEY),
    model: GEMINI_MODEL,
  });
});

// Vercel(서버리스)에서는 app.listen 없이 앱을 export 해서 실행합니다.
// 로컬(내 컴퓨터)에서 실행할 때만 서버를 직접 띄웁니다.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n✅ 쉬운 단어 찾기 서버 실행 중 → http://localhost:${PORT}\n`);
    if (!hasKey(NAVER_CLIENT_ID) || !hasKey(NAVER_CLIENT_SECRET)) {
      console.log("⚠️  네이버 API 키가 없습니다. .env 파일에 NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 를 넣어주세요.");
    } else {
      console.log("✔  네이버 검색 사용 가능");
    }
    if (!hasKey(GEMINI_API_KEY)) {
      console.log("ℹ️  Gemini 키가 아직 없어 '쉽게 바꾸기'는 비활성화 상태입니다. (네이버 검색은 사용 가능)");
    } else {
      console.log("✔  Gemini(쉽게 바꾸기) 사용 가능");
    }
  });
}

// Vercel 서버리스 함수용 export
export default app;
