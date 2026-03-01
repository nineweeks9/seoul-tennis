# 🎾 서울 테니스 예약 현황

서울시 공공서비스예약 API를 연동한 테니스 코트 예약 현황 대시보드입니다.

**🌐 배포 URL**: [seoul-tennis.vercel.app](https://seoul-tennis.vercel.app)

## 기능

### 핵심
* 🗺️ **지도뷰** — Leaflet 기반 서울 전체 테니스장 마커 표시 (상태별 색상 구분)
* 📋 **목록뷰** — 카드 그리드, 상태/요금/기간/대상/전화번호 정보 표시
* 🔍 시설명/구/장소 **통합 검색**
* ⭐ **즐겨찾기** (localStorage 저장)

### 실시간 데이터
* 🔌 서울 열린데이터광장 API 프록시 (Vercel Serverless)
* ♻️ **자동 재시도** (최대 2회) + 10초 타임아웃
* 🔄 **자동 갱신** 5분 주기 (ON/OFF 토글)
* 📢 **토스트 알림**으로 API 상태 피드백

### 필터 & 정렬
* 📊 **통계 칩** 클릭으로 상태 필터 (접수중/안내중/접수종료)
* 🏷️ 상태 필터 pills (목록뷰)
* 📍 자치구 드롭다운
* 🔃 **정렬 4종**: 상태순 / 이름순 / 접수마감 임박순 / 이용시작 빠른순
* 🔗 **URL 파라미터 공유** — 필터 상태가 URL에 저장 (링크 공유 가능)

### 상세 정보
* 🔥 **D-Day 뱃지** — 접수 마감까지 남은 일수 (D-3 이내 빨간색 강조)
* 📋 **상세 모달** — 이미지, 상세안내, 전화번호(tel:), 이용대상, 접수기간 등
* 📞 **전화번호 바로 연결** (모바일 탭)
* 🎹 **키보드 탐색** — ↑↓ 시설 이동, Enter로 상세 모달

## 배포 방법

### 1. GitHub 저장소에 push

```bash
git add .
git commit -m "v2: D-Day, 모달, 정렬, URL 공유, 재시도"
git push origin main
```

### 2. Vercel 자동 배포
GitHub에 push하면 Vercel이 자동으로 재배포합니다.

### 3. 서울시 API 키 설정
Vercel 대시보드 → **Settings → Environment Variables**:

| Key | Value |
|-----|-------|
| `SEOUL_API_KEY` | 발급받은 인증키 |

> API 키 발급: [data.seoul.go.kr](https://data.seoul.go.kr) → `ListPublicReservationSport` 신청

## 기술 스택

* Vanilla HTML/CSS/JS (단일 파일)
* Leaflet.js (지도)
* Vercel Serverless Functions (API 프록시, CORS 해결)
* 서울 열린데이터광장 OpenAPI
