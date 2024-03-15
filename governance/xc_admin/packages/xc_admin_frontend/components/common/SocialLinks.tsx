import Link from 'next/link'
import Discord from '../../images/icons/discord.inline.svg'
import Github from '../../images/icons/github.inline.svg'
import LinkedIn from '../../images/icons/linkedin.inline.svg'
import Telegram from '../../images/icons/telegram.inline.svg'
import Twitter from '../../images/icons/twitter.inline.svg'
import Youtube from '../../images/icons/youtube.inline.svg'

const SocialLinks = () => {
  return (
    <div className="flex items-center">
      <Link href="https://twitter.com/PythNetwork">
        <a target="_blank" className="mr-6">
          <Twitter />
        </a>
      </Link>
      <Link href="https://discord.gg/invite/PythNetwork">
        <a target="_blank" className="mr-6">
          <Discord />
        </a>
      </Link>
      <Link href="https://t.me/Pyth_Network">
        <a target="_blank" className="mr-6">
          <Telegram />
        </a>
      </Link>
      <Link href="https://www.linkedin.com/company/pyth-network">
        <a target="_blank" className="mr-6">
          <LinkedIn />
        </a>
      </Link>
      <Link href="https://github.com/pyth-network">
        <a target="_blank" className="mr-6">
          <Github />
        </a>
      </Link>
      <Link href="https://www.youtube.com/@pythnetwork">
        <a target="_blank" className="">
          <Youtube />
        </a>
      </Link>
    </div>
  )
}

export default SocialLinks
