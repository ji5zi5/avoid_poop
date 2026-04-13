import { translateErrorMessage } from "../content/copy";

export function formatAuthError(error: unknown) {
  if (error instanceof Error) {
    return translateErrorMessage(error.message);
  }

  return "알 수 없는 인증 오류가 발생했습니다.";
}
