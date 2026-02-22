import { ref } from 'vue'

const USER_INFO_KEY = 'user_info'

function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_INFO_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const userInfo = ref(getStoredUser())

export function useAuth() {
  const setUser = (info) => {
    userInfo.value = info
    localStorage.setItem(USER_INFO_KEY, JSON.stringify(info))
  }

  const logout = () => {
    userInfo.value = null
    localStorage.removeItem(USER_INFO_KEY)
    window.location.reload()
  }

  return {
    userInfo,
    setUser,
    logout,
  }
}
