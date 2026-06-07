/**
 * Form-first intake: assessment from the form, then Q&A chat.
 * Number changes go back through the form — not mid-chat intake.
 */

export function wantsToChangeNumbers(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return (
    /(?:change|update|edit|fix|correct|redo)\s+(?:my\s+)?(?:number|amount|figure|input|details|info)/i.test(
      t
    ) ||
    /(?:different|new|wrong)\s+(?:number|amount|price|down|income|rate)/i.test(t) ||
    /(?:go\s+back|back\s+to)\s+(?:the\s+)?form/i.test(t) ||
    /(?:refill|re-?enter|start\s+over).*(?:form|number)/i.test(t) ||
    /update\s+(?:the\s+)?form/i.test(t) ||
    /(?:change|update)\s+(?:vehicle|home|car|mortgage|loan)\s+(?:price|cost)/i.test(t)
  );
}

export const EDIT_NUMBERS_REPLY =
  "To change your numbers, tap **Update your numbers** above — that opens the form with what you entered last time. I'll rerun your checklist from there.";

export const FORM_FIRST_REPLY: Record<"car-loan" | "mortgage" | "investment", string> = {
  "car-loan":
    "Start with the form above — fill in your car details and I'll run the checklist. After that you can ask rule questions here.",
  mortgage:
    "Start with the form above — share your home-buying or refinance numbers and I'll run the assessment. Then you can ask follow-ups here.",
  investment:
    "Start with the form above — answer the short yes/no checklist and I'll give you your priority plan. Then ask questions here.",
};
