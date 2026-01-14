import { memo } from 'react'
import { Logo } from '@/assets/logo'

const FloatingLogoBackground = memo(() => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Clean light background with subtle pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-white to-blue-50" />
      
      {/* Subtle geometric pattern overlay */}
      <div className="absolute inset-0 opacity-30">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e5e7eb" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Floating logos with light theme styling */}
      <div className="absolute top-20 left-10 opacity-5 transform rotate-12">
        <Logo className="w-24 h-24 text-gray-400" />
      </div>
      <div className="absolute top-40 right-20 opacity-5 transform -rotate-6">
        <Logo className="w-32 h-32 text-gray-400" />
      </div>
      <div className="absolute bottom-32 left-1/4 opacity-5 transform rotate-45">
        <Logo className="w-20 h-20 text-gray-400" />
      </div>
      <div className="absolute bottom-20 right-1/3 opacity-5 transform -rotate-12">
        <Logo className="w-28 h-28 text-gray-400" />
      </div>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-3 rotate-90">
        <Logo className="w-40 h-40 text-gray-300" />
      </div>
    </div>
  )
})

FloatingLogoBackground.displayName = 'FloatingLogoBackground'

export { FloatingLogoBackground }
