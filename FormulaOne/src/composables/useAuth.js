import { ref } from 'vue'
import { supabase } from '../supabase'

// 1. GLOBAL STATE (Shared by all components)
const user = ref(null)
const userRole = ref('user') // Default to 'user' so it's not null
const loading = ref(true)

// 2. HELPER: Fetch Role from Database
const fetchRole = async (userId) => {
  if (!userId) return 'user'
  
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()
    
  return data?.role || 'user'
}

// 3. INITIALIZATION: Run immediately to get current session
// This fixes the "blocked data" issue by ensuring we check right away
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

// 4. LISTENER: Watch for Sign In / Sign Out events
// This fixes the "Navbar not updating" issue
supabase.auth.onAuthStateChange(async (event, session) => {
  // If the session changes (Login/Logout), update global state
  if (session?.user) {
    user.value = session.user
    // Only fetch role if we don't have it or if it's a new user
    if (user.value.id !== session.user.id || !userRole.value) {
      userRole.value = await fetchRole(session.user.id)
    }
  } else {
    user.value = null
    userRole.value = 'user'
  }
  loading.value = false
})

// Run init immediately
initAuth()

export function useAuth() {
  
  // We expose the global refs
  const isAdmin = () => userRole.value === 'admin'
  const currentUserId = () => user.value?.id

  return {
    user,
    userRole,
    loading,
    fetchUser: initAuth, // We can reuse initAuth as fetchUser
    isAdmin,
    currentUserId
  }
}