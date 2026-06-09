import React from "react";

interface Props {
  children: React.ReactNode;
}

export default function MobileShell({ children }: Props) {
  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-[480px] w-full mx-auto min-h-screen bg-slate-950 border-x border-slate-800/80 shadow-2xl flex flex-col relative text-slate-100">
        {children}
      </div>
    </div>
  );
}
