import Link from 'next/link'
import Discord from '@images/icons/discord.inline.svg'
import Github from '@images/icons/github.inline.svg'
import LinkedIn from '@images/icons/linkedin.inline.svg'
import Telegram from '@images/icons/telegram.inline.svg'
import Twitter from '@images/icons/twitter.inline.svg'
import Youtube from '@images/icons/youtube.inline.svg'

const SocialLinks = () => {
  return (
    <div className="flex items-center">
      <Link
        href="https://twitter.com/PythNetwork"
        target="_blank"
        className="mr-6"
      >
        <Twitter />
      </Link>
      <Link
        href="https://discord.gg/invite/PythNetwork"
        target="_blank"
        className="mr-6"
      >
        <Discord />
      </Link>
      <Link href="https://t.me/Pyth_Network" target="_blank" className="mr-6">
        <Telegram />
      </Link>
      <Link
        href="https://www.linkedin.com/company/pyth-network"
        target="_blank"
        className="mr-6"
      >
        <LinkedIn />
      </Link>
      <Link
        href="https://github.com/pyth-network"
        target="_blank"
        className="mr-6"
      >
        <Github />
      </Link>
      <Link
        href="https://www.youtube.com/@pythnetwork"
        target="_blank"
        className=""
      >
        <Youtube />
      </Link>
    </div>
  )
}

export default SocialLinks
