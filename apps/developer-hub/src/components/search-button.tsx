"use client";

import DefaultSearchDialog from "fumadocs-ui/components/dialog/search-default";
import { useState } from "react";

export const SearchButton = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
        }}
        style={{
          background: "transparent",
          border: "1px solid #ccc",
          padding: "8px 16px",
          borderRadius: "6px",
          cursor: "pointer",
        }}
      >
        Search
      </button>
      <DefaultSearchDialog
        open={open}
        onOpenChange={setOpen}
        api="/api/search"
      />
    </>
  );
};
