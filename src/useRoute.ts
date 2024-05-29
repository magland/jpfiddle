import { useCallback, useMemo } from "react"
import { useLocation, useNavigate } from "react-router-dom"

export type Route = {
    page: 'home'
    fiddleUri?: string
} | {
    page: 'loggedIn'
    accessToken: string
} | {
    page: 'logIn'
} | {
    page: 'jpfiddle-login' // this gets redirected from the /auth endpoint
    access_token: string
}

const useRoute = () => {
    const location = useLocation()
    const navigate = useNavigate()
    const p = location.pathname
    const search = location.search
    const searchParams = useMemo(() => new URLSearchParams(search), [search])
    const route: Route = useMemo(() => {
        if (p === '/') {
            return {
                page: 'home',
                fiddleUri: searchParams.get('f') || undefined
            }
        }
        else if (p === '/loggedIn') {
            const accessToken = searchParams.get('access_token')
            if (!accessToken) {
                throw new Error('Missing access token')
            }
            return {
                page: 'loggedIn',
                accessToken
            }
        }
        else if (p === '/logIn') {
            return {
                page: 'logIn'
            }
        }
        else if (p === '/jpfiddle-login') {
            const access_token = searchParams.get('access_token')
            if (!access_token) {
                throw new Error('Missing access token')
            }
            return {
                page: 'jpfiddle-login',
                access_token
            }
        }
        else {
            return {
                page: 'home'
            }
        }
    }, [p, searchParams])

    const setRoute = useCallback((r: Route) => {
        if (r.page === 'loggedIn') {
            navigate(`/loggedIn?access_token=${r.accessToken}`)
        }
        else if (r.page === 'logIn') {
            navigate('/logIn')
        }
        else if (r.page === 'jpfiddle-login') {
            navigate(`/jpfiddle-login?access_token=${r.access_token}`)
        }
        else if (r.page === 'home') {
            navigate('/?f=' + (r.fiddleUri || ''))
        }
        else {
            navigate('/')
        }
    }, [navigate])

    return {
        route,
        setRoute
    }
}

export default useRoute