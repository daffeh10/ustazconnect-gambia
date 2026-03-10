import Link from 'next/link'
import Header from './components/Header'
import LocationSearch from './components/LocationSearch'
import Footer from './components/Footer'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <Header />

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-4 py-16 md:py-24">
        <div className="text-center">
          <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-6">
            Find a Trusted Tutor
            <span className="block text-emerald-600">in The Gambia</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            TutorConnect Gambia connects students with qualified tutors for in-home lessons
            across The Gambia — covering every subject from Quran to Maths, Physics, English,
            Economics, and more.
          </p>
          <LocationSearch />
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-white py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-12">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Verified Teachers</h3>
              <p className="text-gray-600">
                All our tutors are vetted for subject knowledge, teaching experience, and reliability.
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Flexible Scheduling</h3>
              <p className="text-gray-600">
                Find tutors available when you need them - mornings, afternoons, or weekends.
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">In Your Neighborhood</h3>
              <p className="text-gray-600">
                Connect with tutors who live near you for convenient home lessons.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-emerald-700 py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Are You a Tutor?
          </h2>
          <p className="text-emerald-100 text-lg mb-8">
            Join TutorConnect Gambia and reach families in your area who are looking
            for quality tutoring support for their children across all subjects.
          </p>
          <Link
            href="/register/tutor"
            className="inline-block bg-white text-emerald-700 px-8 py-3 rounded-lg font-semibold hover:bg-emerald-50 transition"
          >
            Register as a Tutor
          </Link>
          <div className="mt-4">
            <Link
              href="/register/family"
              className="inline-block bg-emerald-800 text-white text-sm font-medium px-4 py-2 rounded-lg border border-emerald-500 hover:bg-emerald-900 transition-colors"
            >
              Register as Family/Student
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
