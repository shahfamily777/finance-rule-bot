"use client";

import { getSectionTheme, type SectionId, type SectionTheme } from "@/lib/section-theme";
import { createContext, useContext } from "react";

const FormThemeContext = createContext<SectionTheme | null>(null);

export function FormThemeProvider({
  section,
  children,
}: {
  section: SectionId;
  children: React.ReactNode;
}) {
  const theme = getSectionTheme(section);
  return (
    <FormThemeContext.Provider value={theme}>
      <div data-section={section} className="form-themed">
        {children}
      </div>
    </FormThemeContext.Provider>
  );
}

export function useFormTheme(): SectionTheme {
  const t = useContext(FormThemeContext);
  if (!t) throw new Error("useFormTheme must be used inside FormThemeProvider");
  return t;
}
