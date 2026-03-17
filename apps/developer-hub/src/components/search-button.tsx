"use client";

import { SearchButton as SearchButtonComponent } from "@pythnetwork/component-library/SearchButton";
import DefaultSearchDialog from "fumadocs-ui/components/dialog/search-default";
import { useCallback, useState } from "react";
import { createPortal } from "react-dom";

export const SearchButton = () => {
  const [open, setOpen] = useState(false);

  const handleSearch = useCallback(() => {
    setOpen(true);
  }, []);

  return (
    <>
      <SearchButtonComponent
        largeScreenContent="Search"
        onClick={handleSearch}
        size="sm"
        smallScreenContent="Search"
      />
      {open &&
        createPortal(
          <DefaultSearchDialog
            api="/api/search"
            onOpenChange={setOpen}
            open={open}
          />,
          document.body,
        )}
    </>
  );
};
