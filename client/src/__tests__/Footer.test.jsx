// client/src/__tests__/Footer.test.jsx
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Footer from '../components/Footer'
import Navbar from '../components/Navbar'
import { SITE_NAME } from '../config/branding'

// Mock the admin provider
const mockAdminProvider = {
  isAdmin: false
}

jest.mock('../features/admin/AdminProvider', () => ({
  useAdmin: () => mockAdminProvider
}))

describe('Footer Component', () => {
  const renderWithRouter = (component) => {
    return render(
      <BrowserRouter>
        {component}
      </BrowserRouter>
    )
  }

  test('renders footer with site name and copyright', () => {
    renderWithRouter(<Footer />)
    
    const currentYear = new Date().getFullYear()
    const copyrightText = `© ${currentYear} ${SITE_NAME}. All rights reserved.`
    
    expect(screen.getByText(copyrightText)).toBeInTheDocument()
  })

  test('renders navigation links', () => {
    renderWithRouter(<Footer />)
    
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Stories' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Blog' })).toBeInTheDocument()
  })

  test('has proper accessibility attributes', () => {
    renderWithRouter(<Footer />)
    
    const footer = screen.getByRole('contentinfo')
    expect(footer).toBeInTheDocument()
    
    const nav = screen.getByLabelText('Footer')
    expect(nav).toBeInTheDocument()
  })

  test('navigation links have correct href attributes', () => {
    renderWithRouter(<Footer />)
    
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Stories' })).toHaveAttribute('href', '/stories')
    expect(screen.getByRole('link', { name: 'Blog' })).toHaveAttribute('href', '/blog')
  })
})

describe('Navbar and Footer Integration', () => {
  const renderWithRouter = (component) => {
    return render(
      <BrowserRouter>
        {component}
      </BrowserRouter>
    )
  }

  test('both navbar and footer display the site name', () => {
    renderWithRouter(
      <>
        <Navbar onRequestAdminModal={() => {}} />
        <Footer />
      </>
    )
    
    // Check that SITE_NAME appears in both navbar and footer
    const siteNameElements = screen.getAllByText(SITE_NAME)
    expect(siteNameElements).toHaveLength(2) // One in navbar, one in footer copyright
  })
})
