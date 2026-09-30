# 나만의 학교 업무 To Do List ver1.02

기존 Google Apps Script / Google Sheets 버전을 Vite + Supabase 기반으로 다시 만든 프로젝트입니다. GitHub 저장소에 폴더 안의 파일들을 업로드하고 Vercel에 연결하면 휴대전화 브라우저에서 사용할 수 있습니다. **실제 Supabase 프로젝트와 계정이 없으면 앱의 로그인·저장은 작동하지 않습니다.**

## ver1.02 화면 변경

이전 Google Apps Script 앱의 흰 배경, 파란색 상단 탭, 요약 카드와 중요도 색 띠가 있는 업무 목록 디자인을 적용했습니다. 상단은 업무 보기 → 캘린더 → 업무 입력 순서입니다. 로그아웃 및 테마 버튼은 제목 오른쪽에 있습니다. 제목 옆 톱니바퀴 설정 버튼에서 CSV 가져오기와 JSON 백업·복원을 사용할 수 있습니다.

## ver1.02 변경

- 톱니바퀴 설정 화면에 업무 분야 편집과 백업 통합
- 분야 삭제 시 연결된 업무도 함께 삭제(확인 창 표시)
- 중요도 선택 순서: 높음, 보통, 낮음(기본 보통)
- 완료 업무의 되돌리기 옆에 삭제 버튼
- 날짜 필드 폭 수정, 시작일보다 이른 날짜를 마감일로 입력할 수 없도록 제한(같은 날·미정 허용)
- 업무 수정 화면을 자동 키보드 없이 표시
- 캘린더 좌우 스와이프 및 연도·월 직접 이동

기존 Supabase SQL을 다시 실행할 필요는 없습니다.

## 기능

- 이메일·비밀번호 회원가입 / 로그인 / 비밀번호 재설정
- 로그아웃 전까지 브라우저의 로그인 세션 보관과 토큰 자동 갱신
- 시작일, 마감일, 업무 분야, 중요도, 메모, 완료 여부 관리
- 검색, 상태·분야 필터, 정렬, 오늘 마감·기한 초과 요약
- 별도 월간 캘린더 화면과 날짜별 마감 업무 목록
- 기기 설정 연동 라이트·다크 모드와 직접 변경
- 모바일 홈 화면에 추가할 수 있는 웹 앱 메타데이터
- 기존 Google 시트 `업무`, `업무분야` CSV 가져오기, JSON 백업·복원

## 1. Supabase 준비

1. Supabase에서 프로젝트를 생성합니다.
2. **SQL Editor**에서 [`supabase/schema.sql`](supabase/schema.sql)의 전체 내용을 실행합니다. `todo_tasks`, `todo_categories`에 소유자 기반 Row Level Security가 적용됩니다.
3. **Authentication → Providers → Email**에서 Email 제공자가 활성화되어 있는지 확인합니다. 이메일 확인을 사용할 경우 **Authentication → URL Configuration**의 **Site URL**에 최종 Vercel 주소를 등록하고, 로컬 개발용 `http://localhost:5173/**`도 Redirect URLs에 추가하세요. 확인 메일을 쓰는 경우 메일 인증 뒤 로그인할 수 있습니다.
4. **Project Settings → API Keys**에서 프로젝트 URL과 **publishable key**를 복사합니다. **secret key / service_role key는 절대로 앱이나 GitHub에 넣지 마세요.**
5. 개인 계정으로 가입한 뒤 Supabase **Authentication** 설정에서 신규 회원가입을 비활성화하세요. 공개 회원가입 화면은 남지만 이후 가입 요청은 거부됩니다. 이 설정을 끄기 전까지는 주소를 아는 다른 사람도 별도 계정을 만들 수 있습니다. 각 계정의 데이터는 RLS로 분리됩니다.

## 2. 로컬에서 실행

Node.js가 설치된 컴퓨터에서 이 폴더를 열고 다음 명령을 실행합니다.

```bash
npm install
cp .env.example .env
```

`.env`의 값을 실제 프로젝트 정보로 바꿉니다.

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

```bash
npm run dev
```

표시된 `http://localhost:5173`으로 접속합니다. `.env`는 `.gitignore`에 포함되어 있습니다. `VITE_` 값은 브라우저에 포함되므로 publishable key만 사용합니다. 데이터 보안은 SQL의 RLS가 담당합니다.

