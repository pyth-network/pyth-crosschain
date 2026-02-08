import { Button } from "./Button";
import type { IconButtonProps } from "./types";

export function IconButton({ icon: Icon, ...rest }: IconButtonProps) {
  return (
    <Button {...rest} data-iconbutton>
      <Icon />
    </Button>
  );
}
