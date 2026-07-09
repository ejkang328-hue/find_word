# 📖 쉬운 단어 찾기

문장을 입력하고 그 안의 **모르는 낱말**을 고르면,
**네이버 검색 API**로 관련 자료를 찾고 **Google Gemini AI**가
**초등학교 1~2 / 3~4 / 5~6학년** 수준에 맞춰 뜻을 쉽게 풀어 설명해 주는 웹앱입니다.

---

## 🧩 동작 방식 (2단계)

**1단계 — 네이버로 찾기** (네이버 키만 있으면 동작)
1. 문장을 입력 → 낱말로 나눠 → 모르는 낱말을 클릭
2. **"네이버에서 찾기"** → 서버가 네이버 검색 API(백과사전→웹문서)로 결과를 가져와 그대로 보여줌

**2단계 — 이해가 안 되면 쉽게 바꾸기** (Gemini 키 필요)
3. 검색 결과가 어려우면, 학년(1~2 / 3~4 / 5~6)을 고르고 **"쉽게 바꾸기"** 클릭
4. 문장 + 낱말 + 검색 결과 + 학년을 Gemini에 전달 → 문맥에 맞는 쉬운 뜻·예문·도움말 생성

> API 키는 **서버(.env)** 에만 보관되어 브라우저에 노출되지 않습니다.
> Gemini 키가 없어도 **1단계(네이버 검색)** 는 바로 사용할 수 있습니다.

### API 엔드포인트
- `POST /api/search` — `{ word }` → 네이버 검색 결과 (Gemini 불필요)
- `POST /api/explain` — `{ sentence, word, level, references }` → 학년별 쉬운 설명 (Gemini 사용)

---

## 🔑 1단계: API 키 발급받기

### (A) 네이버 검색 API 키

1. https://developers.naver.com/apps/#/register 접속 (네이버 로그인)
2. **애플리케이션 이름** 입력 (예: 쉬운단어찾기)
3. **사용 API** 에서 **"검색"** 선택
4. **환경 추가** → **"WEB 설정"** 선택 후 웹 서비스 URL에 `http://localhost:3000` 입력
5. 등록하면 **Client ID** 와 **Client Secret** 이 발급됩니다. (하루 25,000회 무료)

### (B) Google Gemini API 키

1. https://aistudio.google.com/apikey 접속 (구글 로그인)
2. **"Create API key"** 클릭
3. 생성된 **API 키**를 복사합니다. (무료 사용 한도 있음)

---

## ⚙️ 2단계: 키 넣기

프로젝트 폴더의 `.env.example` 파일을 복사해 `.env` 파일을 만들고, 발급받은 키를 넣습니다.

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

그런 다음 `.env` 파일을 열어 값을 채웁니다:

```
NAVER_CLIENT_ID=발급받은_네이버_Client_ID
NAVER_CLIENT_SECRET=발급받은_네이버_Client_Secret
GEMINI_API_KEY=발급받은_Gemini_API_키
GEMINI_MODEL=gemini-2.5-flash
PORT=3000
```

---

## ▶️ 3단계: 실행

```powershell
npm install   # 최초 1회만
npm start
```

브라우저에서 **http://localhost:3000** 접속.

개발 중 자동 재시작이 필요하면 `npm run dev` 를 사용하세요.

---

## 📁 폴더 구조

```
20260709쉬운단어찾기/
├─ server.js          # Express 백엔드 (네이버 검색 + Gemini 호출)
├─ package.json
├─ .env.example       # 키 설정 예시 (복사해서 .env 로 사용)
├─ public/
│  ├─ index.html      # 화면
│  ├─ style.css       # 스타일
│  └─ app.js          # 프론트엔드 로직
└─ README.md
```

---

## ❓ 참고

- 네이버에는 "국어사전" 전용 오픈 API가 없어, **검색 API(백과사전→웹문서)** 로 참고자료를 모아 Gemini가 문맥에 맞게 정리하는 방식입니다.
- 더 정확한 사전 뜻풀이가 필요하면 [국립국어원 표준국어대사전 API](https://stdict.korean.go.kr/openapi/openApiInfo.do) 로 소스를 바꿀 수 있습니다.
- `GET /api/health` 로 키 설정 상태를 확인할 수 있습니다.
