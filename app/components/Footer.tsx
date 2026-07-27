import Link from 'next/link'
import { DIASPORA_QURAN_ENABLED } from '@/lib/features'

export default function Footer() {
  return (
    <footer className="bg-gray-900 py-12 text-gray-400">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <h2 className="mb-4 text-lg font-bold text-white">TutorConnect Gambia</h2>
            <p className="text-sm">
              Helping Gambian families and students find tutors for in-person lessons.
            </p>
          </div>

          <div>
            <h2 className="mb-4 font-semibold text-white">Quick Links</h2>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/find-tutor" className="transition hover:text-white">
                  Find a Tutor
                </Link>
              </li>
              {DIASPORA_QURAN_ENABLED && (
                <li>
                  <Link href="/online-quran" className="transition hover:text-white">
                    Online Quran
                  </Link>
                </li>
              )}
              <li>
                <Link href="/referrals" className="transition hover:text-white">
                  Referrals
                </Link>
              </li>
              <li>
                <Link href="/register/tutor" className="transition hover:text-white">
                  Become a Tutor
                </Link>
              </li>
              <li>
                <Link href="/login" className="transition hover:text-white">
                  Sign In
                </Link>
              </li>
              <li>
                <Link href="/account/settings" className="transition hover:text-white">
                  Account Settings
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="mb-4 font-semibold text-white">Legal</h2>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/terms" className="transition hover:text-white">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="transition hover:text-white">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/refund-policy" className="transition hover:text-white">
                  Refund Policy
                </Link>
              </li>
              <li>
                <Link href="/tutor-conduct" className="transition hover:text-white">
                  Tutor Conduct
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="mb-4 font-semibold text-white">Contact</h2>
            <p className="text-sm">
              Email: tutorconnectgambia@gmail.com
              <br />
              Location: Serrekunda, The Gambia
            </p>
          </div>
        </div>

        <div className="mt-8 border-t border-gray-800 pt-8 text-center text-sm">
          <p>&copy; 2026 TutorConnect Gambia. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
