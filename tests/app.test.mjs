import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("인증 키를 로컬 로그에서 제거하고 오류 메시지에서도 마스킹한다", async () => {
  const [imageGeneration, textGeneration, speechGeneration, store, common, keyStorage, page] = await Promise.all([
    source("lib/server/gms/image-generation.ts"),
    source("lib/server/gms/text-generation.ts"),
    source("lib/server/gms/speech-generation.ts"),
    source("lib/server/storage/run-store.ts"),
    source("lib/server/gms/common.ts"),
    source("features/model-lab/key-storage.ts"),
    source("app/page.tsx"),
  ]);

  assert.doesNotMatch(imageGeneration, /key:\s*request\.key/);
  assert.doesNotMatch(textGeneration, /key:\s*request\.key/);
  assert.doesNotMatch(speechGeneration, /key:\s*request\.key/);
  assert.match(store, /SENSITIVE_FIELD/);
  assert.match(store, /\[REDACTED\]/);
  assert.match(common, /safeError/);
  assert.match(common, /secrets\.filter\(Boolean\)/);
  assert.match(keyStorage, /gms-model-lab:gms-key:v1/);
  assert.match(keyStorage, /window\.localStorage/);
  assert.match(keyStorage, /removeItem/);
  assert.doesNotMatch(page, /localStorage\.setItem/);
  assert.doesNotMatch(`${imageGeneration}${textGeneration}${speechGeneration}${store}${common}`, /localStorage|sessionStorage/);
});

test("키 저장은 명시적인 화면 동작으로만 수행하고 보안 안내를 표시한다", async () => {
  const page = await source("app/page.tsx");
  assert.match(page, /이 브라우저에 키 저장/);
  assert.match(page, /저장 키 삭제/);
  assert.match(page, /암호화되지 않은 로컬 저장소/);
  assert.match(page, /saveKeyLocally/);
  assert.match(page, /deleteStoredKey/);
});

test("이미지·텍스트·TTS 모델 카탈로그와 공급자 API를 지원한다", async () => {
  const [catalog, imageGeneration, textGeneration, speechGeneration, models, page] = await Promise.all([
    source("lib/model-catalog.ts"),
    source("lib/server/gms/image-generation.ts"),
    source("lib/server/gms/text-generation.ts"),
    source("lib/server/gms/speech-generation.ts"),
    source("lib/server/gms/models.ts"),
    source("app/page.tsx"),
  ]);

  assert.match(catalog, /gpt-image-2/);
  assert.match(catalog, /gpt-image-1\.5/);
  assert.match(catalog, /gemini-2\.5-flash-image/);
  assert.match(catalog, /gpt-5\.5-pro/);
  assert.match(catalog, /gemini-3\.5-flash/);
  assert.match(catalog, /claude-opus-4-8/);
  assert.match(catalog, /gpt-4o-mini-tts/);
  assert.match(catalog, /listedCredit:\s*3000/);
  assert.match(imageGeneration, /images\/generations/);
  assert.match(imageGeneration, /:generateContent/);
  assert.match(textGeneration, /response\.output_text\.delta/);
  assert.match(textGeneration, /content_block_delta/);
  assert.match(textGeneration, /streamGenerateContent/);
  assert.match(speechGeneration, /audio\/speech/);
  assert.match(speechGeneration, /response_format/);
  assert.match(speechGeneration, /timeToFirstByteMs/);
  assert.match(models, /Promise\.allSettled/);
  assert.match(models, /supportedGenerationMethods/);
  assert.match(models, /anthropic/);
  assert.match(models, /ttsModels/);
  assert.doesNotMatch(page, /Claude로 프롬프트 보정/);
  assert.doesNotMatch(imageGeneration, /enhancePrompt|enhancer|anthropicBase/);
  assert.doesNotMatch(textGeneration, /enhancer/);
  assert.match(page, /mode === "tts" \? "TTS"/);
});

test("전체 텍스트 모델을 검색하고 누락된 모델 ID를 직접 추가할 수 있다", async () => {
  const selector = await source("features/model-lab/components/model-selector.tsx");
  assert.match(selector, /모델 ID 또는 공급자 검색/);
  assert.match(selector, /PROVIDERS\.map/);
  assert.match(selector, /목록에 없는 텍스트 모델 추가/);
  assert.match(selector, /직접 추가한 GMS 텍스트 모델/);
  assert.match(selector, /MODEL_ID_PATTERN/);
});

