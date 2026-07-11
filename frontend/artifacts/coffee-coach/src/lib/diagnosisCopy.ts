/**
 * User-facing translations for the active terminate_reason values.
 *
 * Keep these sentences identical wherever a termination reason appears.
 * Unknown and orphan enum values intentionally have no translation here;
 * the fallback policy is handled as a separate layer.
 */
export const TERMINATE_REASON_COPY = {
  satisfied:
    '这杯你满意了,研磨就调到这儿。想继续优化的话,水温、手法是后面的事。',
  would_overextract:
    '再往细调,反而会变苦。回到上一杯那个设置,那杯最好——研磨就到这里。',
  plateau_ambiguous:
    '到这儿再磨细也帮不上了——可能是磨豆机已经磨到最细、再细也没用,也可能是豆子放久了、不那么新鲜了。这两种情况继续磨细都救不回来,所以研磨先停在这。',
  axis_unreliable:
    '你这台砍豆机磨出来粗细不均,又酸又苦是它造成的,不是你手法的问题。换成锥刀/平刀磨会稳很多。',
  axis_limit_underextracted:
    '已经磨到最细可用了,但萃取还没真正到位——偏薄、酸压过甜。研磨这里能调的都调过了,再往细会堵、细粉多、流速不稳。接下来要提升萃取,得靠水温或浓度这些研磨之外的调节,那是下一步。',
  flavor_mismatch:
    '这杯萃取已经调到位了——剩下的是风味取向。你不太爱这类酸的话,换一支豆会更合你口味,不是冲煮的问题。',
  taste_unaddressable:
    '萃取到位了,你喜欢这个酸、只是想更厚——这个方向很明确。让它更厚的办法是升温、延长接触、或提高浓度,这些是研磨之外的调节。这一版我们专注把研磨调到最好,那几项留给下一步。',
} as const;

export const TERMINATE_REASON_FALLBACK = '这一轮的判断我先不细分呈现了。';

const CONFIDENCE_STARS = {
  low: '★☆☆',
  medium: '★★☆',
  high: '★★★',
} as const;

const TURN_TYPE_LABELS = {
  probe: '正在追问确认',
  terminate: '停手',
  adjust: '这轮调整',
  seed: '起点配方',
} as const;

const GRADIENT_LABELS = {
  已收敛: '萃取已到位',
  '变好+同向': '↑ 变好',
  变好: '↑ 变好',
  变坏: '↓ 变坏',
  没变: '→ 没变化',
} as const;

const DECISION_LABELS = {
  继续: '继续这个方向',
  反向: '往回调一点',
  收步: '缩小调整幅度',
  转轴: '转到下一项调节',
  退回萃取层: '回到是否萃取到位的判断',
} as const;

export function terminateReasonCopy(reason?: string): string | undefined {
  if (!reason || !Object.prototype.hasOwnProperty.call(TERMINATE_REASON_COPY, reason)) {
    return undefined;
  }

  return TERMINATE_REASON_COPY[reason as keyof typeof TERMINATE_REASON_COPY];
}

export function terminateReasonLabel(reason?: string): string | undefined {
  if (!reason) return undefined;

  const copy = terminateReasonCopy(reason);
  if (copy) return copy;

  if (import.meta.env.DEV) {
    console.warn(`[diagnosis] unmapped terminate_reason: ${reason}`);
  }

  return TERMINATE_REASON_FALLBACK;
}

export interface ConfidenceDisplay {
  stars: string;
  note?: string;
}

export function confidenceDisplay(value?: string): ConfidenceDisplay | undefined {
  if (!value || !Object.prototype.hasOwnProperty.call(CONFIDENCE_STARS, value)) {
    return undefined;
  }

  const stars = CONFIDENCE_STARS[value as keyof typeof CONFIDENCE_STARS];
  return value === 'low'
    ? { stars, note: '需要更多信息判断' }
    : { stars };
}

export function turnTypeLabel(value?: string): string | undefined {
  if (!value || !Object.prototype.hasOwnProperty.call(TURN_TYPE_LABELS, value)) {
    return undefined;
  }

  return TURN_TYPE_LABELS[value as keyof typeof TURN_TYPE_LABELS];
}

export function gradientLabel(value?: string): string | undefined {
  if (!value || !Object.prototype.hasOwnProperty.call(GRADIENT_LABELS, value)) {
    return undefined;
  }

  return GRADIENT_LABELS[value as keyof typeof GRADIENT_LABELS];
}

export function adjustmentLabel(
  direction?: string,
  step?: string | number,
): string | undefined {
  const directionText =
    direction === 'finer'
      ? '这次磨细一点'
      : direction === 'coarser'
        ? '这次磨粗一点'
        : undefined;

  if (!directionText) return undefined;

  if (typeof step === 'string' && /定性|不可量化/.test(step)) {
    return `${directionText}（大致方向,量不精确）`;
  }

  return directionText;
}

export function decisionLabel(value?: string): string | undefined {
  if (!value || value === '探针' || value === '停手') return undefined;
  if (!Object.prototype.hasOwnProperty.call(DECISION_LABELS, value)) {
    return undefined;
  }

  return DECISION_LABELS[value as keyof typeof DECISION_LABELS];
}

export function grindNowLabel(value?: string): string | undefined {
  if (!value || !value.trim()) return undefined;
  return `现在磨到：${value}`;
}
