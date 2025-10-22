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
        size="sm"
        smallScreenContent="Search"
        largeScreenContent="Search"
        onClick={handleSearch}
      />
      {open &&
        createPortal(
          <DefaultSearchDialog
            open={open}
            onOpenChange={setOpen}
            api="/api/search"
          />,
          document.body,
        )}
    </>
  );
};
