'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header className="bg-white shadow-sm">
      <nav className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link href="/" className="text-2xl font-bold text-emerald-700">
            UstazConnect
          </Link>

          {/* Desktop Navigation - hidden on mobile */}
          <div className="hidden md:flex gap-4 items-center">
            <Link href="/find-ustaz" className="text-gray-600 hover:text-emerald-700 transition">
              Find Ustaz
            </Link>
            <Link href="/dashboard" className="text-gray-600 hover:text-emerald-700 transition">
              Ustaz Login
            </Link>
            <Link href="/register-ustaz" className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition">
              Become an Ustaz
            </Link>
          </div>

          {/* Mobile menu button - shown only on mobile */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 text-gray-600"
          >
            {isMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Navigation - shown when menu is open */}
        {isMenuOpen && (
          <div className="md:hidden mt-4 pb-4 border-t border-gray-100 pt-4 space-y-3">
            <Link
              href="/find-ustaz"
              className="block text-gray-600 hover:text-emerald-700 transition py-2"
              onClick={() => setIsMenuOpen(false)}
            >
              Find Ustaz
            </Link>
            <Link
              href="/dashboard"
              className="block text-gray-600 hover:text-emerald-700 transition py-2"
              onClick={() => setIsMenuOpen(false)}
            >
              Ustaz Login
            </Link>
            <Link
              href="/register-ustaz"
              className="block bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition text-center"
              onClick={() => setIsMenuOpen(false)}
            >
              Become an Ustaz
            </Link>
          </div>
        )}
      </nav>
    </header>
  )
}