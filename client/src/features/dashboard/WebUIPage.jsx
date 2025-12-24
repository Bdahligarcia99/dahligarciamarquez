// client/src/features/dashboard/WebUIPage.jsx
import { useState } from 'react'
import { useNavbarSettings } from '../../context/NavbarContext'

const defaultNavItems = [
  { id: 'home', label: 'Home', path: '/' },
  { id: 'journals', label: 'Journals', path: '/blog' },
  { id: 'about', label: 'About', path: '/about' },
  { id: 'contact', label: 'Contact', path: '/contact' },
]

const WebUIPage = () => {
  const [activeNavItem, setActiveNavItem] = useState('home')
  const { toggleHidden, isHidden, isLastVisible } = useNavbarSettings()

  const selectedItem = defaultNavItems.find(item => item.id === activeNavItem)
  const isSelectedHidden = isHidden(activeNavItem)
  const isSelectedLastVisible = isLastVisible(activeNavItem)

  return (
    <div className="p-8 max-w-4xl w-full">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Web UI</h1>
      
      {/* Navbar Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="p-6">
          {/* Horizontal Tab Navigation */}
          <div className="border-b border-gray-200 mb-4">
            <nav className="flex space-x-8">
              {defaultNavItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveNavItem(item.id)}
                  className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                    activeNavItem === item.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } ${isHidden(item.id) ? 'opacity-50 line-through' : ''}`}
                >
                  {item.label}
                  {isHidden(item.id) && (
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  )}
                </button>
              ))}
            </nav>
          </div>
          
          {/* Selected item details */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={selectedItem?.label || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Path
                </label>
                <input
                  type="text"
                  value={selectedItem?.path || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500"
                />
              </div>
              
              {/* Hide from navbar checkbox */}
              <div className="pt-2 border-t border-gray-200">
                <label className={`flex items-center gap-3 ${isSelectedLastVisible ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    checked={isSelectedHidden}
                    onChange={() => toggleHidden(activeNavItem)}
                    disabled={isSelectedLastVisible}
                    className={`w-5 h-5 border-gray-300 rounded focus:ring-blue-500 ${
                      isSelectedLastVisible 
                        ? 'text-gray-300 cursor-not-allowed' 
                        : 'text-blue-600 cursor-pointer'
                    }`}
                  />
                  <span className={`text-sm font-medium ${isSelectedLastVisible ? 'text-gray-400' : 'text-gray-700'}`}>
                    Hide from navbar
                  </span>
                </label>
                {isSelectedLastVisible ? (
                  <p className="text-xs text-amber-600 mt-1 ml-8 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    At least one nav item must remain visible
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 mt-1 ml-8">
                    When checked, this item won't appear in the site navigation
                  </p>
                )}
              </div>

              <p className="text-xs text-gray-400 italic text-center mt-4">
                Changes will be saved to settings (coming soon)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Other sections placeholder */}
      <div className="bg-white rounded-lg shadow-sm border border-dashed border-gray-300 p-8 text-center text-gray-500">
        <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
        <p className="text-lg font-medium">More Customization Options</p>
        <p className="text-sm mt-1">Footer, Branding, Colors, and more coming soon</p>
      </div>
    </div>
  )
}

export default WebUIPage

