# 서울 테니스 예약현황 - 작업 일지

## 프로젝트 개요
- **URL**: https://seoul-tennis.vercel.app
- **GitHub**: https://github.com/nineweeks9/seoul-tennis
- **스택**: Vercel Serverless (Node.js) + Vanilla JS + Leaflet 지도
- **데이터**: 서울시 열린데이터광장 API (`ListPublicReservationSport`)

---

## 배포 기록

| 날짜 | 커밋 | 내용 |
|------|------|------|
| 2026-04-29 | `329a4e7` | fix: seoul API http로 수정 (https → http) — API 응답 안 오던 핵심 버그 수정 |
| 2026-04-30 | `2801fca` | fix: 모바일 반응형 CSS 복구 (safe-area, bottom sheet, 터치 영역) |
| 2026-04-30 | `d4c12a6` | feat: 구글맵 길찾기 추가 (집 주소 설정, 모달/지도패널 버튼) |
| 2026-04-30 | `6fde5fb` | feat: 마이페이지 복원 (즐겨찾기·키워드·집주소), 구글맵 길찾기 통합 |

---

## 작업 내역

### 2026-04-29~30

#### 버그 수정
- `api/seoul.js`: `require('https')` → `require('http')` + URL도 `http://` 로 수정
  - **원인**: 서울시 API 서버(openapi.seoul.go.kr:8088)가 HTTP만 지원하는데 HTTPS로 요청해서 EPROTO 오류 발생
  - **증상**: 홈페이지 목록/상태가 실제와 다르게 표시되거나 로드 안 됨

#### 즐겨찾기(favs) KV 저장 수정
- `api/favs.js`: `kvSet` POST body 방식 → URL path 인코딩 방식으로 변경
  - **원인**: Upstash Redis REST API는 `/set/key/value` URL 방식을 사용해야 하는데 body로 보내고 있었음
  - `kvGet` 결과 문자열 JSON.parse 처리 추가

#### 마이페이지 복원
- 충돌 해결 과정에서 날아간 마이페이지 기능 복원
  - 👤 버튼 → 마이페이지 탭으로 이동 (로그아웃 confirm 제거)
  - 마이페이지 구성: 집 주소 + 알림 키워드 + 즐겨찾기 목록
  - 즐겨찾기 탭 제거 (마이페이지로 통합)

#### 길찾기 기능 재구현
- 기존 카카오맵 방식 → 구글맵으로 교체
  - **이유**: 카카오맵 URL(`map.kakao.com/?sName=...`) 빈 화면 이슈
  - 집 주소 있을 때: `google.com/maps/dir/집주소/목적지좌표`
  - 집 주소 없을 때: `google.com/maps/dir/?destination=목적지좌표`
  - 버튼 위치: 지도 패널 + 상세 모달

#### 모바일 반응형 CSS 복구
- safe-area 지원 (iPhone 홈바)
- 모달 하단 시트 스타일 (모바일)
- 터치 버튼 최소 크기 44px
- 필터 pills 가로 스크롤

---

## 현재 API 구조

```
api/
├── seoul.js      — 서울시 공공예약 API 프록시 (HTTP)
├── favs.js       — 즐겨찾기 저장/조회 (Upstash Redis KV)
├── home.js       — 집 주소 저장/조회 (Upstash Redis + T-map 좌표변환)
├── keywords.js   — 알림 키워드 관리 (Upstash Redis)
├── auth.js       — 인증
├── chatid.js     — 텔레그램 채팅 ID
├── check-status.js — 상태 체크 (알림용)
└── test-notify.js  — 알림 테스트
```

### 환경 변수
| Key | 용도 |
|-----|------|
| `SEOUL_API_KEY` | 서울 열린데이터광장 API 키 |
| `KV_REST_API_URL` | Upstash Redis URL (favs) |
| `KV_REST_API_TOKEN` | Upstash Redis Token (favs) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis URL (home, keywords) |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis Token (home, keywords) |
| `TMAP_API_KEY` | T-map 좌표변환 (home.js) |

