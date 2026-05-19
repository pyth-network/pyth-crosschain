import Link from "next/link";

import Discord from "../../images/icons/discord.inline.svg";
import Github from "../../images/icons/github.inline.svg";
import LinkedIn from "../../images/icons/linkedin.inline.svg";
import Telegram from "../../images/icons/telegram.inline.svg";
import Twitter from "../../images/icons/twitter.inline.svg";
import Youtube from "../../images/icons/youtube.inline.svg";

const SocialLinks = () => {
  return (
    <div className="flex items-center">
      <Link
        className="mr-6"
        href="https://twitter.com/PythNetwork"
        target="_blank"
      >
        <Twitter />
      </Link>
      <Link
        className="mr-6"
        href="https://discord.gg/invite/PythNetwork"
        target="_blank"
      >
        <Discord />
      </Link>
      <Link className="mr-6" href="https://t.me/Pyth_Network" target="_blank">
        <Telegram />
      </Link>
      <Link
        className="mr-6"
        href="https://www.linkedin.com/company/pyth-network"
        target="_blank"
      >
        <LinkedIn />
      </Link>
      <Link
        className="mr-6"
        href="https://github.com/pyth-network"
        target="_blank"
      >
        <Github />
      </Link>
      <Link
        className=""
        href="https://www.youtube.com/@pythnetwork"
        target="_blank"
      >
        <Youtube />
      </Link>
    </div>
  );
};

export default SocialLinks;
