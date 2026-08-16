import GuideLayout, { CalmaCard, GuideLinks } from "./GuideLayout";

export default function IsMassageGoodForYou() {
  const title = "Is massage actually good for you? What the science says | Massage Club";
  const description =
    "What massage research actually supports — stress, muscle soreness, back pain, anxiety and sleep — and what wellness marketing gets wrong.";

  return (
    <GuideLayout path="/guides/is-massage-good-for-you" title={title} description={description}>
      <article>
        <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-primary">Guide · Science</p>
        <h1 className="font-display text-3xl md:text-4xl leading-[1.08] text-foreground mt-2">
          Is massage actually good for you? What the science says
        </h1>
        <p className="text-base text-foreground/85 mt-4 leading-relaxed">
          Massage is often sold with claims that sound medical but fall apart under scrutiny —
          "detoxifying" lymphatic drainage, "releasing toxins", balancing energy, even curing
          illness. The good news is that the honest evidence is still strong. Researchers have run
          controlled trials and meta-analyses for decades, and several benefits are well supported.
          This guide separates what we know from what we don't.
        </p>

        <h2 className="font-display text-2xl text-foreground mt-8">What the evidence supports</h2>

        <h3 className="font-display text-xl text-foreground mt-6">1. Stress and relaxation</h3>
        <p className="text-sm text-foreground/85 mt-2 leading-relaxed">
          Massage reliably shifts the body toward the parasympathetic — "rest and digest" — state.
          Controlled studies show reduced heart rate, lower blood pressure and modest decreases in
          cortisol after a session. The effect is partly mechanical (slow pressure on skin and muscle
          activates pressure receptors that signal the nervous system to down-regulate) and partly
          psychological (a quiet, predictable environment helps). It is not a permanent fix for
          chronic stress, but it is a genuine reset.
        </p>

        <h3 className="font-display text-xl text-foreground mt-6">2. Post-exercise muscle soreness</h3>
        <p className="text-sm text-foreground/85 mt-2 leading-relaxed">
          This is one of the strongest evidence areas for massage. Multiple meta-analyses conclude
          that massage is among the most effective recovery methods for reducing delayed-onset
          muscle soreness (DOMS) after hard exercise. Muscle-biopsy research has also found reduced
          inflammatory signaling in massaged muscle after strenuous activity. The practical takeaway:
          if you have trained hard, a massage within 24–48 hours can meaningfully reduce stiffness
          and tenderness.
        </p>

        <h3 className="font-display text-xl text-foreground mt-6">3. Low back pain</h3>
        <p className="text-sm text-foreground/85 mt-2 leading-relaxed">
          Cochrane reviews and large systematic reviews show that massage therapy produces real
          short-term relief for chronic and sub-acute low back pain. The benefits are comparable to
          some other conservative treatments in the first weeks, and many people find massage easier
          to tolerate than medication. It is best framed as an effective reset, not a cure: regular
          sessions can keep episodes shorter and less intense, especially when combined with movement
          and posture changes.
        </p>

        <h3 className="font-display text-xl text-foreground mt-6">4. Anxiety and mood</h3>
        <p className="text-sm text-foreground/85 mt-2 leading-relaxed">
          Meta-analyses across dozens of trials show that massage therapy reduces anxiety symptoms
          in both clinical and non-clinical populations. Touch itself appears to matter: safe,
          consensual touch triggers oxytocin release and lowers arousal. The effect sizes are
          moderate, not miraculous, and they are strongest when massage is part of a broader routine
          that includes sleep, movement and social connection.
        </p>

        <h3 className="font-display text-xl text-foreground mt-6">5. Sleep</h3>
        <p className="text-sm text-foreground/85 mt-2 leading-relaxed">
          Touch therapies consistently improve self-reported sleep quality, especially in people with
          pain, anxiety or insomnia. The mechanism is likely a mix of reduced muscle tension, lower
          cortisol and the general calming effect of slowing down for an hour. Again, it is not a
          standalone treatment for sleep disorders, but it can be a useful part of a sleep routine.
        </p>

        <h2 className="font-display text-2xl text-foreground mt-8">What we won't claim</h2>
        <p className="text-sm text-foreground/85 mt-2 leading-relaxed">
          Honest massage therapy has limits, and anyone who ignores them is usually selling
          something. We do not claim that massage:
        </p>
        <ul className="mt-3 space-y-2 text-sm text-foreground/85 list-disc pl-5">
          <li>"Releases toxins" or detoxifies your body — your liver and kidneys handle that.</li>
          <li>Cures illness, fixes structural misalignment or replaces medical care.</li>
          <li>Permanently removes chronic pain after a single session.</li>
          <li>Breaks up fat, reshapes your body or produces lasting weight loss.</li>
        </ul>
        <p className="text-sm text-foreground/85 mt-3 leading-relaxed">
          If a studio or spa tells you any of the above, treat it as a red flag. The real benefits
          above are worth plenty on their own.
        </p>

        <h2 className="font-display text-2xl text-foreground mt-8">How often should you get a massage?</h2>
        <p className="text-sm text-foreground/85 mt-2 leading-relaxed">
          There is no universal answer; it depends on your goal and budget.
        </p>
        <ul className="mt-3 space-y-2 text-sm text-foreground/85 list-disc pl-5">
          <li>
            <strong className="text-foreground">For stress:</strong> whatever cadence you can sustain
            — weekly, fortnightly or monthly can all help. The best schedule is one you actually keep.
          </li>
          <li>
            <strong className="text-foreground">For training recovery:</strong> book within 24–48
            hours after a hard session, when DOMS is building and inflammation is still active.
          </li>
          <li>
            <strong className="text-foreground">For chronic desk-tension:</strong> many people
            settle on a monthly maintenance session and notice fewer flare-ups over time.
          </li>
        </ul>

        <h2 className="font-display text-2xl text-foreground mt-8">Book a massage in Madrid</h2>
        <p className="text-sm text-foreground/85 mt-2 leading-relaxed">
          If you are in Madrid and want to try a session with a studio that speaks English and lets
          you book online, Calma Madrid in Chamberí is currently available through Massage Club.
        </p>

        <CalmaCard note="Book a deep tissue session, a Kobido facial or a relaxing full-body ritual. You choose pressure and focus areas in English, pay at the studio, and cancel in one click if plans change." />

        <GuideLinks exclude="/guides/is-massage-good-for-you" />
      </article>
    </GuideLayout>
  );
}
