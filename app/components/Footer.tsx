import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400 py-12">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-white font-bold text-lg mb-4">TutorConnect Gambia</h3>
            <p className="text-sm">
              Connecting Gambian families with trusted tutors since 2025.
            </p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/find-ustaz" className="hover:text-white transition">Find a Tutor</Link></li>
              <li><Link href="/register/tutor" className="hover:text-white transition">Become a Tutor</Link></li>
              <li><Link href="/login" className="hover:text-white transition">Sign In</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Contact</h4>
            <p className="text-sm">
              Email: info@tutorconnect.gm<br />
              WhatsApp: +220 XXX XXXX
            </p>
          </div>
        </div>
        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm">
          © 2025 TutorConnect Gambia. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
