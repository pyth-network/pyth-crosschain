"use client";

import { SearchButton as SearchButtonComponent } from "@pythnetwork/component-library/SearchButton";
import DefaultSearchDialog from "fumadocs-ui/components/dialog/search-default";
import { useCallback, useState } from "react";

export const SearchButton = () => {
  const [open, setOpen] = useState(false);

  const handleSearch = useCallback(() => {
    setOpen(true);
  }, []);

  return (
    <>
    <SearchButtonComponent size='sm' smallScreenText="Search" largeScreenText="Search" onClick={handleSearch} />
      <DefaultSearchDialog
        open={open}
        onOpenChange={setOpen}
        api="/api/search"
      />
    </>
  );
};
