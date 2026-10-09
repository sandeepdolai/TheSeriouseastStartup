import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy · Paper Stish",
  description: "How Paper Stish handles account, draft, and published website data.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="legal-page">
      <article className="legal-shell">
        <a className="legal-back" href="/">← Back to Paper Stish</a>
        <h1>Privacy Policy</h1>
        <p className="legal-updated">Last updated: 9 October 2026</p>

        <p>
          Paper Stish lets people create designs and publish shareable personal websites. This policy
          explains what information the service handles and the choices available to you.
        </p>

        <h2>Information we handle</h2>
        <ul>
          <li><strong>Sign-in details.</strong> When you sign in with Google, the service receives the account information Google makes available, such as your name and email address. The application stores your email and, when available, your name to associate published websites with your account.</li>
          <li><strong>Unpublished drafts.</strong> Smart Edit drafts and project assets are stored in your browser's local storage systems, including IndexedDB. These drafts are device-local and are not automatically backed up to our servers. Clearing browser data or changing devices can make them unavailable.</li>
          <li><strong>Published websites.</strong> When you publish, the selected design snapshot, public link details, text, image references, and any embedded user-font data are sent to our server and stored so the link can load for visitors.</li>
          <li><strong>Basic technical requests.</strong> Our hosting provider and infrastructure may process request and security logs needed to deliver and protect the service.</li>
        </ul>

        <h2>Published links are public</h2>
        <p>
          Anyone who has a published website's URL can view its content without signing in. A link is
          not a password. Visitors may copy, share, screenshot, or save what they can access. Do not
          publish private information or media unless you are comfortable sharing it with anyone who
          obtains the link. Published personal pages are marked not to be indexed by search engines,
          but that is not an access-control guarantee.
        </p>

        <h2>Storage and service providers</h2>
        <p>
          Account records and published snapshots are stored in the application's database and hosting
          environment. If Cloudinary image hosting is configured, image assets may be sent to Cloudinary
          so published designs can load from a durable URL. Google provides the sign-in flow. Those
          providers process data under their own terms and privacy policies.
        </p>

        <h2>Newsletter</h2>
        <p>
          Newsletter registration is not currently active. The service does not save or subscribe an
          email submitted through the newsletter form; the form reports that sign-ups are unavailable.
        </p>

        <h2>Retention and your choices</h2>
        <p>
          Unpublished drafts generally remain in the browser until you clear the relevant site data.
          Published websites remain available until they are unpublished by the account that owns them
          or removed after a support request. You can unpublish a website from the Publish Website flow
          while using the project on the device where it is saved.
        </p>
        <p>
          To ask a question or request access to or removal of an account record or published content,
          contact <a href="mailto:sandeepdolai.info@gmail.com">sandeepdolai.info@gmail.com</a>. We may
          need enough information to verify that you control the account or publication.
        </p>

        <h2>Children and sensitive information</h2>
        <p>
          Paper Stish is not designed for storing sensitive personal, financial, medical, or confidential
          information. If you are a parent or guardian and believe a child has submitted information,
          contact support so the request can be reviewed.
        </p>

        <h2>Changes to this policy</h2>
        <p>
          This policy may be updated as the service changes. The date above indicates the latest
          revision shown on this page.
        </p>

        <p className="legal-end">
          This is a plain-language description of the current application, not a substitute for legal
          advice. Contact support for questions about this policy.
        </p>
      </article>
    </main>
  );
}
