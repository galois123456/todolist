# 나만의 To Do List · 공통 Supabase ver1.43

이메일·비밀번호 로그인과 Supabase 저장을 사용하는 Vite 앱입니다. Google 로그인 버전이 아닙니다.

## 기존 ver1.42에서 업데이트

1. 열려 있는 앱에서 메모 저장을 마친 뒤 모든 기기의 앱을 닫습니다.
2. 기존 Supabase 프로젝트 SQL Editor에서 **supabase/현재버전_추가.sql**을 실행합니다.
3. ZIP의 내부 파일·폴더를 기존 GitHub 프로젝트에 덮어 올리고 Vercel에 배포합니다. index.html만 교체하지 마세요.
4. 기존 환경변수를 유지하고, 배포 완료 후 모든 기기에서 새로고침합니다.

자세한 변경점·주의사항·검증 결과는 **ver1.43_업데이트안내.md**에 있습니다.

## 신규 설치

- Supabase 프로젝트에 **이전버전_통합.sql → 현재버전_추가.sql** 순서로 실행합니다.
- Email 인증을 사용합니다. 프로젝트의 인증 URL 설정에는 실제 배포 주소를 사용합니다.
- Vercel 환경변수:
  - `VITE_SUPABASE_URL`: Supabase 프로젝트 URL
  - `VITE_SUPABASE_PUBLISHABLE_KEY`: 공개 publishable key
  - `DATA_GO_KR_SERVICE_KEY`: 공휴일 API 일반 인증키(Decoding), 서버 전용
- secret key나 service_role key를 GitHub 또는 VITE_ 환경변수에 넣지 마세요.
- Vercel은 Vite 빌드 `npm run build`, 출력 폴더 `dist`를 사용합니다. 루트의 api 폴더도 함께 올립니다.
- 기존 프로젝트에서 사용 중이면 새 Supabase 프로젝트를 만들 필요가 없습니다.

## 주요 기능

- 일정 목록·캘린더·입력, PC 3분할/모바일 화면 전환
- 분야·상태·마감 범위 필터, 정렬, 일정과 시간표 세부사항 전체 보기
- 음력·매년 반복 일정, 공휴일, 링크·사진, 공유 복사
- 여러 시간표, 교시별 기본 내용과 날짜별 세부사항
- 여러 메모함, 자동 저장 포스트잇, 색상·확대·이동·삭제
- 사용자별 필터·테마 저장, 서버 저장 상태 및 성공 시각 표시

메모함을 삭제하면 그 안의 메모도 영구 삭제됩니다. 확인창에서 삭제 범위를 꼭 확인하세요.
기존 숨김 메모는 ‘숨김 메모함’이라는 일반 메모함에 보존되며, 별도 비밀번호로 보호되는 것은 아닙니다.
앱의 일정 JSON 백업은 메모함·메모·시간표 전체 백업 기능이 아닙니다.

## 로컬 확인

Node.js 환경에서 `npm ci`를 실행한 뒤 .env.example을 .env로 복사하고 프로젝트 값을 입력하세요.

- `npm run dev`: 개발 화면
- `npm test`: 자동 회귀 테스트
- `npm run build`: 배포 빌드

Vite 개발 서버만으로는 Vercel의 api/holidays 서버 기능이 실행되지 않습니다.
이 패키지는 실제 서버 SQL 실행, 배포, 데이터 삭제를 자동으로 수행하지 않습니다.
