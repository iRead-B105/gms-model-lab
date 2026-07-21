import type { ModelInfo } from "@/lib/types";

export const KNOWN_IMAGE_MODELS: ModelInfo[] = [
  { id: "gpt-image-2", provider: "openai", label: "GPT Image 2", listedCredit: 3000, description: "정교한 묘사와 실사에 가까운 하이퍼 리얼리즘 이미지 생성" },
  { id: "gpt-image-1.5", provider: "openai", label: "GPT Image 1.5", listedCredit: 2000, description: "향상된 지침 준수와 프롬프트 반영 기능을 갖춘 이미지 생성 모델" },
  { id: "gpt-image-1", provider: "openai", label: "GPT Image 1", listedCredit: 2500, description: "텍스트와 이미지 입력을 지원하는 네이티브 멀티모달 이미지 모델" },
  { id: "gpt-image-1-mini", provider: "openai", label: "GPT Image 1 mini", listedCredit: 520, description: "GPT Image 1의 비용 절감형 네이티브 멀티모달 이미지 모델" },
  { id: "gemini-2.5-flash-image", provider: "gemini", label: "Gemini 2.5 Flash Image", listedCredit: 400, description: "텍스트·이미지 또는 두 입력의 조합으로 이미지를 생성하는 Google 모델" },
];

