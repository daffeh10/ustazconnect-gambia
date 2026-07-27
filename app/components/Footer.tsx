import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-stone-950 text-stone-300">
      <div className="mx-auto max-w-7xl px-4 py-12 md:py-16">
        <div className="grid gap-10 border-b border-stone-800 pb-12 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Link href="/" className="font-serif text-2xl font-bold text-white">
              TutorConnect Gambia
            </Link>
            <p className="mt-4 max-w-md text-sm leading-6 text-stone-400">
              Find tutors for in-person lessons across The Gambia and Gambian Quran
              teachers offering online lessons to families abroad.
            </p>
          </div>

          <div>
            <h2 className="text-sm font-bold uppercase text-white">Marketplace</h2>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <Link href="/find-tutor" className="transition-colors hover:text-white">
                  Find a tutor
                </Link>
              </li>
              <li>
                <Link href="/online-quran" className="transition-colors hover:text-white">
                  Online Quran
                </Link>
              </li>
              <li>
                <Link href="/register/tutor" className="transition-colors hover:text-white">
                  Teach with us
                </Link>
              </li>
              <li>
                <Link href="/referrals" className="transition-colors hover:text-white">
                  Referrals
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-bold uppercase text-white">Information</h2>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <Link href="/terms" className="transition-colors hover:text-white">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="transition-colors hover:text-white">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/refund-policy" className="transition-colors hover:text-white">
                  Refund Policy
                </Link>
              </li>
              <li>
                <Link href="/tutor-conduct" className="transition-colors hover:text-white">
                  Tutor Conduct
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-7 text-sm text-stone-500 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; 2026 TutorConnect Gambia. All rights reserved.</p>
          <a
            href="mailto:tutorconnectgambia@gmail.com"
            className="break-all transition-colors hover:text-white"
          >
            tutorconnectgambia@gmail.com
          </a>
        </div>
      </div>
    </footer>
  )
}
