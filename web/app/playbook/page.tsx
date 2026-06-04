export const metadata = { title: "Playbook — LOT" };

export default function PlaybookPage() {
  return (
    <div className="page" style={{ maxWidth: 820, lineHeight: 1.55 }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>The Playbook</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        How creative financing actually works, in plain English — what each play is, when it fits, and
        <strong> exactly what to say to the seller.</strong> LOT picks one of these for you on every deal;
        this explains the why. <em>Informational, not legal or financial advice — always involve an attorney.</em>
      </p>

      <Box tone="dark">
        <h2 style={{ fontSize: 16, marginBottom: 6 }}>The one idea that matters</h2>
        <p>You are not lowballing people. <strong>You&apos;re solving a problem.</strong> The owners worth
        contacting almost always have a <em>situation</em> behind the property — an inheritance they don&apos;t
        want, a divorce, a death, a tired landlord 200 miles away, someone behind on payments. The deal comes
        from <strong>understanding their story and offering the thing they actually need</strong> — speed,
        certainty, no hassle, terms that fix their tax or cash problem, and dignity. Be a person, not a vulture.
        Lead with mail (no pressure), let them come to you, then <strong>listen first.</strong></p>
      </Box>

      <h2 style={sec}>The plays (lowest commitment → full acquisition)</h2>

      <Play
        name="Bird-dogging"
        what="You find a motivated-seller property and hand the lead to another investor for a finder's fee ($500–$2k). You don't buy it or sign anything."
        fits="When you spot a deal outside your buy-box, or want cash now with zero capital and zero risk. (LOT's sourcing is bird-dogging for yourself — same muscle.)"
        say="“I came across your property and I work with buyers who move fast — mind if I pass it along, or would you rather talk directly?”"
        catch="Smallest payday; you're just the scout. Some states regulate fees — keep it a referral, not a brokered sale." />

      <Play
        name="Wholesaling"
        what="You get the property under contract at a low price, then assign that contract to a cash buyer for an assignment fee. You never actually own it."
        fits="Low capital, you have a buyer network, and you can get it under contract cheap enough that there's room for a buyer + your fee."
        say="“I can put it under contract and close on your timeline. I may bring in a partner to fund it — either way you get a clean, certain sale.”"
        catch="You need a real end-buyer and a low-enough contract. Disclose that you may assign. Thin if the spread isn't there." />

      <Play
        name="Cash (all-cash)"
        what="A straightforward purchase with your own funds (Nate's trust). Fast, certain, no financing contingency."
        fits="Anyone who values speed + certainty over top dollar — distress, a fast-closing need, or a property a bank won't touch."
        say="“All cash, close in two weeks, no financing that can fall through, and you pick the date. Simple and certain.”"
        catch="Ties up the most capital — so you want the best per-dollar return here, and you save the creative plays for deals where they net the seller more." />

      <Play
        name="Seller financing (owner financing / 'direct financing')"
        what="The seller becomes the bank. Instead of a lump sum, you pay them monthly (principal + interest) over years, on agreed terms."
        fits="Owners who own it FREE-AND-CLEAR (no mortgage), want steady passive income, and/or face a big capital-gains bill on a cash sale."
        say="“Instead of one lump sum and a giant tax bill this year, I pay you $X every month — steady income, you spread the gains out, and you net more than a cash sale. You hold the note; if I ever don't pay, the house comes back to you.”"
        catch="If the seller is a consumer-occupant, Dodd-Frank / SAFE Act rules apply (balloons OK, no negative amortization; a trust can use the 1-property exclusion, an LLC can't). Always an attorney." />

      <Play
        name="Subject-to ('take over the payments' / paying off the arrears)"
        what="You take the deed and keep making the seller's EXISTING mortgage payments. The loan stays in their name; you control and own the property."
        fits="An owner with a low-rate loan, little equity, and pressure — behind on payments, distressed, needs out now. You inherit their cheap financing."
        say="“I take over your payments starting this month — the late notices stop, your credit starts to recover, and you walk away clean without paying out of pocket. I handle everything from here.”"
        catch="The mortgage's due-on-sale clause means the lender could (rarely does) call the loan when title transfers. Garn-St-Germain gives a trust caveat. This is the highest-trust, highest-care play — never do it without an attorney, and never present it as risk-free." />

      <Play
        name="Hybrid"
        what="A mix — e.g. some cash to the seller now, take over the existing loan, AND a seller note for the rest."
        fits="A deal that doesn't fit one clean box: the seller needs some cash today AND has a loan AND wants some income."
        say="“Let's build it around what you need — a little cash now to handle X, I take over the loan, and I pay you the rest over time.”"
        catch="More moving parts = more places for it to break. Get the structure papered correctly." />

      <h2 style={sec}>Reading the backstory (the signals LOT already tracks)</h2>
      <p style={{ marginBottom: 10 }}>The same data that ranks a lead also hints at the <em>situation</em> — so you
      know how to approach, and which play likely fits:</p>
      <ul style={{ paddingLeft: 18, marginBottom: 16 }}>
        <li><strong>Long tenure + absentee</strong> → a tired, out-of-area landlord. Lead with “no hassle, I handle the tenants.” Often seller-finance (they want the income to keep coming) or cash.</li>
        <li><strong>Estate / trust owner</strong> → an inherited property someone doesn&apos;t want. Be gentle, patient, dignity-first (LOT routes these to manual review for exactly this reason). Cash for speed/closure.</li>
        <li><strong>Visible neglect (overgrown / abandoned vehicle)</strong> → deferred maintenance, a checked-out owner, possibly distress. Solve the burden.</li>
        <li><strong>High equity, long hold</strong> → capital-gains exposure → seller-finance is your strongest pitch (defer the tax).</li>
        <li><strong>Low equity / behind</strong> → subject-to (stop the bleeding, take over payments).</li>
      </ul>

      <Box tone="light">
        <strong>How LOT chooses for you:</strong> on every scored deal, the financing engine recommends a ranked
        structure — it leads with <em>subject-to</em> when the owner looks distressed/low-equity (NEED), and
        <em>seller-finance</em> when they&apos;re high-equity/long-tenure (GREED) — and it hands you the exact
        seller pitch + the legal guardrail. Open any parcel on the Map → the deal panel shows it. The mailer it
        drafts is built from <em>their</em> situation, not a generic template.
      </Box>
    </div>
  );
}

const sec: React.CSSProperties = { fontSize: 16, marginTop: 26, marginBottom: 10 };

function Play({ name, what, fits, say, catch: c }: { name: string; what: string; fits: string; say: string; catch: string }) {
  return (
    <div style={{ border: "1px solid var(--border-soft)", borderRadius: 10, padding: "14px 16px", marginBottom: 12 }}>
      <h3 style={{ fontSize: 15, marginBottom: 8 }}>{name}</h3>
      <Line k="What it is" v={what} />
      <Line k="When it fits" v={fits} />
      <div style={{ margin: "8px 0", padding: "8px 10px", background: "var(--positive-wash)", borderRadius: 6, fontSize: 13.5 }}>
        <strong style={{ color: "var(--positive)" }}>What to say: </strong><em>{say}</em>
      </div>
      <Line k="The catch" v={c} />
    </div>
  );
}
function Line({ k, v }: { k: string; v: string }) {
  return <p style={{ fontSize: 13.5, marginBottom: 3 }}><strong>{k}:</strong> <span className="muted">{v}</span></p>;
}
function Box({ tone, children }: { tone: "dark" | "light"; children: React.ReactNode }) {
  const dark = tone === "dark";
  return <div style={{ background: dark ? "var(--bg-chrome)" : "var(--bg-panel-2)", color: dark ? "var(--text-secondary)" : "var(--text-primary)",
    padding: "14px 16px", borderRadius: 10, marginBottom: 18, fontSize: 14 }}>{children}</div>;
}