---

## 미해결 / TODO

### 즉시
- [ ] 마이페이지 집 주소 저장이 localStorage 기반 → 서버(KV) 저장 연동 확인 필요
- [ ] `home.js` 환경변수 키 이름이 `favs.js`와 다름 (`UPSTASH_REDIS_REST_*` vs `KV_REST_API_*`) — 통일 필요

### 다음 작업
- [ ] **네이버 예약 구장 통합** (아래 섹션 참조)

---

## 네이버 예약 통합 계획 (조사 중)

### 배경
- 서울시 공공예약 API 외에 네이버 예약으로 운영되는 테니스장도 있음
- 네이버 지도에서 예약 슬롯이 보이는 형태
- 예시 장소: Place ID `18754970`

### 조사 결과
- 네이버 공식 예약 API는 비공개 (비즈니스 파트너만)
- 네이버 예약 URL 패턴: `https://booking.naver.com/booking/5/bizes/{BIZ_ID}/items/{ITEM_ID}`
- 슬롯 데이터는 JS 렌더링 기반 → 스크래핑 필요
- Puppeteer로 네트워크 요청 패턴 분석 진행 중

### API 역공학 조사 결과 (2026-04-30)

#### 시도한 방법
| 방법 | 결과 |
|------|------|
| `map.naver.com/p/api/place/summary/{placeId}` | ✅ 기본 정보(이름, 좌표, booking:true) 반환. bizId 없음 |
| `booking.naver.com/api/v5/bizes?placeId=...` | ❌ 302 리디렉션 → 로그인 필요 |
| `pcmap.place.naver.com/place/{id}/ticket` HTML | ⚠️ 6KB shell HTML만 반환. APOLLO_STATE에 ticket 데이터 없음 (JS 로드 후 동적 렌더링) |
| pcmap.all.js 번들 분석 | ✅ 라우팅 패턴 확인: `/booking/{type}/bizes/{bizId}/items/{bizItemId}` |
| booking.naver.com main.js 분석 | ✅ 프론트엔드 라우팅만 확인, 백엔드 API 엔드포인트 미발견 |
| GraphQL 직접 호출 | ❌ 인증 없이 접근 불가 |
| Puppeteer evaluate | ❌ iframe 구조로 실패 |

#### 발견한 정보
- **Place Summary API**: `https://map.naver.com/p/api/place/summary/{placeId}` — 공개, 인증 불필요
  - 응답: 이름, 좌표, 카테고리, `"booking": true/false` 여부
- **Booking URL 패턴**: `https://booking.naver.com/booking/5/bizes/{bizId}/items/{bizItemId}`
  - businessType 5 = 체육시설/레저
  - bizId, bizItemId는 placeId와 별도 관리, 공개 API 미노출
- **Ticket 탭 데이터**: JS 동적 로딩 (SSR 없음) — Puppeteer 필수

#### 다음에 시도할 방법
1. **Puppeteer 네트워크 인터셉터**: 브라우저로 ticket 탭 로드하면서 실제 API 요청 URL 캡처
   - `page.on('response', ...)` 방식으로 모든 네트워크 응답 모니터링
2. **Chrome DevTools 수동 분석**: 직접 브라우저에서 Network 탭 확인 요청
3. **대안 접근**: bizId 없이도 `map.naver.com/p/api/place/summary` 기반으로
   - 네이버 예약 있는 구장 목록 + 예약 링크만 제공하는 방식

### 예상 작업
1. Puppeteer 서버사이드로 ticket 탭 네트워크 요청 캡처
2. bizId/bizItemId 획득 후 슬롯 데이터 구조 파악
3. Vercel serverless에서 스크래핑 또는 API 호출 구현
4. 서울시 데이터 + 네이버 데이터 통합 렌더링