test("요청 크기·파라미터 범위·시간 초과를 제한한다", async () => {
  const [validation, common, textGeneration, speechGeneration, sizing, page, imageGeneration] = await Promise.all([
    source("lib/server/validation.ts"),
    source("lib/server/gms/common.ts"),
    source("lib/server/gms/text-generation.ts"),
    source("lib/server/gms/speech-generation.ts"),
    source("lib/image-sizing.ts"),
    source("app/page.tsx"),
    source("lib/server/gms/image-generation.ts"),
  ]);

  assert.match(validation, /256 \* 1024/);
  assert.match(validation, /32_000/);
  assert.match(validation, /이미지 수.*1, 4/);
  assert.match(common, /AbortSignal\.timeout/);
  assert.match(common, /300_000/);
  assert.match(textGeneration, /MAX_SSE_FRAME_BYTES/);
  assert.match(textGeneration, /MAX_OUTPUT_CHARACTERS/);
  assert.match(validation, /합성할 텍스트.*8_000/);
  assert.match(validation, /0\.25, 4/);
  assert.match(speechGeneration, /MAX_AUDIO_BYTES/);
  assert.match(sizing, /3840x2160/);
  assert.match(sizing, /2160x3840/);
  assert.match(sizing, /1344x768/);
  assert.match(sizing, /SNS 피드/);
  assert.match(validation, /getImageSizePresets/);
  assert.match(page, /이미지 비율/);
  assert.match(page, /출력 크기/);
  assert.match(imageGeneration, /name !== "aspectRatio"/);
});

test("이미지 대신 프롬프트 텍스트를 요구하는 지시와 Gemini NO_IMAGE를 구체적으로 안내한다", async () => {
  const [intent, imageGeneration, route, page] = await Promise.all([
    import(new URL("../lib/prompt-intent.ts", import.meta.url)),
    source("lib/server/gms/image-generation.ts"),
    source("app/api/generate/route.ts"),
    source("app/page.tsx"),
  ]);

  assert.equal(intent.looksLikePromptAuthoringInstruction("이미지 생성 프롬프트를 설계하세요. 최종 응답에는 완성된 프롬프트만 출력하세요."), true);
  assert.equal(intent.looksLikePromptAuthoringInstruction("부드러운 파스텔 그림책 스타일로 작은 생쥐를 그려주세요."), false);
  assert.match(imageGeneration, /NO_IMAGE/);
  assert.match(imageGeneration, /텍스트 탭에서 프롬프트를 먼저 만든 뒤/);
  assert.match(route, /errorCode === "NO_IMAGE" \? 422/);
  assert.match(page, /NO_IMAGE 가능성이 높은 지시/);
  assert.match(page, /window\.confirm/);
});

test("GPT Image 2 비율별 프리셋이 API 크기 제약을 만족한다", async () => {
  const sizing = await import(new URL("../lib/image-sizing.ts", import.meta.url));
  for (const ratio of sizing.IMAGE_ASPECT_RATIOS) {
    const [ratioWidth, ratioHeight] = ratio.split(":").map(Number);
    const presets = sizing.getImageSizePresets("openai", "gpt-image-2", ratio);
    assert.ok(presets.length >= 1);
    for (const preset of presets) {
      const [width, height] = preset.value.split("x").map(Number);
      assert.equal(width % 16, 0);
      assert.equal(height % 16, 0);
      assert.ok(Math.max(width, height) <= 3840);
      assert.ok(width * height >= 655_360 && width * height <= 8_294_400);
      assert.ok(Math.abs(width / height - ratioWidth / ratioHeight) < 0.01);
    }
  }
  assert.equal(sizing.getImageSizePresets("gemini", "gemini-2.5-flash-image", "9:16")[0].value, "768x1344");
  assert.equal(sizing.getImageSizePresets("openai", "gpt-image-2", "auto")[0].value, "auto");
  assert.equal(sizing.getImageAspectRatios("gemini", "gemini-2.5-flash-image")[0], "auto");
});

test("모델 공급자 기본값을 자동 적용하고 자동 옵션은 API 요청에서 생략한다", async () => {
  const [defaults, page, validation, imageGeneration, textGeneration] = await Promise.all([
    import(new URL("../lib/model-defaults.ts", import.meta.url)),
    source("app/page.tsx"),
    source("lib/server/validation.ts"),
    source("lib/server/gms/image-generation.ts"),
    source("lib/server/gms/text-generation.ts"),
  ]);

  assert.equal(defaults.getImageParameterDefaults("openai", "gpt-image-2").size, "auto");
  assert.equal(defaults.getTextParameterDefaults("openai", "gpt-4.1").temperature, undefined);
  assert.equal(defaults.getTextParameterDefaults("gemini", "gemini-2.5-flash").maxTokens, undefined);
  assert.equal(defaults.getTextParameterDefaults("anthropic", "claude-opus-4-1-20250805").maxTokens, 1024);
  assert.match(page, /selectModel/);
  assert.match(page, /공급자 기본값으로 복원/);
  assert.match(page, /DefaultableRange/);
  assert.match(validation, /provider === "anthropic" \? 1024 : undefined/);
  assert.match(imageGeneration, /aspectRatio !== "auto"/);
  assert.match(textGeneration, /maxTokens !== undefined/);
  assert.match(textGeneration, /temperature !== undefined/);
  assert.match(textGeneration, /Object\.keys\(generationConfig\)\.length/);
});

