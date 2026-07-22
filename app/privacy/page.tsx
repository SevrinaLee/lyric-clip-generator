import type { Metadata } from "next";
import { LegalLayout } from "../legal/LegalLayout";
import { SERVICE_NAME, CONTACT_EMAIL } from "../legal/content";

export const metadata: Metadata = {
  title: `Privacy Policy · ${SERVICE_NAME}`,
  description: `How ${SERVICE_NAME} collects, uses, and protects your data.`,
};

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      intro={`This policy explains what data ${SERVICE_NAME} ("we", "us") collects when you use the app, how we use it, and the choices you have. We collect only what we need to run the service.`}
    >
      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Account information.</strong> Your email address and an
          encrypted password, handled by our authentication provider (Supabase).
          We never store your password in plain text.
        </li>
        <li>
          <strong>Content you upload or create.</strong> Audio files, lyrics,
          song details, the clips you generate, and optional customization such
          as brand colours, a logo, or an image background. This content is
          stored so you can edit, preview, and download it.
        </li>
        <li>
          <strong>Payment information.</strong> Payments are processed by Stripe.
          We do <strong>not</strong> receive or store your full card number. We
          store a Stripe customer reference and the status of your purchases or
          subscription so we know what you&apos;ve unlocked.
        </li>
        <li>
          <strong>Usage and technical data.</strong> Basic logs needed to operate
          and secure the service (for example, request and error logs from our
          hosting provider).
        </li>
        <li>
          <strong>Cookies.</strong> A session cookie keeps you signed in. If you
          connect TikTok, a short-lived cookie protects that connection from
          cross-site request forgery. We do not use advertising cookies.
        </li>
      </ul>

      <h2>How we use your information</h2>
      <ul>
        <li>To provide the service — store your songs, generate and render clips, and let you download them.</li>
        <li>To process payments and manage your access and subscription.</li>
        <li>To secure the service, prevent abuse, and debug problems.</li>
        <li>To respond to you when you contact us for support.</li>
      </ul>
      <p>
        We do not sell your personal data, and we do not use your uploaded
        audio, lyrics, or clips to train machine-learning models.
      </p>

      <h2>Service providers we share data with</h2>
      <ul>
        <li><strong>Supabase</strong> — database, authentication, and file storage.</li>
        <li><strong>Stripe</strong> — payment processing and subscription billing.</li>
        <li><strong>Vercel</strong> — application hosting.</li>
        <li>
          <strong>TikTok</strong> — only if you choose to connect your account to
          post a clip. When you do, we use the access you grant to publish the
          specific clip you selected to your own TikTok account. Your use of
          TikTok is also governed by TikTok&apos;s own terms and privacy policy.
        </li>
        <li>
          <strong>OpenAI</strong> — only if automatic transcription is enabled;
          the audio you choose to transcribe is sent to generate lyric timing.
        </li>
      </ul>
      <p>These providers process data on our behalf to deliver the features above; we don&apos;t authorise them to use it for their own purposes.</p>

      <h2>Data retention</h2>
      <p>
        We keep your account and content while your account is active. You can
        delete individual songs, clips, and uploads from within the app. To
        delete your account and associated data, contact us at the address below.
        Some records (for example, payment records) may be retained where
        required for legal or accounting reasons.
      </p>

      <h2>Security</h2>
      <p>
        Access to your data is enforced at the database level so that each user
        can only read and write their own rows and files. Payments run through
        Stripe, and connections are encrypted in transit. No system is perfectly
        secure, but we take reasonable measures to protect your information.
      </p>

      <h2>Your rights</h2>
      <p>
        Depending on where you live, you may have the right to access, correct,
        export, or delete your personal data, or to object to certain
        processing. To exercise any of these, contact us and we&apos;ll respond
        within a reasonable time.
      </p>

      <h2>Children</h2>
      <p>The service is not directed to children under 13 (or the minimum age in your country), and we don&apos;t knowingly collect their data.</p>

      <h2>Changes to this policy</h2>
      <p>We may update this policy as the service evolves. Material changes will be reflected here with a new effective date.</p>

      <h2>Contact</h2>
      <p>
        Questions or requests? Email us at{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalLayout>
  );
}
