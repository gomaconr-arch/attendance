import React from "react";

interface Props {
  children: React.ReactNode;
}

export default function MobileShell({ children }: Props) {
  return (
    <div className="min-h-screen bg-slate-200 p-4">
      <div className="mx-auto w-full max-w-[480px] rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
        {children}
      </div>
    </div>
  );
}
