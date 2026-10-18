import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportScreen } from "@/features/report/report-screen";

export const metadata: Metadata = {
  title: "Match report · Bern Life",
};

async function ReportForId({ params }: { params: PageProps<"/report/[id]">["params"] }) {
  const { id } = await params;
  return <ReportScreen id={id} />;
}

export default function ReportPage({ params }: PageProps<"/report/[id]">) {
  return (
    <main className="mx-auto min-h-dvh max-w-4xl px-4 py-8 sm:px-6 print:max-w-none print:p-0">
      <Suspense>
        <ReportForId params={params} />
      </Suspense>
    </main>
  );
}
