'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { debug } from '@/lib/debug'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    
    try {
      debug.log('Attempting login for email:', email)
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (error) {
        debug.error('Login error:', error.message)
        setErrorMsg(error.message)
        return
      }
      
      debug.log('Login successful, redirecting to dashboard')
      router.push('/dashboard')
    } catch (err) {
      debug.error('Unexpected error during login:', err)
      setErrorMsg('An unexpected error occurred. Please try again.')
    }
  }

  return (
    <form onSubmit={handleLogin} className="max-w-sm mx-auto mt-10 space-y-4 p-6 bg-white rounded-lg shadow">
      <h1 className="text-2xl font-bold text-center mb-6">Login</h1>
      
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <button
        type="submit"
        className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Sign In
      </button>

      {errorMsg && (
        <div className="text-red-600 text-sm mt-2">
          {errorMsg}
        </div>
      )}
    </form>
  )
}