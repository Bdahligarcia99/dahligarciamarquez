import { useEffect } from 'react'
import { setDocumentTitle, setMetaDescription } from '../utils/metadata'
import BrandImage from '../components/BrandImage'

const Contact = () => {
  useEffect(() => {
    setDocumentTitle('Contact')
    setMetaDescription('Get in touch with me. I\'d love to hear from you.')
  }, [])

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <header className="text-center mb-12">
        {/* Profile Image */}
        <div className="flex justify-center mb-6">
          <BrandImage 
            slot="profile-image"
            className="object-cover"
            maxHeight={192}
            maxWidth={192}
            rounded={true}
          />
        </div>
        
        <h1 className="text-4xl md:text-5xl font-serif font-bold text-secondary-900 mb-4">
          Get in Touch
        </h1>
        <p className="text-xl text-secondary-600 max-w-2xl mx-auto">
          I'd love to hear from you
        </p>
      </header>

      {/* Contact Options */}
      <div className="grid md:grid-cols-2 gap-6 mb-12">
        {/* Email Card */}
        <div className="bg-white rounded-lg shadow-sm p-8 text-center hover:shadow-md transition-shadow">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-secondary-900 mb-2">Email</h2>
          <p className="text-secondary-600 mb-4">
            Send me a message anytime
          </p>
          <a 
            href="mailto:hello@example.com" 
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            hello@example.com
          </a>
        </div>

        {/* Social Card */}
        <div className="bg-white rounded-lg shadow-sm p-8 text-center hover:shadow-md transition-shadow">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-secondary-900 mb-2">Social Media</h2>
          <p className="text-secondary-600 mb-4">
            Connect with me online
          </p>
          <div className="flex justify-center gap-4">
            <a 
              href="#" 
              className="text-primary-600 hover:text-primary-700 font-medium"
              aria-label="Social Media"
            >
              Follow
            </a>
          </div>
        </div>
      </div>

      {/* Additional Info */}
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <h2 className="text-2xl font-serif font-semibold text-secondary-900 mb-4">
          Let's Connect
        </h2>
        <p className="text-secondary-700 leading-relaxed max-w-2xl mx-auto">
          Whether you have a question, want to share your thoughts on a story, 
          or just want to say hello, I'm always happy to hear from readers. 
          Feel free to reach out through any of the channels above.
        </p>
      </div>
    </div>
  )
}

export default Contact

