import type { Metadata } from "next";
import { LegalLayout } from "../legal/LegalLayout";
import { SERVICE_NAME, CONTACT_EMAIL, GOVERNING_LAW } from "../legal/content";

export const metadata: Metadata = {
  title: `Terms of Service · ${SERVICE_NAME}`,
  description: `The terms that govern your use of ${SERVICE_NAME}.`,
};

export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      intro={`These terms govern your use of ${SERVICE_NAME} ("the service", "we", "us"). By creating an account or using the service, you agree to them.`}
    >
      <h2>The service</h2>
      <p>
        {SERVICE_NAME} lets you upload audio, add lyrics, and generate captioned
        video clips that you can preview and download, and optionally publish to
        connected platforms. Features may change over time.
      </p>

      <h2>Eligibility &amp; accounts</h2>
      <p>
        You must be at least 13 years old (or the minimum age in your country) to
        use the service. You&apos;re responsible for your account credentials and
        for activity under your account. Keep your password secure.
      </p>

      <h2>Your content and rights</h2>
      <ul>
        <li>
          <strong>You keep ownership</strong> of the audio, lyrics, images, and
          clips you upload or create. We don&apos;t claim ownership of them.
        </li>
        <li>
          <strong>You grant us a limited licence</strong> to store, process, and
          display your content solely to provide the service to you (for example,
          rendering a clip or generating a preview).
        </li>
        <li>
          <strong>You are responsible for the rights.</strong> You represent that
          you own or are licensed to use the audio, lyrics, and images you upload,
          and that your content doesn&apos;t infringe anyone else&apos;s rights or
          break the law. Do not upload content you don&apos;t have the rights to.
        </li>
        <li>
          If you submit a clip to the public showcase, you grant us permission to
          display that clip publicly until you remove it or ask us to.
        </li>
      </ul>

      <h2>Acceptable use</h2>
      <p>You agree not to use the service to:</p>
      <ul>
        <li>Upload or create content that is illegal, infringing, hateful, or harmful.</li>
        <li>Attempt to break, overload, reverse-engineer, or gain unauthorised access to the service or other users&apos; data.</li>
        <li>Resell or redistribute the service itself without permission.</li>
      </ul>

      <h2>Payments</h2>
      <ul>
        <li>Previewing is free. Downloading exports requires either a one-time song unlock or a Creator subscription, at the prices shown on the Pricing page.</li>
        <li>Payments are processed by Stripe. Subscriptions renew automatically until cancelled; you can cancel anytime from your account, and access continues until the end of the current billing period.</li>
        <li>Except where required by law, payments are non-refundable. If something goes wrong with a charge, contact us.</li>
        <li>Voluntary donations (tips) are non-refundable and grant no additional access or features.</li>
      </ul>

      <h2>Third-party platforms</h2>
      <p>
        If you connect a third-party platform such as TikTok to publish a clip,
        your use of that platform is governed by its own terms and policies, and
        you authorise us to act on your behalf only to the extent needed to
        publish the clip you selected.
      </p>

      <h2>Disclaimers</h2>
      <p>
        The service is provided &quot;as is&quot; and &quot;as available&quot;,
        without warranties of any kind. Automated features (such as clip
        suggestions or timing estimates) are best-effort and may not be perfect.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, we are not liable for indirect,
        incidental, or consequential damages, or for loss of data or content.
        Our total liability for any claim relating to the service is limited to
        the amount you paid us in the twelve months before the claim.
      </p>

      <h2>Termination</h2>
      <p>
        You may stop using the service and delete your account at any time. We
        may suspend or terminate access if you breach these terms or use the
        service unlawfully.
      </p>

      <h2>Changes to these terms</h2>
      <p>We may update these terms as the service evolves. Continued use after changes means you accept the updated terms.</p>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of {GOVERNING_LAW}, without regard to conflict-of-laws rules.</p>

      <h2>Contact</h2>
      <p>
        Questions about these terms? Email us at{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalLayout>
  );
}
