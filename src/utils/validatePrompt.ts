export const MAX_PROMPT_LENGTH = 500;

export interface PromptValidation {
  valid: boolean;
  length: number;
  error?: string;
}

export function validatePrompt(prompt: string): PromptValidation {
  const length = prompt.length;
  if (length > MAX_PROMPT_LENGTH) {
    return { valid: false, length, error: `프롬프트는 ${MAX_PROMPT_LENGTH}자 이하로 입력해주세요.` };
  }
  return { valid: true, length };
}
