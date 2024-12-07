'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from "next/link";
import { debug } from '@/lib/debug'
import { Flex, Text, TextField, Button, Separator } from "@radix-ui/themes"

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
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
    <Flex 
      className="sign-up-background"
      style={{
        backgroundImage: `linear-gradient(0deg, rgba(0, 0, 0, 0.30) 0%, rgba(0, 0, 0, 0.30) 100%), 
        url('/greek_tutor.jpeg')`,
        backgroundColor: 'lightgray',
        backgroundPosition: 'center',
        backgroundSize: 'cover',
        
        backgroundRepeat: 'no-repeat',
      }} 
      p="0"
      display="flex" 
      width="100%" 
      height="100vh" 
      justify="end"
    >
      <Flex 
        className="sign-up-panel"
        style={{
          alignSelf: "stretch",
          backgroundColor: "var(--color-background)"
        }}
        display="flex"
        width="33vw"
        px="7"
        py="9"
        direction="column"
        justify="between"
        align="start"
      >
        <Flex className="blank-alignment" style={{alignSelf: "stretch"}} display="flex" height="27px" align="start"/>
        <Flex className="sign-up-form" display="flex" direction="column" align="start" gap="9">
          <Flex
            className="sign-up-title"
            display="flex"
            direction="column"
            align="start"
            gap="5"
            >
            <Text size="6" weight="bold">
              Login
            </Text>
            <Text size="6" weight="medium">
              back to learning at the frontier
            </Text>
          </Flex>
          <Flex
            className="sign-up-form"
            display="flex"
            direction="column"
            align="start"
            gap="5"
          >
            <Flex
              className="email-field"
              display="flex"
              direction="column"
              align="start"
              gap="3"
            >
              <Text size="2" weight="medium">
                Email
              </Text>
              <TextField.Root type="email" onChange={(event) => setEmail(event.target.value)} size="2" variant="surface" placeholder="Enter email"/>
            </Flex>
            <Flex
              className="password-field"
              display="flex"
              direction="column"
              align="start"
              gap="3"
            >
              <Text size="2" weight="medium">
                Password
              </Text>
              <TextField.Root type="password" onChange={(event) => setPassword(event.target.value)} size="2" variant="surface" placeholder="Enter password"/>
            </Flex>
          </Flex>
          <Button onClick={handleLogin} size="2" variant="solid">
            Login
          </Button>
        </Flex>
        <Flex className="footer" style={{alignSelf: "stretch"}} display="flex" direction="column" align="start" gap="3">
          <Separator size="4" orientation="horizontal"/>
          <Text size="2" weight="regular">
            Don't have an account? <Link href="/signup">Sign Up</Link>
          </Text>
        </Flex>
        {errorMsg && <div className="text-red-600 text-sm mt-2">{errorMsg}</div>}
      </Flex>
    </Flex>
  )
}