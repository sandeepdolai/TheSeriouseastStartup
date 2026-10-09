import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service · Paper Stish",
  description: "Terms for using Paper Stish to create and publish personal websites.",
};

export default function TermsOfServicePage() {
  return (
    <main className="legal-page">
      <article className="legal-shell">
        <a className="legal-back" href="/">← Back to Paper Stish</a>
        <h1>Terms of Service</h1>
        <p className="legal-updated">Last updated: 9 October 2026</p>

        <p>
          These terms apply when you use Paper Stish to create designs and publish personal websites.
          By using the service, you agree to use it lawfully and responsibly.
        </p>

        <h2>Your account</h2>
        <p>
          Sign-in is provided through Google. Keep access to your account secure and use an account
          you are authorized to control. You are responsible for activity performed through your
          account, subject to applicable law.
        </p>

        <h2>Your designs and content</h2>
        <p>
          You keep the rights you hold in the content you create or upload. You are responsible for
          having the rights and permissions needed to use photos, text, illustrations, fonts, and other
          assets you add, including permission from people depicted where required. By publishing, you
          give Paper Stish a limited, non-exclusive permission to store, reproduce, and display that
          content only as needed to host, deliver, and maintain the website you asked us to publish.
        </p>

        <h2>Public websites and sharing</h2>
        <p>
          A published website is accessible to anyone who has its URL; it is not private or password
          protected. You choose the content to publish and should not include confidential information.
          You can republish a website to update its current link or use the Publish Website flow to
          unpublish it. Unpublishing removes the publication from the service, though copies, screenshots,
          browser caches, or content already shared by others may remain outside our control.
        </p>

        <h2>Acceptable use</h2>
        <p>You may not use Paper Stish to:</p>
        <ul>
          <li>violate laws, another person's privacy, publicity, copyright, trademark, or other rights;</li>
          <li>publish threats, harassment, scams, impersonation, or content intended to harm others;</li>
          <li>upload malicious code, attack the service, evade security measures, or disrupt other users; or</li>
          <li>attempt to access another user's account, drafts, or unpublished content.</li>
        </ul>

        <h2>Service availability and removal</h2>
        <p>
          We work to keep Paper Stish available, but do not guarantee uninterrupted operation, permanent
          storage, or that every browser or device will behave identically. Drafts are stored locally on
          your device and can be lost if browser data is cleared or the device becomes unavailable.
          We may restrict or remove content that breaches these terms, violates rights, or creates
          security or operational risks.
        </p>

        <h2>Disclaimers</h2>
        <p>
          To the extent permitted by law, the service is provided on an “as available” basis without
          warranties that it will be error-free, continuously available, or suitable for every purpose.
          Nothing in these terms removes rights that cannot lawfully be excluded.
        </p>

        <h2>Contact</h2>
        <p>
          Questions or content-removal requests can be sent to
          {" "}<a href="mailto:sandeepdolai.info@gmail.com">sandeepdolai.info@gmail.com</a>.
        </p>

        <p className="legal-end">
          These starter terms should be reviewed by a qualified legal professional before a commercial
          launch, especially if you introduce paid plans, broader data processing, or additional regions.
        </p>
      </article>
    </main>
  );
}
