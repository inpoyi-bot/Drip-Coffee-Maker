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
  const roastDate =
    input.roastDate === 'unknown'
      ? '烘焙日期不知道,包装上找不到'
      : `烘焙日期${input.roastDate}`;

  return `我要开一包新豆开始调。V60 手冲,${input.roastLevel},${roastDate},粉量${input.doseGrams}克。我的磨豆机是${input.grinderType},现在磨出来${input.startingGrindDescription}。怎么开始?`;
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
  const sensoryText = input.sensory.length > 0
    ? `这杯${input.sensory[0]}${input.sensory.length > 1 ? `,而且${input.sensory.slice(1).join('、')}` : ''}`
    : '';
  const elaboration = input.sensoryElaboration
    ? `${sensoryText ? ',' : ''}${input.sensoryElaboration}`
    : '';
  const comparison =
    input.vsPrev === '说不清' ? '和上一杯比说不清是好是坏' : `和上一杯比${input.vsPrev}`;
  const brewTime =
    input.brewTimeSeconds === 'not_timed'
      ? '冲煮时间没计时'
      : `大概${Math.floor(input.brewTimeSeconds / 60)}分${input.brewTimeSeconds % 60}秒就下完了`;
  const bedShape = input.bedShape === 'not_observed' ? '床面没注意看' : `床面${input.bedShape}`;
  const wallRing =
    input.wallRing === 'not_observed'
      ? '杯壁有没有挂粉环,没注意看'
      : input.wallRing === 'present'
        ? '杯壁有挂粉环'
        : '杯壁没挂粉环';
  const sensorySentence = sensoryText || input.sensoryElaboration
    ? `${sensoryText}${elaboration}。`
    : '';
  const note = input.bedNote ? `另外,${input.bedNote}。` : '';

  return `冲好了。${sensorySentence}${comparison},${brewTime},${bedShape},${wallRing}。${note}`;
}

/**
 * Turns a probe-button choice back into the same natural-language shape the
 * agent receives in evals. The visible option remains the locked diagnostic
 * wording; this layer only supplies the subject so the reply is a sentence,
 * never a structured payload.
 */
export type ProbeType = 'P2' | 'P3' | 'P4' | 'P5';

const PROBE_REPLY_SENTENCES: Record<ProbeType, Record<string, string>> = {
  P2: {
    '酸完发空、收尾就没了': '这酸酸完发空、收尾就没了。',
    '会化成甜、有回甘': '这酸会化成甜、有回甘。',
    '说不清': '这个酸收尾是什么感觉，我说不清。',
  },
  P3: {
    '甜能清楚盖过酸、喝完持续回甘': '这点甜能清楚盖过酸、喝完持续回甘。',
    '只是比最开始好一点、努力才尝到一点甜': '这点甜只是比最开始好一点、努力才尝到一点甜。',
    '说不清': '这点甜到什么程度，我说不清。',
  },
  P4: {
    '我不太爱这类酸的风格': '我不太爱这类酸的风格。',
    '我喜欢这个酸,只是想要更厚/更圆': '我喜欢这个酸，只是想要更厚、更圆。',
    '说不清': '关于这个酸，我说不清。',
  },
  P5: {
    '寡淡、没什么余味,酸把甜压没了': '这个“不甜”更像寡淡、没什么余味，酸把甜压没了。',
    '有回甘的,只是酸太亮把甜盖住了、想更厚': '有回甘的，只是酸太亮把甜盖住了，想更厚。',
    '说不清': '这个“不甜”我说不清。',
  },
};

export function probeReplyToNaturalLanguage(probe: ProbeType, optionLabel: string): string {
  const sentence = PROBE_REPLY_SENTENCES[probe][optionLabel];
  if (!sentence) {
    throw new Error(`Unknown ${probe} probe option`);
  }
  return sentence;
}
