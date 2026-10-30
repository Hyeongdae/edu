/** Identity fields used by the game; both MSAL and hosted SWA accounts satisfy this contract. */
export interface GameAccount {
  homeAccountId: string;
  username: string;
  name?: string | null;
}
