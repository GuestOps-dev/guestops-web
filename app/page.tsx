import Link from "next/link";

const features = [
  ["01", "One calm guest inbox", "Bring guest questions, property context, and team activity into one focused workspace."],
  ["02", "Stay ahead of follow-ups", "Surface conversations that need attention so no guest request quietly slips through the cracks."],
  ["03", "Property-aware assistance", "Give every home its own guide, contacts, welcome approach, and operational details."],
  ["04", "Built for the whole stay", "Keep check-in, check-out, guest details, vendors, and important conversations connected."],
] as const;

export default function Home() {
  return (
    <main className="marketing-page">
      <nav className="marketing-nav" aria-label="Primary navigation">
        <Link className="marketing-brand" href="/"><span className="marketing-brand-mark">G</span><span>GuestOpsHQ</span></Link>
        <div className="marketing-nav-actions"><a className="marketing-nav-link" href="#features">What it does</a><a className="marketing-nav-link" href="#inquire">Request info</a><Link className="marketing-login" href="/login">Sign in <span>→</span></Link></div>
      </nav>

      <section className="marketing-hero">
        <div className="marketing-orb marketing-orb-one" /><div className="marketing-orb marketing-orb-two" />
        <div className="marketing-hero-copy">
          <p className="marketing-eyebrow"><span /> Guest operations, made personal</p>
          <h1>Every guest feels<br /><em>looked after.</em></h1>
          <p className="marketing-lead">GuestOpsHQ helps hospitality teams keep conversations, stays, and property knowledge in one thoughtful place.</p>
          <div className="marketing-hero-actions"><a className="marketing-primary-cta" href="#inquire">Request a walkthrough <span>↗</span></a><a className="marketing-text-cta" href="#features">Explore the platform <span>↓</span></a></div>
          <p className="marketing-trust"><span className="marketing-trust-dot" /> Designed for hands-on vacation-rental teams</p>
        </div>
        <div className="marketing-hero-visual" aria-label="Preview of the GuestOpsHQ operations workspace">
          <div className="marketing-window"><div className="marketing-window-top"><span /><span /><span /><b>Today&apos;s guest operations</b></div><div className="marketing-window-body"><aside className="marketing-preview-sidebar"><div className="marketing-preview-logo">G</div><i /><i /><i /><i /></aside><div className="marketing-preview-content"><div className="marketing-preview-header"><div><small>GOOD MORNING, SCOTT</small><strong>Operations overview</strong></div><div className="marketing-preview-avatar">S</div></div><div className="marketing-preview-stats"><div><small>INBOX</small><b>12</b></div><div><small>REPLY NEEDED</small><b className="marketing-coral">3</b></div><div><small>GUESTS IN-HOUSE</small><b className="marketing-violet">8</b></div></div><div className="marketing-preview-list-title"><strong>Needs attention</strong><small>View all</small></div><div className="marketing-preview-message"><div className="marketing-preview-initial">N</div><div><b>Nicolás Löwener</b><span>Can we arrange dinner for our first night?</span></div><em>3m</em></div><div className="marketing-preview-message"><div className="marketing-preview-initial marketing-preview-initial-green">A</div><div><b>Alexandra &amp; family</b><span>We&apos;ve arrived safely. The house is beautiful!</span></div><em>18m</em></div><div className="marketing-preview-property"><span>⌂</span><div><small>UP NEXT</small><b>El Nido · Check-in tomorrow</b></div><i>→</i></div></div></div></div>
          <div className="marketing-float-card"><span className="marketing-float-icon">✓</span><div><b>Follow-up handled</b><small>Guest care stays on track</small></div></div>
        </div>
      </section>

      <section className="marketing-intro"><div><p className="marketing-section-kicker">A better way to host</p><h2>Less tab-switching.<br />More <em>thoughtful</em> hosting.</h2></div><p>From a first booking to a final goodbye, GuestOpsHQ gives your team a shared picture of what every guest needs.</p></section>
      <section className="marketing-features" id="features"><div className="marketing-features-heading"><p className="marketing-section-kicker">The platform</p><h2>Everything your team needs to stay a step ahead.</h2></div><div className="marketing-feature-grid">{features.map(([number, title, copy]) => <article className="marketing-feature" key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p><div className="marketing-feature-arrow">↗</div></article>)}</div></section>
      <section className="marketing-statement"><div><p className="marketing-section-kicker">Made for real hospitality</p><h2>Technology that leaves room for <em>human</em> care.</h2></div><p>GuestOpsHQ is built around the details that make a stay feel effortless: a timely answer, the right local expert, and a team that already knows the home.</p></section>
      <section className="marketing-inquiry" id="inquire"><div className="marketing-inquiry-copy"><p className="marketing-section-kicker">Let&apos;s talk</p><h2>Ready to make guest operations feel lighter?</h2><p>Tell us a little about your portfolio and we&apos;ll be in touch to discuss what GuestOpsHQ could look like for your team.</p><div className="marketing-contact-detail"><span>✦</span><a href="mailto:info@guestopshq.com">info@guestopshq.com</a></div></div><form className="marketing-form" action="mailto:info@guestopshq.com" method="post" encType="text/plain"><label>Your name<input name="name" required placeholder="Your name" /></label><label>Work email<input type="email" name="email" required placeholder="you@company.com" /></label><label>Tell us about your properties<textarea name="message" rows={3} placeholder="Number of homes, where you host, and what you need help with…" /></label><button type="submit">Start a conversation <span>→</span></button><small>We&apos;ll only use your details to respond to this inquiry.</small></form></section>
      <footer className="marketing-footer"><div className="marketing-brand"><span className="marketing-brand-mark">G</span><span>GuestOpsHQ</span></div><p>Guest experiences, beautifully coordinated.</p><div><Link href="/privacy">Privacy</Link><Link href="/sms-terms">Terms</Link><Link href="/login">Team sign in</Link></div></footer>
    </main>
  );
}
