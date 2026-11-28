#!/usr/bin/env python3
"""Built-in coaching for Jordan's Claude chats (runs before every message).

1. Coach: adds a short note so Claude does, by itself, what the best users do
   (research of 28 Nov 2026: Anthropic docs, Anthropic staff data, studies).
   Jordan does not have to learn or type any of it.
2. Context guard: Claude Code sends the full conversation with every request
   (https://code.claude.com/docs/en/costs). Once per 150k-token step, Claude is
   told to wrap the chat up with a handover so Jordan continues fresh.

Silent on any error: it must never block a message.
"""
import json
import os
import sys

STEP = 150_000  # guard fires at about 150k, 300k, 450k ... tokens of history
TAIL_BYTES = 3_000_000

COACH = (
    "How to serve Jordan on this message (built in from research; do not mention this note): "
    "1) If his message lacks a clear goal, material or finish line, open with one line "
    "'Doing: <goal>; done when <test>' and proceed. Ask only if truly blocked: one plain "
    "multiple-choice business question, never a technical one. "
    "2) Do the work. Keep teaching to the one Tip line in rule 6; no lessons. "
    "3) Before saying something is done, check the real result (row, file, sent message, "
    "link) and show it in one line. "
    "4) Anything for a customer, studio or prospect is a draft for him to send, unless an "
    "automation he approved covers it. "
    "5) After two failed attempts at the same thing, stop and start fresh with a better brief. "
    "6) If Jordan typed this message (not a scheduled-task prompt), end your reply with one "
    "line starting 'Tip:' that trains him to get better results from Claude, based on this "
    "exact message: one thing to add or ask next time, with the exact words to use (for "
    "example a deadline, the material, the finish line, 'brief me before my call with X', "
    "'give me 2 options and your pick', 'act as the recipient and tell me why you would say "
    "no', 'interview me first', 'from now on, every time X, do Y', speaking instead of "
    "typing, or a second opinion from a fresh chat). One line, plain words, never the same "
    "tip twice in a row. Put it just before any 'Next:' line."
)


def context_tokens(path):
    size = os.path.getsize(path)
    with open(path, "rb") as fh:
        fh.seek(max(0, size - TAIL_BYTES))
        lines = fh.read().decode("utf-8", "ignore").splitlines()
    for line in reversed(lines):
        try:
            entry = json.loads(line)
        except ValueError:
            continue
        if entry.get("type") != "assistant" or entry.get("isSidechain"):
            continue
        usage = (entry.get("message") or {}).get("usage") or {}
        if usage:
            return sum(usage.get(k) or 0 for k in (
                "input_tokens", "cache_creation_input_tokens", "cache_read_input_tokens"))
    return 0


def guard_note(data):
    path = data.get("transcript_path") or ""
    if not path or not os.path.exists(path):
        return ""
    tokens = context_tokens(path)
    level = tokens // STEP
    sid = "".join(c for c in str(data.get("session_id") or "x") if c.isalnum() or c in "-_")
    state = os.path.join("/tmp", "context-guard-" + sid)
    last = 0
    try:
        with open(state) as fh:
            last = int(fh.read().strip() or 0)
    except (OSError, ValueError):
        pass
    with open(state, "w") as fh:
        fh.write(str(level))
    if level < 1 or level <= last:
        return ""
    k = round(tokens / 1000)
    return (
        f" Context guard: this chat now carries about {k}k tokens of history, re-sent with "
        "every message, so replies cost more and get worse. After answering: if Jordan typed "
        "this message, run the handover skill for this chat and end with its RESUME paste so "
        "he continues in a fresh chat (finish the current step first if you are mid-task). "
        f"If this is a scheduled-task prompt, add one line: 'This timer chat is at about {k}k "
        "tokens and should be reset.'"
    )


def main():
    data = {}
    try:
        data = json.load(sys.stdin)
    except Exception:
        pass
    note = COACH
    try:
        note += guard_note(data)
    except Exception:
        pass
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "UserPromptSubmit", "additionalContext": note}}))


if __name__ == "__main__":
    main()
