import React from 'react'
import Header from './Header'
import Footer from './Footer'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden">
      <Header />
      <main>{children}</main>
      <Footer />
    </div>
  )
}
