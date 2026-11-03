/**
 * The old "deals" lines ("Get massage deals in Madrid", "Want to hear about
 * good prices?", "One email when a deal lands") are gone. House rule (5 Sept):
 * we never invent or pre-announce a discount, and a customer only hears about
 * one on the confirmation, once the studio has given it in writing.
 *
 * The exports stay so existing imports keep compiling; each renders nothing.
 */

type Props = { className?: string };

/** Was a footer link to /notify. Renders nothing. */
export function DealsFooterLine(_props: Props) {
  return null;
}

/** Was the "Want to hear about good prices? Join the list" line. Renders nothing. */
export function DealsConfirmationLine(_props: Props) {
  return null;
}

/** Was the home-page "good prices, one email when a deal lands" block. Renders nothing. */
export function DealsJoinSection(_props: Props) {
  return null;
}
