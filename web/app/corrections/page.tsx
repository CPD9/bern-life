import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Corrections and removal · Bern Life",
};

const REPOSITORY = "https://github.com/CPD9/bern-life";
// The private route for corrections and removal. A plain mailto link: the visitor's own mail
// program writes the message, and the app sends and keeps nothing.
const CONTACT = "peter.dike@unibe.ch";

// Where every "Wrong or outdated?" note links, served by the app itself so the note works wherever
// the app runs. It says what the README's "Corrections and removal" says; change both together.
export default function CorrectionsPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-2">
        <p className="text-muted text-sm font-bold">Bern Life</p>
        <h1 className="text-3xl font-extrabold tracking-tight">Corrections and removal</h1>
        <p className="text-muted">
          Bern Life removes on request. The Swiss Federal Act on Data Protection (nDSG) gives the
          people named on a page the right to ask.
        </p>
      </header>
      <dl className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <dt className="font-extrabold">Where a quote comes from</dt>
          <dd>
            Every claim is a sentence quoted word for word from an institution&apos;s public page,
            on the date shown beside it. No e-mail address or phone number is stored; the contact is
            the source page. The notes in the app only explain: nothing is sent from them.
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-extrabold">A wrong or outdated sentence</dt>
          <dd>
            The institution corrects its own page, and the change reaches Bern Life with the next
            snapshot of the pages.
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-extrabold">A wrong or outdated address</dt>
          <dd>
            The map&apos;s addresses are not in the snapshot: they are kept in Bern Life&apos;s
            repository, in <code>web/features/world/places.json</code>, each with its page, date and
            checksum. One is corrected or removed by a change to that file, and the
            repository&apos;s history keeps the earlier value.
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-extrabold">Asking for removal</dt>
          <dd>
            Write to{" "}
            <a href={`mailto:${CONTACT}`} className="text-primary font-bold underline">
              {CONTACT}
            </a>{" "}
            with the page link and the sentence; nothing else about you is needed. The link opens
            your own mail program: Bern Life sends nothing and keeps nothing. If you do not mind
            others reading your request, you can instead open an issue on{" "}
            <a href={REPOSITORY} className="text-primary font-bold underline">
              the repository
            </a>
            .
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-extrabold">What happens</dt>
          <dd>
            The page is left out: its path is added to its source&apos;s <code>deny_paths</code> and
            a new snapshot is built without it. The earlier snapshots that hold it are withdrawn and
            the hosted copy is reloaded; its nightly backups age out after 14 days. A single
            sentence cannot be left out on its own: its page goes with it. Sentences someone saved
            to their Library, and the match reports they made, are copies kept in their own browser
            that do not change: they stay there until that person removes them.
          </dd>
        </div>
      </dl>
      <Link href="/" className="text-primary self-start font-bold underline">
        Back to Bern Life
      </Link>
    </main>
  );
}
