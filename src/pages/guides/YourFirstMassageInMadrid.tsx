import { Link } from "react-router-dom";
import GuideLayout, { GuideLinks } from "./GuideLayout";

export default function YourFirstMassageInMadrid() {
  const title = "Your first massage in Madrid: what actually happens | Massage Club";
  const description =
    "What to wear, whether to undress, how to ask for less pressure in Spanish, and whether to tip. A plain guide for anyone booking their first massage in Madrid.";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    author: { "@type": "Organization", name: "Massage Club" },
    publisher: { "@type": "Organization", name: "Massage Club" },
  };

  return (
    <GuideLayout
      path="/guides/your-first-massage-in-madrid"
      title={title}
      description={description}
      jsonLd={jsonLd}
    >
      <article>
        <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-primary">
          Guide · First massage
        </p>
        <h1 className="font-display text-3xl md:text-4xl leading-[1.08] text-foreground mt-2">
          Your first massage in Madrid
        </h1>
        <p className="text-base text-foreground/85 mt-4 leading-relaxed">
          Booking is the part everyone worries about. Then you arrive, and a completely different set
          of questions starts: do I take everything off, what do I do with my clothes, what if it hurts
          and I cannot say so, am I supposed to tip. Nobody writes this down, so most people find out
          by guessing. This is what actually happens.
        </p>

        <h2 className="font-display text-2xl text-foreground mt-8">Before you go</h2>
        <p className="text-sm text-foreground/85 mt-2 leading-relaxed">
          Arrive five or ten minutes early. Most Madrid studios are small, often a single room or two
          inside a residential building, and there is rarely a waiting area to sit in for long.
        </p>
        <p className="text-sm text-foreground/85 mt-3 leading-relaxed">
          Bring cash if you can. Many small studios take cards, but not all of them, and some prefer
          cash. You pay at the studio, at the end.
        </p>
        <p className="text-sm text-foreground/85 mt-3 leading-relaxed">
          You do not need to bring anything else. Towels, sheets and any clothing you need are
          provided.
        </p>

        <h2 className="font-display text-2xl text-foreground mt-8">Do you take your clothes off?</h2>
        <p className="text-sm text-foreground/85 mt-2 leading-relaxed">
          This is the question everyone has and nobody asks. The answer depends entirely on the type of
          massage, and for the most common type in Madrid the answer is no.
        </p>

        <h3 className="font-display text-xl text-foreground mt-6">Thai massage, masaje tailandés</h3>
        <p className="text-sm text-foreground/85 mt-2 leading-relaxed">
          You stay fully clothed. The studio gives you loose cotton trousers and a top to change into.
          There is no oil. If the idea of undressing is what is putting you off, book Thai.
        </p>

        <h3 className="font-display text-xl text-foreground mt-6">Oil massages</h3>
        <p className="text-sm text-foreground/85 mt-2 leading-relaxed">
          This includes relajante, descontracturante, balinés, deportivo and most others. You undress to
          your underwear and lie under a towel or sheet. The therapist uncovers only the part they are
          working on and covers it again afterwards. You are never fully exposed. Keeping your
          underwear on is normal and expected.
        </p>

        <h3 className="font-display text-xl text-foreground mt-6">Foot reflexology, reflexología podal</h3>
        <p className="text-sm text-foreground/85 mt-2 leading-relaxed">
          Shoes and socks off, everything else stays on.
        </p>

        <h3 className="font-display text-xl text-foreground mt-6">Facial and head treatments</h3>
        <p className="text-sm text-foreground/85 mt-2 leading-relaxed">
          Clothes on, sometimes a towel over your shoulders.
        </p>

        <p className="text-sm text-foreground/85 mt-4 leading-relaxed">
          You change privately. The therapist leaves the room and knocks before coming back in.
        </p>

        <h2 className="font-display text-2xl text-foreground mt-8">What happens, in order</h2>
        <ol className="mt-3 space-y-2 text-sm text-foreground/85 list-decimal pl-5 leading-relaxed">
          <li>You arrive and they ask your name and which treatment you booked.</li>
          <li>They show you to the room and explain what to remove. If they say nothing and you are unsure, ask.</li>
          <li>They leave. You change and lie on the table, usually face down to start, under the towel.</li>
          <li>They knock, come back, and begin.</li>
          <li>Most of the session is quiet. You do not need to make conversation. Many people fall asleep and nobody minds.</li>
          <li>At the end they tell you they are finished and leave so you can dress.</li>
          <li>You pay at reception on the way out.</li>
        </ol>

        <h2 className="font-display text-2xl text-foreground mt-8">How to say what you want, without Spanish</h2>
        <p className="text-sm text-foreground/85 mt-2 leading-relaxed">
          You do not need to suffer through a massage that is too hard or too soft. These five phrases
          cover almost everything, and every therapist will understand them.
        </p>
        <ul className="mt-3 space-y-3 text-sm text-foreground/85">
          <li>
            <strong className="text-foreground">Más suave, por favor.</strong> Softer, please. Say
            “mas SWAH-veh”.
          </li>
          <li>
            <strong className="text-foreground">Más fuerte, por favor.</strong> Harder, please. Say
            “mas FWER-teh”.
          </li>
          <li>
            <strong className="text-foreground">Ahí, sí.</strong> There, yes. Use it when they find the
            right spot.
          </li>
          <li>
            <strong className="text-foreground">Ahí duele.</strong> That hurts. Say “ah-EE DWEH-leh”.
          </li>
          <li>
            <strong className="text-foreground">Está bien así.</strong> This is good as it is.
          </li>
        </ul>
        <p className="text-sm text-foreground/85 mt-4 leading-relaxed">
          If you say nothing, most therapists will keep the pressure they started with. Speaking up is
          normal and expected, not rude.
        </p>

        <h2 className="font-display text-2xl text-foreground mt-8">Do you tip in Spain?</h2>
        <p className="text-sm text-foreground/85 mt-2 leading-relaxed">
          No. Tipping is not expected for massage in Spain, and no therapist will think anything of it
          if you do not.
        </p>
        <p className="text-sm text-foreground/85 mt-3 leading-relaxed">
          This surprises Americans in particular. If you had a very good session and want to leave
          something, rounding up a few euros is a kind gesture, but it is genuinely optional and it is
          not built into anyone's wages the way it is in the United States.
        </p>

        <h2 className="font-display text-2xl text-foreground mt-8">Afterwards</h2>
        <p className="text-sm text-foreground/85 mt-2 leading-relaxed">
          Drink some water and take it slowly for a few minutes. If you had a deep tissue or
          descontracturante massage you may feel some soreness the next day, in the same way you
          would after exercise. That is normal and it passes.
        </p>
        <p className="text-sm text-foreground/85 mt-3 leading-relaxed">
          If something did not feel right, or the pressure was too much, tell the studio. They would
          rather know.
        </p>

        <h2 className="font-display text-2xl text-foreground mt-8">Still deciding what to book</h2>
        <p className="text-sm text-foreground/85 mt-2 leading-relaxed">
          <Link to="/discovery" className="text-primary underline underline-offset-2 hover:no-underline">
            Take the 60-second quiz
          </Link>{" "}
          and we will tell you what to book, and what it is called in Spanish. Or{" "}
          <Link to="/studios" className="text-primary underline underline-offset-2 hover:no-underline">
            browse studios in Madrid
          </Link>
          .
        </p>

        <GuideLinks exclude="/guides/your-first-massage-in-madrid" />
      </article>
    </GuideLayout>
  );
}
