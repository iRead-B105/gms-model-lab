/**
 * Detects instructions whose requested output is a text prompt rather than an
 * image. Sending these instructions to an image-only response mode commonly
 * makes Gemini finish with NO_IMAGE.
 */
export function looksLikePromptAuthoringInstruction(value: string) {
  const normalized = value.toLowerCase().replaceAll(/\s+/g, " ");
  const asksToAuthorPrompt = /(이미지\s*생성\s*프롬프트|프롬프트를\s*(작성|설계|만들)|write\s+(an?\s+)?image\s+prompt|create\s+(an?\s+)?image\s+prompt)/i.test(normalized);
  const asksForTextOnly = /(최종\s*응답|프롬프트만|텍스트만|하나의\s+완성된.*프롬프트|return\s+only|output\s+only)/i.test(normalized);
  return asksToAuthorPrompt && asksForTextOnly;
}
