/** Maps backend error codes to i18n keys. */
export function authErrorKey(code: string | undefined): string {
  switch (code) {
    case "email_taken":
      return "auth.emailTaken";
    case "wrong_creds":
      return "auth.wrongCreds";
    case "blocked":
      return "auth.blocked";
    default:
      return "common.networkError";
  }
}