test("자동 옵션의 실제 API 처리 방식을 표시하고 좁은 옵션 카드에서 내용을 자르지 않는다", async () => {
  const [page, controls, summary] = await Promise.all([
    source("app/page.tsx"),
    source("features/model-lab/components/parameter-control.tsx"),
    source("features/model-lab/components/request-value-summary.tsx"),
  ]);

  assert.match(controls, /자동 \(전송 안 함\)/);
  assert.match(controls, /API 요청에서 생략/);
  assert.match(controls, /선택 모델의 기본값 사용/);
  assert.match(summary, /현재 API 전달값/);
  assert.match(summary, /break-all/);
  assert.match(summary, /break-words/);
  assert.match(page, /RequestValueSummary rows=\{requestValueRows\(\)\}/);
  assert.match(page, /grid min-w-0 grid-cols-1 gap-4/);
  assert.match(page, /auto를 전달해 모델이 출력 크기를 선택/);
  assert.match(page, /OpenAI 요청에는 별도 비율 필드를 보내지 않고 size로 제어/);
  assert.match(page, /선택 모델의 공급자 기본값을 사용/);
});

test("모델 테스트 지표는 성공 요청의 P50·P95와 단위당 비용을 계산한다", async () => {
  const metrics = await import(new URL("../features/model-lab/metrics.ts", import.meta.url));
  const success = (totalMs, apiMs, ttftMs, tokensPerSecond, estimatedCredit, imageCount = 0) => ({
    status: "success",
    timings: { totalMs, apiMs },
    textMetrics: { ttftMs, tokensPerSecond },
    usage: { outputTokens: tokensPerSecond, estimatedCredit },
    images: Array.from({ length: imageCount }, () => ({})),
  });
  const failed = { status: "error", timings: { totalMs: 999, apiMs: 999 }, usage: {}, images: [] };

  const text = metrics.calculateBenchmarkStats([
    success(100, 80, 20, 10, 1),
    success(300, 200, 40, 30, 2),
    failed,
  ], "text");
  assert.equal(text.totalLatency.p50, 200);
  assert.equal(text.totalLatency.p95, 290);
  assert.equal(text.ttft.p50, 30);
  assert.equal(text.tokenVelocity.p50, 20);
  assert.equal(text.successRate, 2 / 3 * 100);
  assert.equal(text.estimatedCreditPerUnit, 1.5);

  const image = metrics.calculateBenchmarkStats([
    success(100, 80, 0, 0, 1, 1),
    success(300, 200, 0, 0, 2, 2),
  ], "image");
  assert.equal(image.imageThroughput.p50, 500);
  assert.equal(image.estimatedCreditPerUnit, 1);
  assert.equal(image.generatedImages, 3);

  const tts = metrics.calculateBenchmarkStats([
    { ...success(1_000, 900, 0, 0, undefined), speechMetrics: { timeToFirstByteMs: 250, charactersPerSecond: 20, characterCount: 18 }, audio: { bytes: 10_000 } },
    { ...success(2_000, 1_800, 0, 0, undefined), speechMetrics: { timeToFirstByteMs: 450, charactersPerSecond: 10, characterCount: 18 }, audio: { bytes: 20_000 } },
  ], "tts");
  assert.equal(tts.speechTtfb.p50, 350);
  assert.equal(tts.characterThroughput.p50, 15);
  assert.equal(tts.audioBytes.p50, 15_000);
});

test("로그·이미지·오디오를 원자적으로 저장하고 안전한 파일명만 허용한다", async () => {
  const store = await source("lib/server/storage/run-store.ts");
  assert.match(store, /crypto\.randomUUID\(\).*\.tmp/);
  assert.match(store, /await rename\(temporary, filename\)/);
  assert.match(store, /RUN_ID\.test/);
  assert.match(store, /IMAGE_FILE\.test/);
  assert.match(store, /AUDIO_FILE\.test/);
  assert.match(store, /saveAudio/);
  assert.match(store, /catch \{ return null; \}/);
});

test("화면에서 중복 모델 ID를 공급자별로 구분하고 요청 취소를 지원한다", async () => {
  const [page, results, utilities] = await Promise.all([
    source("app/page.tsx"),
    source("features/model-lab/components/results.tsx"),
    source("features/model-lab/utils.ts"),
  ]);
  assert.match(page, /`\$\{model\.provider\}:\$\{model\.id\}`/);
  assert.match(page, /new AbortController\(\)/);
  assert.match(page, /요청 취소/);
  assert.match(page, /스트리밍 응답 형식이 올바르지 않습니다/);
  assert.match(results, /첫 토큰 TTFT/);
  assert.match(page, /전체 완료 P50/);
  assert.match(page, /P95/);
  assert.match(page, /benchmarkLogs/);
  assert.match(results, /이미지 처리량/);
  assert.doesNotMatch(results, /로컬 저장/);
  assert.match(results, /이미지는 저장됐지만 후속 처리 중 오류/);
  assert.match(utilities, /\^\[=\+\\-@\]/);
});

test("사용하지 않는 초기 배포 스캐폴드는 제거되어 있다", async () => {
  for (const path of ["vite.config.ts", "drizzle.config.ts", "worker/index.ts", "db/schema.ts", ".openai/hosting.json"]) {
    await assert.rejects(access(new URL(path, root)));
  }
});
