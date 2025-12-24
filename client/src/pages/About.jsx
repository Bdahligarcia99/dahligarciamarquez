import { useEffect } from 'react'
import { setDocumentTitle, setMetaDescription } from '../utils/metadata'
import { SITE_NAME } from '../config/branding'
import BrandImage from '../components/BrandImage'

const About = () => {
  useEffect(() => {
    setDocumentTitle('About')
    setMetaDescription(`Learn more about ${SITE_NAME} and the stories shared here.`)
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
          About
        </h1>
        <p className="text-xl text-secondary-600 max-w-2xl mx-auto">
          a place for the regurgitations of my neurodivergent mind
        </p>
      </header>

      {/* Content */}
      <div className="prose prose-lg max-w-none">
        <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
          <h2 className="text-2xl font-serif font-semibold text-secondary-900 mb-4">
            Who I Am
          </h2>
          <p className="text-secondary-700 leading-relaxed mb-4">
            This is a space where I share my thoughts, experiences, and stories. 
            Each post is a reflection of my journey, capturing moments that have 
            shaped who I am.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
          <h2 className="text-2xl font-serif font-semibold text-secondary-900 mb-4">
            What You'll Find Here
          </h2>
          <p className="text-secondary-700 leading-relaxed mb-4">
            Stories, reflections, and insights from my personal experiences. 
            I believe that sharing our stories helps us connect and grow together.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-8">
          <h2 className="text-2xl font-serif font-semibold text-secondary-900 mb-4">
            Why I Write
          </h2>
          <p className="text-secondary-700 leading-relaxed">
            Writing allows me to process experiences, share lessons learned, 
            and connect with others who might relate to my journey. 
            Every story has value, and I'm glad you're here to read mine.
          </p>
        </div>
      </div>
    </div>
  )
}

export default About

