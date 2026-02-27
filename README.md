# 🎾 서울 테니스 예약 현황

서울시 공공서비스예약 API를 연동한 테니스 코트 예약 현황 대시보드입니다.

## 기능
- 🗺️ **지도뷰** — 서울 전체 테니스장 좌표 표시 (여유/임박/마감 색상 구분)
- 📅 **시간표뷰** — 날짜 × 시설 × 시간대 그리드, 빈 슬롯 한눈에 파악
- 🔍 시설명/구 검색 필터
- ⏰ 시간 범위 필터 (06시~21시 자유 설정)
- 실시간 예약 바로가기 링크

## 배포 방법 (Vercel + GitHub)

### 1. GitHub 저장소 생성
```bash
git init
git add .
git commit -m "첫 배포"
git remote add origin https://github.com/YOUR_NAME/seoul-tennis.git
git push -u origin main
```

### 2. Vercel 연동
1. [vercel.com](https://vercel.com) 접속 → GitHub으로 로그인
2. **"Add New Project"** → 방금 만든 저장소 선택
3. **"Deploy"** 클릭 → 자동 배포 완료!

### 3. 서울시 API 키 설정 (실시간 데이터)
Vercel 대시보드 → **Settings → Environment Variables** 에서 추가:

| Key | Value |
|-----|-------|
| `SEOUL_API_KEY` | 발급받은 인증키 |

> API 키 발급: [data.seoul.go.kr](https://data.seoul.go.kr) → 회원가입 → `ListPublicReservationSport` API 신청 (즉시 발급)

### 4. 재배포
환경변수 추가 후 Vercel 대시보드에서 **"Redeploy"** 클릭

## 로컬 실행
```bash
npx vercel dev
```

## 기술 스택
- Vanilla HTML/CSS/JS
- Leaflet.js (지도)
- Vercel Serverless Functions (API 프록시)
- 서울 열린데이터광장 OpenAPI
