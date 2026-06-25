const STORAGE_KEY = "finance-rules:financial-literacy:completed";

export function getCompletedTopics(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

export function isTopicCompleted(topicId: string): boolean {
  return getCompletedTopics().includes(topicId);
}

export function markTopicCompleted(topicId: string): string[] {
  const current = getCompletedTopics();
  if (current.includes(topicId)) return current;
  const next = [...current, topicId];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / privacy errors */
  }
  return next;
}

export function getCompletionCount(totalTopics: number): {
  completed: number;
  total: number;
} {
  const completed = getCompletedTopics().length;
  return { completed: Math.min(completed, totalTopics), total: totalTopics };
}