## 3. GitHub + Vercel 배포

1. GitHub에 새 저장소를 만들고 이 폴더 안의 파일(`index.html`, `src.js`, `style.css`, `package.json`, `package-lock.json`, `public/`, `supabase/` 등)을 업로드합니다. ZIP 자체를 업로드하면 Vercel이 프로젝트로 실행하지 못합니다.
2. Vercel에서 **Add New → Project → Import Git Repository**로 저장소를 가져옵니다.
3. Framework Preset은 **Vite**, Build Command는 `npm run build`, Output Directory는 `dist`로 둡니다.
4. Vercel 프로젝트 **Settings → Environment Variables**에 `VITE_SUPABASE_URL`과 `VITE_SUPABASE_PUBLISHABLE_KEY`를 넣고 배포합니다. 변경한 변수는 다시 배포해야 적용됩니다.
5. 배포 주소를 Supabase **Authentication → URL Configuration → Site URL**에 넣습니다. 이메일 인증·비밀번호 재설정 리디렉션에 사용됩니다. 새 주소를 사용하면 Redirect URLs에도 등록하세요.
6. 배포 주소에서 회원가입 → 이메일 인증(활성화된 경우) → 로그인 → 신규 가입 차단 순으로 진행합니다.

## 4. 기존 Google 시트 데이터 옮기기

Google Sheets에서 기존 앱이 만든 스프레드시트를 엽니다. `업무분야` 탭을 선택해 **파일 → 다운로드 → 쉼표로 구분된 값(.csv)**으로 저장하고, `업무` 탭에서도 같은 작업을 합니다. 로그인한 새 앱의 **설정·백업**에서 `업무분야 CSV 가져오기`를 먼저, `업무 CSV 가져오기`를 다음에 실행합니다. `업무` 시트의 10개 열 이름(ID, 업무 제목, 세부 내용, 업무 분야, 중요도, 업무 시작일, 완료 여부, 마감일, 등록 시각, 수정 시각)이 필요합니다.

CSV를 다시 가져오면 같은 원본 ID는 중복 저장하지 않습니다. 원본에 ID가 비어 있을 경우 행 순서·제목·마감일을 조합해 중복을 판단하므로, 같은 내용을 다른 행 순서로 다시 가져오면 중복될 수 있습니다. 가져오기 도중 연결이 끊기면 이미 저장된 일부 행은 남을 수 있습니다. 같은 파일을 다시 선택하면 남은 행을 이어서 가져올 수 있습니다. 가져온 항목을 확인한 뒤 기존 Apps Script나 Google 시트를 정리하세요.

JSON 백업은 **설정·백업 → JSON 백업**에서 내려받고, 같은 화면에서 복원할 수 있습니다. 복원은 기존 항목을 삭제하지 않으며, 같은 ID가 있으면 중복을 건너뜁니다. 브라우저 안에는 업무 데이터를 저장하지 않으므로 인터넷이 끊긴 상태에서는 열람·편집할 수 없습니다.

## 휴대전화에서 사용

- iPhone Safari: 공유 → **홈 화면에 추가**.
- Android Chrome: 메뉴 → **홈 화면에 추가** 또는 **앱 설치**.

같은 휴대전화에서 동일한 앱 주소와 브라우저 저장소를 유지하면 로그인 세션이 보관·갱신됩니다. 로그아웃, 브라우저 데이터 삭제, Supabase 측 세션 무효화 또는 보안 설정에 따라 다시 로그인이 필요할 수 있습니다. 홈 화면 바로가기를 만든 뒤 원래 브라우저와 저장소가 분리되는 환경에서는 최초 1회 다시 로그인해야 할 수 있습니다.

## 구성

| 파일 | 역할 |
| --- | --- |
| `index.html`, `style.css`, `src.js` | 화면, 모바일 레이아웃, 앱 동작 |
| `supabase/schema.sql` | 테이블·접근 정책 |
| `public/manifest.webmanifest`, `public/icon.svg` | 홈 화면 아이콘 및 이름 |
| `.env.example` | 로컬 환경변수 예시 |

이 프로젝트는 알림 전송과 오프라인 수정을 포함하지 않습니다. 업무에 학생 개인정보를 입력한다면 학교의 보안·보존 지침도 확인하세요.
