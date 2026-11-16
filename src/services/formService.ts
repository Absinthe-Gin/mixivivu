/**
 * The source posts bookings, contact requests and reviews to its own
 * backend. This clone has no backend, so submissions are stored in the
 * browser (localStorage) to keep the flows working end to end.
 */
export type SubmissionKind = 'contact' | 'booking' | 'review' | 'consult';

const KEY = 'mixivivu-clone:submissions';

export interface Submission {
  kind: SubmissionKind;
  payload: Record<string, unknown>;
  createdAt: string;
}

function readAll(): Submission[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Submission[];
  } catch {
    return [];
  }
}

export async function submitForm(kind: SubmissionKind, payload: Record<string, unknown>): Promise<Submission> {
  const entry: Submission = { kind, payload, createdAt: new Date().toISOString() };
  try {
    localStorage.setItem(KEY, JSON.stringify([...readAll(), entry]));
  } catch {
    // Storage can be unavailable (private mode); the submission still succeeds in-session.
  }
  await new Promise((r) => setTimeout(r, 300));
  return entry;
}

export const listSubmissions = (kind?: SubmissionKind) => readAll().filter((s) => !kind || s.kind === kind);
