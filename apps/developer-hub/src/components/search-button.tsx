"use client";

import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";
import { Button } from "@pythnetwork/component-library/Button";
import DefaultSearchDialog from "fumadocs-ui/components/dialog/search-default";
import { useState } from "react";

export const SearchButton = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
        }}
        variant="outline"
        size="sm"
        rounded
        beforeIcon={<MagnifyingGlass size={16} />}
      >
        Search
      </Button>
      <DefaultSearchDialog
        open={open}
        onOpenChange={setOpen}
        api="/api/search"
      />
    </>
  );
};
