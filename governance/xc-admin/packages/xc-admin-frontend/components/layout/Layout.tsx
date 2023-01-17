import React from 'react'
import Footer from './Footer'
import Header from './Header'

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="relative overflow-hidden">
      <Header />
      <main>{children}</main>
      <Footer />
    </div>
  )
}

export default Layout
