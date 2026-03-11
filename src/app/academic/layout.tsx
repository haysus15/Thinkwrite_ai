import type { ReactNode } from "react";
import AcademicStudioHeader from "@/components/academic/shell/AcademicStudioHeader";
import AcademicStudioNav from "@/components/academic/shell/AcademicStudioNav";
import { AcademicShellDataProvider } from "@/components/academic/shell/AcademicShellDataContext";

export default function AcademicStudioLayout({ children }: { children: ReactNode }) {
  return (
    <div className="academic-studio-root min-h-screen text-slate-100">
      <div className="sky-layer">
        <div className="stars" />
        <div className="nebula-glow" />
      </div>
      <div className="relative z-10">
        <AcademicShellDataProvider>
          <AcademicStudioHeader />
          <AcademicStudioNav />
          <main className="mx-auto w-full max-w-[1600px] px-5 pb-6 pt-[104px]">
            {children}
          </main>
        </AcademicShellDataProvider>
      </div>
    </div>
  );
}

