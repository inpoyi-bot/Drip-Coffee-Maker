import { twMerge } from 'tailwind-merge';

import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * An agent turn can arrive as several text events. The UI presents them as one
 * continuous coach explanation, while structured fields remain separate.
 */
export function assembleCoachMessage(messages: string[]): string {
  return messages
    .map((message) => message.trim())
    .filter(Boolean)
    .map((message, index) => {
      if (index === 0) return message;

      // The agent can acknowledge each event separately. Remove only a short,
      // standalone acknowledgement at the start; do not attempt semantic edits.
      return message.replace(/^(?:好(?:的)?|明白了|收到)(?:[，,。！!、]+|\s+|$)/, '').trim();
    })
    .filter(Boolean)
    .join('\n\n');
}
