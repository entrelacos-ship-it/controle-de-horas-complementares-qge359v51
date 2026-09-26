import React, { createContext, useContext, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import type { User, UserRole } from '@/types'

interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isAdmin: boolean
  isLoading: boolean
  login: (email: string, pass: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<{ error: any }>
  confirmPasswordReset: (token: string, password: string) => Promise<{ error: any }>
  requestVerification: (email: string) => Promise<{ error: any }>
  confirmVerification: (token: string) => Promise<{ error: any }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const mapRecordToUser = (rec: any): User => ({
  id: rec.id,
  email: rec.email || '',
  name: rec.name || rec.email || 'Usuário',
  role: (rec.role as UserRole) || 'Coordenador',
  avatar: rec.avatar ? pb.files.getURL(rec, rec.avatar) : undefined,
  verified: Boolean(rec.verified),
  created: rec.created,
  updated: rec.updated,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    if (pb.authStore.isValid && pb.authStore.record) {
      return mapRecordToUser(pb.authStore.record)
    }
    return null
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const unsub = pb.authStore.onChange((_token, record) => {
      if (record) {
        setUser(mapRecordToUser(record))
      } else {
        setUser(null)
      }
    })

    // Checa validade atual
    if (pb.authStore.isValid && pb.authStore.record) {
      pb.collection('users')
        .authRefresh()
        .then((res) => {
          if (res.record) {
            setUser(mapRecordToUser(res.record))
          }
        })
        .catch(() => {
          // Token expirado
          pb.authStore.clear()
          setUser(null)
        })
        .finally(() => {
          setIsLoading(false)
        })
    } else {
      setIsLoading(false)
    }

    return () => {
      unsub()
    }
  }, [])

  const login = async (email: string, pass: string) => {
    const authData = await pb.collection('users').authWithPassword(email, pass)
    if (authData.record) {
      setUser(mapRecordToUser(authData.record))
    }
  }

  const logout = () => {
    pb.authStore.clear()
    setUser(null)
  }

  const refreshUser = async () => {
    if (pb.authStore.isValid) {
      const res = await pb.collection('users').authRefresh()
      if (res.record) {
        setUser(mapRecordToUser(res.record))
      }
    }
  }

  const requestPasswordReset = async (email: string) => {
    try {
      await pb.collection('users').requestPasswordReset(email)
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  const confirmPasswordReset = async (token: string, password: string) => {
    try {
      await pb.collection('users').confirmPasswordReset(token, password, password)
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  const requestVerification = async (email: string) => {
    try {
      await pb.collection('users').requestVerification(email)
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  const confirmVerification = async (token: string) => {
    try {
      await pb.collection('users').confirmVerification(token)
      if (pb.authStore.isValid) {
        await refreshUser()
      }
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  const value: AuthContextType = {
    user,
    token: pb.authStore.token,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'Administrador',
    isLoading,
    login,
    logout,
    refreshUser,
    requestPasswordReset,
    confirmPasswordReset,
    requestVerification,
    confirmVerification,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}