export const KNOWN_TEXT_MODELS: ModelInfo[] = [
  { id: "gpt-5.5", provider: "openai", label: "GPT-5.5", listedCredit: 90, description: "초정밀 추론과 초대형 컨텍스트 처리를 지원하는 차세대 텍스트 모델" },
  { id: "gpt-5.5-pro", provider: "openai", label: "GPT-5.5 pro", listedCredit: 540, description: "최상위 코딩·데이터 사이언스 작업에 최적화된 고성능 Responses API 모델" },
  { id: "gpt-5.4", provider: "openai", label: "GPT-5.4", listedCredit: 45, description: "향상된 추론 속도와 대형 컨텍스트를 지원하는 범용 플래그십 모델" },
  { id: "gpt-5.4-pro", provider: "openai", label: "GPT-5.4 pro", listedCredit: 540, description: "대규모 코드베이스와 전문 분석을 위한 최상급 Responses API 모델" },
  { id: "gpt-5.4-mini", provider: "openai", label: "GPT-5.4 mini", listedCredit: 14, description: "지능·속도·비용 효율을 균형 있게 갖춘 경량 모델" },
  { id: "gpt-5.4-nano", provider: "openai", label: "GPT-5.4 nano", listedCredit: 4, description: "모바일·단순 반복 작업을 위한 초경량 초고속 모델" },
  { id: "gpt-5.2", provider: "openai", label: "GPT-5.2", listedCredit: 20, description: "코드 집약적이고 여러 단계를 거치는 에이전트 작업용 모델" },
  { id: "gpt-5.2-pro", provider: "openai", label: "GPT-5.2 pro", listedCredit: 240, description: "더 깊은 사고가 필요한 고난도 문제에 적합한 전문 모델" },
  { id: "gpt-5.1", provider: "openai", label: "GPT-5.1", listedCredit: 20, description: "추론 강도를 조절할 수 있는 코딩·에이전트 작업용 모델" },
  { id: "gpt-5", provider: "openai", label: "GPT-5", listedCredit: 20, description: "복잡한 문제 해결과 대규모 컨텍스트 처리를 지원하는 모델" },
  { id: "gpt-5-mini", provider: "openai", label: "GPT-5 mini", listedCredit: 5, description: "지능·속도·비용을 균형 있게 조율한 범용 경량 모델" },
  { id: "gpt-5-nano", provider: "openai", label: "GPT-5 nano", listedCredit: 1, description: "대규모 배치와 실시간 UI를 위한 초경량 모델" },
  { id: "gpt-4.1", provider: "openai", label: "GPT-4.1", listedCredit: 16, description: "긴 컨텍스트와 높은 안정성을 갖춘 고급 텍스트 모델" },
  { id: "gpt-4.1-mini", provider: "openai", label: "GPT-4.1 mini", listedCredit: 4, description: "챗봇과 프로토타이핑에 적합한 비용 효율적 경량 모델" },
  { id: "gpt-4.1-nano", provider: "openai", label: "GPT-4.1 nano", listedCredit: 1, description: "빠른 응답과 낮은 비용을 제공하는 초경량 모델" },
  { id: "gpt-4o", provider: "openai", label: "GPT-4o", listedCredit: 20, description: "텍스트·이미지·오디오 입력을 지원하는 멀티모달 모델" },
  { id: "gpt-4o-mini", provider: "openai", label: "GPT-4o mini", listedCredit: 2, description: "텍스트·이미지 입력과 구조화 출력을 지원하는 경제적 멀티모달 모델" },
  { id: "o3-mini", provider: "openai", label: "o3-mini", listedCredit: 10, description: "구조화 출력과 함수 호출을 지원하는 소형 추론 모델" },
  { id: "gemini-3.5-flash", provider: "gemini", label: "Gemini 3.5 Flash", listedCredit: 18, description: "고속 Thinking과 대형 컨텍스트를 지원하는 고성능 멀티모달 모델" },
  { id: "gemini-2.5-pro", provider: "gemini", label: "Gemini 2.5 Pro", listedCredit: 30, description: "코드·수학·STEM과 대규모 문서 분석에 강한 모델" },
  { id: "gemini-2.5-flash", provider: "gemini", label: "Gemini 2.5 Flash", listedCredit: 30, description: "Thinking과 멀티모달 입력을 지원하는 빠르고 효율적인 모델" },
  { id: "gemini-2.5-flash-lite", provider: "gemini", label: "Gemini 2.5 Flash Lite", listedCredit: 1, description: "대량 작업과 실시간 서비스에 적합한 초경량 모델" },
  { id: "claude-opus-4-8", provider: "anthropic", label: "Claude Opus 4.8", listedCredit: 50, description: "전략 분석·정밀 논리·학술 연구를 위한 최신 최고 사양 모델" },
  { id: "claude-opus-4-7", provider: "anthropic", label: "Claude Opus 4.7", listedCredit: 50, description: "복잡한 전략 분석과 프로그래밍을 위한 최고 사양 모델" },
  { id: "claude-opus-4-6", provider: "anthropic", label: "Claude Opus 4.6", listedCredit: 50, description: "고난도 분석과 종합 문제 해결에 강한 최고 사양 모델" },
  { id: "claude-sonnet-4-6", provider: "anthropic", label: "Claude Sonnet 4.6", listedCredit: 30, description: "속도와 지능의 균형이 뛰어난 고성능 멀티모달 모델" },
  { id: "claude-sonnet-4-5-20250929", provider: "anthropic", label: "Claude Sonnet 4.5", listedCredit: 30, description: "복잡한 에이전트와 코딩 작업을 위한 고성능 모델" },
  { id: "claude-haiku-4-5-20251001", provider: "anthropic", label: "Claude Haiku 4.5", listedCredit: 10, description: "높은 지능과 빠른 응답을 결합한 경량 모델" },
  { id: "claude-opus-4-5-20251101", provider: "anthropic", label: "Claude Opus 4.5", listedCredit: 50, description: "최대 지능과 실용적 성능을 결합한 프리미엄 모델" },
  { id: "claude-opus-4-1-20250805", provider: "anthropic", label: "Claude Opus 4.1", listedCredit: 30, description: "200K 컨텍스트와 멀티모달 입력을 지원하는 추론·코딩 모델" },
];

export const KNOWN_TTS_MODELS: ModelInfo[] = [
  { id: "gpt-4o-mini-tts", provider: "openai", label: "GPT-4o mini TTS", listedCredit: 20, description: "입력 텍스트를 자연스러운 음성으로 변환하는 OpenAI 고속 음성 합성 모델" },
];
