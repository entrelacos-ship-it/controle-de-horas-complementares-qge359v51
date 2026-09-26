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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    if (pb.authStore.isValid && pb.authStore.record) {
      const rec = pb.authStore.record
      return {
        id: rec.id,
        email: rec.email || '',
        name: rec.name || rec.email || 'Usuário',
        role: (rec.role as UserRole) || 'Coordenador',
        avatar: rec.avatar ? pb.files.getURL(rec, rec.avatar) : undefined,
        created: rec.created,
        updated: rec.updated,
      }
    }
    return null
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const unsub = pb.authStore.onChange((token, record) => {
      if (record) {
        setUser({
          id: record.id,
          email: record.email || '',
          name: record.name || record.email || 'Usuário',
          role: (record.role as UserRole) || 'Coordenador',
          avatar: record.avatar ? pb.files.getURL(record, record.avatar) : undefined,
          created: record.created,
          updated: record.updated,
        })
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
            setUser({
              id: res.record.id,
              email: res.record.email || '',
              name: res.record.name || res.record.email || 'Usuário',
              role: (res.record.role as UserRole) || 'Coordenador',
              avatar: res.record.avatar
                ? pb.files.getURL(res.record, res.record.avatar)
                : undefined,
              created: res.record.created,
              updated: res.record.updated,
            })
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
      setUser({
        id: authData.record.id,
        email: authData.record.email || '',
        name: authData.record.name || authData.record.email || 'Usuário',
        role: (authData.record.role as UserRole) || 'Coordenador',
        avatar: authData.record.avatar
          ? pb.files.getURL(authData.record, authData.record.avatar)
          : undefined,
        created: authData.record.created,
        updated: authData.record.updated,
      })
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
        setUser({
          id: res.record.id,
          email: res.record.email || '',
          name: res.record.name || res.record.email || 'Usuário',
          role: (res.record.role as UserRole) || 'Coordenador',
          avatar: res.record.avatar ? pb.files.getURL(res.record, res.record.avatar) : undefined,
          created: res.record.created,
          updated: res.record.updated,
        })
      }
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
