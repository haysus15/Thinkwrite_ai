import Link from "next/link";
import styles from "./page.module.css";

export default function ExtensionSetupPage() {
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <h1>Mirror Mode extension setup</h1>

        <section className={styles.card}>
          <h2>Download builds</h2>
          <p>Download the sideload package for your browser.</p>
          <div className={styles.links}>
            <a href="/extension/dist/chrome.zip" className={styles.linkBtn}>Chrome / Edge build</a>
            <a href="/extension/dist/firefox.zip" className={styles.linkBtn}>Firefox build</a>
          </div>
        </section>

        <section className={styles.card}>
          <h2>Chrome and Edge</h2>
          <ol>
            <li>Open <code>chrome://extensions</code> (or <code>edge://extensions</code>) and enable Developer mode.</li>
            <li>Click Load unpacked and select <code>extension/dist/chrome</code>.</li>
            <li>Pin ThinkWrite Mirror Mode from the extensions toolbar.</li>
          </ol>
        </section>

        <section className={styles.card}>
          <h2>Firefox</h2>
          <ol>
            <li>Open <code>about:debugging</code> and choose This Firefox.</li>
            <li>Click Load Temporary Add-on and choose <code>extension/dist/firefox/manifest.json</code>.</li>
            <li>Open the extension popup and verify Mirror Mode is active.</li>
          </ol>
        </section>

        <section className={styles.card}>
          <h2>Privacy</h2>
          <p>Your words never leave your browser. Only pattern data is sent to ThinkWrite.</p>
        </section>

        <Link href="/mirror-mode/dashboard" className={styles.backLink}>Back to Mirror Mode dashboard</Link>
      </div>
    </main>
  );
}
