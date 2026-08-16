"use client";

import { type ComponentType, useEffect, useState } from "react";

export default function RepoCityClient() {
  const [RepoCity, setRepoCity] = useState<ComponentType | null>(null);

  useEffect(() => {
    let mounted = true;

    import("./RepoCity").then((module) => {
      if (mounted) setRepoCity(() => module.default);
    });

    return () => {
      mounted = false;
    };
  }, []);

  if (!RepoCity) {
    return (
      <main className="city-loading" aria-label="Loading repository map">
        <span className="sr-only">functionary.dev · Famous systems · Map your repository</span>
      </main>
    );
  }

  return <RepoCity />;
}
