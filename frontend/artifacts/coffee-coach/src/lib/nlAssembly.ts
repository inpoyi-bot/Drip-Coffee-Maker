/**
 * Assembles structured form choices into a single natural-language Chinese
 * sentence to send to the agent.
 *
 * ★ Contract red line (FRONTEND.md 屏2 「提交形态」/ HANDOFF-replit.md §6):
 * the agent's evalset is natural language, so production input must match
 * that distribution. Never send the structured form state as JSON to the
 * agent -- always route it through one of these assemblers first.
 */

export interface ColdStartInput {
  roastLevel: string; // e.g. "浅焙"
  roastDate: string | 'unknown'; // e.g. "8天前" or 'unknown'
  doseGrams: number;
  grinderType: string; // e.g. "锥刀电动磨"
  startingGrindDescription: string; // e.g. "像粗砂糖那么粗"
}

export function coldStartToNaturalLanguage(input: ColdStartInput): string {
  const parts: string[] = [];
  parts.push(`烘焙度是${input.roastLevel}`);
  parts.push(
    input.roastDate === 'unknown'
      ? '烘焙日期不知道,包装上找不到'
      : `烘焙日期是${input.roastDate}`,
  );
  parts.push(`粉量${input.doseGrams}克`);
  parts.push(`磨豆机是${input.grinderType}`);
  parts.push(`起始研磨${input.startingGrindDescription}`);
  return `${parts.join(',')}。`;
}

export interface CupFeedbackInput {
  /** Sensory buttons the user tapped, e.g. ["酸", "薄"]. */
  sensory: string[];
  /** Free-text elaboration for a "尝到了但说不清" pick, if any. */
  sensoryElaboration?: string;
  vsPrev: '变好' | '变坏' | '没变' | '说不清';
  brewTimeSeconds: number | 'not_timed';
  bedShape: '平' | '拱' | '塌坑' | '偏厚下陷' | 'not_observed';
  wallRing: 'present' | 'absent' | 'not_observed';
  bedNote?: string;
}

export function cupFeedbackToNaturalLanguage(input: CupFeedbackInput): string {
  const parts: string[] = [];

  if (input.sensory.length > 0) {
    parts.push(`这杯${input.sensory.join('、')}`);
  }
  if (input.sensoryElaboration) {
    parts.push(input.sensoryElaboration);
  }
  parts.push(
    input.vsPrev === '说不清' ? '和上一杯比说不清是好是坏' : `比上杯${input.vsPrev}`,
  );
  parts.push(
    input.brewTimeSeconds === 'not_timed'
      ? '没计时'
      : `冲煮时间约${Math.floor(input.brewTimeSeconds / 60)}分${input.brewTimeSeconds % 60}秒`,
  );
  parts.push(
    input.bedShape === 'not_observed' ? '床面没注意看' : `床面${input.bedShape}`,
  );
  parts.push(
    input.wallRing === 'not_observed'
      ? '挂粉环没注意看'
      : input.wallRing === 'present'
        ? '杯壁有挂粉环'
        : '杯壁没挂粉环',
  );
  if (input.bedNote) {
    parts.push(input.bedNote);
  }

  return `${parts.join(',')}。`;
}
