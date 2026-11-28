#!/usr/bin/env python3
"""Context guard for Jordan's Claude chats.

Why: Claude Code sends the full conversation with every request
(https://code.claude.com/docs/en/costs), so a long chat costs more on every
message and its answers get worse. Jordan cannot see how big a chat is.
This hook measures it before each message and, once per 150k-token step,
tells Claude to offer a handover (save state, one paste for a fresh chat).

Silent on any error: it must never block a message.
"""
import json
import os
import sys

STEP = 150_000  # warn at about 150k, 300k, 450k ... tokens of history
TAIL_BYTES = 3_000_000


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


def main():
    try:
        data = json.load(sys.stdin)
        path = data.get("transcript_path") or ""
        if not path or not os.path.exists(path):
            return
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
            return
        k = round(tokens / 1000)
        msg = (
            f"Context guard: this chat now carries about {k}k tokens of history. "
            "Claude Code re-sends all of it with every message "
            "(https://code.claude.com/docs/en/costs), so each reply costs more and "
            "answers get worse as it grows. Answer Jordan's message first. Then add ONE "
            f"plain line at the end: \"This chat is getting long (about {k}k tokens). "
            "Say handover and I'll save everything and give you one paste for a fresh "
            "chat.\" Say it once; the guard fires again at the next step."
        )
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "UserPromptSubmit", "additionalContext": msg}}))
    except Exception:
        return


if __name__ == "__main__":
    main()
