/**
 * Heads-up shown next to the Windows download.
 *
 * shft's installer IS Authenticode-signed and timestamped (Azure Artifact
 * Signing, publisher "Troy Carson"), but SmartScreen still prompts on any
 * independently-distributed installer until Microsoft's reputation service has
 * seen enough clean downloads. Buyers read that prompt as "this is malware and
 * the store sold it to me", so we say it first, in our own words, and give them
 * the publisher name to check the signature against.
 *
 * Deliberately always visible rather than collapsed — it only works if it is
 * read BEFORE the download, not after the scary dialog appears.
 */
export default function WindowsInstallNote() {
  return (
    <div
      className="mt-4 rounded-lg border p-4 text-xs"
      style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
    >
      <p className="font-semibold mb-1.5" style={{ opacity: 0.9 }}>
        Installing on Windows — expect a warning
      </p>
      <p className="mb-2" style={{ opacity: 0.7 }}>
        Windows shows{" "}
        <span className="font-medium" style={{ opacity: 0.95 }}>
          &ldquo;Windows protected your PC&rdquo;
        </span>{" "}
        the first time you run the installer. Click{" "}
        <span className="font-medium" style={{ opacity: 0.95 }}>
          More info
        </span>{" "}
        &rarr;{" "}
        <span className="font-medium" style={{ opacity: 0.95 }}>
          Run anyway
        </span>
        .
      </p>
      <p className="mb-2" style={{ opacity: 0.7 }}>
        Before you do, check that the publisher reads{" "}
        <span className="font-medium" style={{ opacity: 0.95 }}>
          Troy Carson
        </span>
        . That&apos;s shft&apos;s verified code-signing identity — if it says
        anything else, the file didn&apos;t come from us. Don&apos;t run it, and
        email us.
      </p>
      <p style={{ opacity: 0.55 }}>
        The installer is digitally signed and timestamped. Microsoft still shows
        this prompt for independent developers until enough people have
        downloaded a given release; it isn&apos;t a virus detection.
      </p>
    </div>
  )
}
