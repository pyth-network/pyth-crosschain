import Link from 'next/link'
import SocialLinks from '../common/SocialLinks'

const Footer = () => {
  return (
    <footer>
      <div className="flex flex-col-reverse items-center justify-between px-4 pt-12 pb-4 sm:px-10 lg:flex-row lg:py-6">
        <span className="text-[10px] lg:basis-[280px]">
          © 2025 Pyth Data Association
        </span>
        <div className="py-10 lg:py-0">
          <Link href="https://pyth.network/" target="_blank">
            Pyth Network
          </Link>{' '}
        </div>
        <SocialLinks />
      </div>
    </footer>
  )
}

export default Footer
