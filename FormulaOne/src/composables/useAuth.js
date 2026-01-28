import { ref } from 'vue'
import { supabase } from '../supabase'

// GLOBAL STATE
const user = ref(null)
const userRole = ref('user') 
const loading = ref(true)

// Helper: Fetch Role
const fetchRole = async (userId) => {
  if (!userId) return 'user'
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()
  return data?.role || 'user'
}

// Helper: Initialize
const initAuth = async () => {
  loading.value = true
  const { data: { session } } = await supabase.auth.getSession()
  
  if (session?.user) {
    user.value = session.user
    userRole.value = await fetchRole(session.user.id)
  } else {
    user.value = null
    userRole.value = 'user'
  }
  loading.value = false
}

// Listener for background changes
supabase.auth.onAuthStateChange(async (event, session) => {
  if (session?.user) {
    user.value = session.user
    if (user.value.id !== session.user.id || !userRole.value) {
      userRole.value = await fetchRole(session.user.id)
    }
  } else {
    user.value = null
    userRole.value = 'user'
  }
})

// Initialize immediately
initAuth()

export function useAuth() {
  
  // Explicit Login Function
  const login = async (email, password) => {
    loading.value = true
    
    const { data, error } = await supabase.auth.signInWithPassword({ 
      email, 
      password 
    })

    if (error) {
      loading.value = false
      return { error }
    }

    if (data.user) {
      user.value = data.user
      userRole.value = await fetchRole(data.user.id)
    }

    loading.value = false
    return { user: data.user, error: null }
  }

  // Helpers
  const isAdmin = () => userRole.value === 'admin'
  const currentUserId = () => user.value?.id // 👈 RESTORED THIS FUNCTION

  return {
    user,
    userRole,
    loading,
    isAdmin,
    currentUserId, // 👈 EXPORTED AGAIN
    login,
    fetchUser: initAuth
  }
}